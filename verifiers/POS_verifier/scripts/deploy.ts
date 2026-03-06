import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const { buildPoseidon } = require("circomlibjs");

interface StorageRecord {
    slot: string;
    value: string;
}

async function computeStateRoot(storageState: StorageRecord[], depth: number): Promise<string> {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    const hashFn = (a: any, b: any) => F.toObject(poseidon([a, b]));

    let currentLevel = storageState.map(r => hashFn(BigInt(r.slot), BigInt(r.value)));
    let emptyNode = BigInt(0);

    for (let i = 0; i < depth; i++) {
        const nextLevel: any[] = [];
        for (let j = 0; j < currentLevel.length; j += 2) {
            const left = currentLevel[j];
            const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : emptyNode;
            nextLevel.push(hashFn(left, right));
        }
        currentLevel = nextLevel;
        emptyNode = hashFn(emptyNode, emptyNode);
    }

    return currentLevel[0].toString();
}

async function main() {
    console.log("1. Reading State Database...");
    
    const dbPath = path.join(__dirname, "storage_db.json");
    
    if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file not found at ${dbPath}`);
    }
    
    const storageData: StorageRecord[] = JSON.parse(fs.readFileSync(dbPath, "utf8"));

    console.log("2. Computing real State Root (Depth 10)...");
    const realStateRoot = await computeStateRoot(storageData, 10);
    console.log(`Calculated State Root: ${realStateRoot}`);

    console.log("\n3. Deploying Groth16 Verifier Core...");
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const groth16 = await Groth16Verifier.deploy();
    await groth16.waitForDeployment();
    const groth16Address = await groth16.getAddress();
    console.log(`Groth16 Core deployed to: ${groth16Address}`);

    console.log("\n4. Deploying StorageProof Wrapper...");
    const StorageWrapper = await ethers.getContractFactory("StorageProofWrapper");
    
    const wrapper = await StorageWrapper.deploy(groth16Address, realStateRoot);
    await wrapper.waitForDeployment();
    const wrapperAddress = await wrapper.getAddress();
    
    console.log(`[->] StorageProof Wrapper deployed to: ${wrapperAddress}`);
    console.log(`\n[->] Use ${wrapperAddress} as Verifier Address when creating a poll!`);
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
});