import { ethers, network, run, artifacts } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import * as fs from "fs";
import * as path from "path";

async function buildTree(leaves: bigint[], depth: number, poseidon: any): Promise<bigint> {
    const F = poseidon.F;
    let currentLevel = leaves;
    for (let i = 0; i < depth; i++) {
        const nextLevel = [];
        for (let j = 0; j < currentLevel.length; j += 2) {
            const left = currentLevel[j];
            const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : BigInt(0);
            const hash = poseidon([left, right]);
            nextLevel.push(F.toObject(hash));
        }
        currentLevel = nextLevel;
    }
    return currentLevel[0];
}

async function main() {
    console.log(`\n🚀 Starting Deployment to network: ${network.name}`);

    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deploying with account: ${deployer.address}`);

    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    console.log("1. Generating Test Voter Data...");
    const voters = [
        { secret: 12345n, age: 25n },
        { secret: 67890n, age: 19n }
    ];
    const leaves = voters.map(v => F.toObject(poseidon([v.secret, v.age])));

    console.log("2. Building Merkle Tree (Depth 10)...");
    const expectedMerkleRoot = await buildTree(leaves, 10, poseidon);
    console.log(`   Expected Merkle Root: ${expectedMerkleRoot.toString()}`);

    console.log("3. Deploying Base Groth16 Verifier...");
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const baseVerifier = await Groth16Verifier.deploy();
    await baseVerifier.waitForDeployment();
    const baseVerifierAddr = await baseVerifier.getAddress();
    
    console.log("4. Deploying Custom KYC Verifier...");
    const expectedMinAge = 18n;
    const CustomKycVerifier = await ethers.getContractFactory("CustomKycVerifier");
    const customVerifier = await CustomKycVerifier.deploy(baseVerifierAddr, expectedMerkleRoot, expectedMinAge);
    await customVerifier.waitForDeployment();
    const customVerifierAddr = await customVerifier.getAddress();
    console.log(`✅ Custom KYC Verifier deployed to: ${customVerifierAddr}`);

    saveFrontendFiles(customVerifierAddr);

    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\n⏳ Waiting for 5 block confirmations before verification...");
        
        // --- FIX IS HERE ---
        const tx = customVerifier.deploymentTransaction();
        if (tx) {
            await tx.wait(5); // Wait 5 blocks directly on the tx object
        }
        // -------------------

        console.log("🔍 Verifying CustomKycVerifier on Etherscan...");
        try {
            await run("verify:verify", {
                address: customVerifierAddr,
                constructorArguments: [baseVerifierAddr, expectedMerkleRoot, expectedMinAge],
            });
            console.log("✅ Contract verified successfully!");
        } catch (error: any) {
            if (error.message.toLowerCase().includes("already verified")) console.log("ℹ️ Already verified.");
            else console.error("❌ Verification failed:", error);
        }
    }
}

function saveFrontendFiles(customVerifierAddr: string) {
    const frontendDir = path.join(__dirname, "..", "..", "frontend", "src", "contracts");
    if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });

    fs.writeFileSync(
        path.join(frontendDir, "MerkleVerifierAddress.json"),
        JSON.stringify({ CustomKycVerifier: customVerifierAddr }, undefined, 2)
    );
    const VerifierArtifact = artifacts.readArtifactSync("CustomKycVerifier");
    fs.writeFileSync(
        path.join(frontendDir, "CustomKycVerifier.json"),
        JSON.stringify(VerifierArtifact, null, 2)
    );
    console.log(`📁 Artifacts exported to: ${frontendDir}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});