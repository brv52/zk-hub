const pinataSDK = require('@pinata/sdk');
const fs = require('fs');
const path = require('path');
const { buildPoseidon } = require("circomlibjs");
require('dotenv').config();

const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

async function processMerkleTree(privateLeaves, depth = 10) {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    let hashedLeaves = privateLeaves.map(leaf => 
        F.toObject(poseidon([BigInt(leaf.secret), BigInt(leaf.age)])).toString()
    );

    console.log(`Generated ${hashedLeaves.length} public hashes from private data.`);

    let currentLevel = hashedLeaves.map(h => BigInt(h));
    const totalLeaves = Math.pow(2, depth);
    
    while (currentLevel.length < totalLeaves) {
        currentLevel.push(0n);
    }

    for (let d = 0; d < depth; d++) {
        let nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            nextLevel.push(F.toObject(poseidon([currentLevel[i], currentLevel[i + 1]])));
        }
        currentLevel = nextLevel;
    }

    return {
        root: currentLevel[0].toString(),
        publicLeaves: hashedLeaves
    };
}

async function uploadToIPFS(filePath, name) {
    const stream = fs.createReadStream(filePath);
    const result = await pinata.pinFileToIPFS(stream, { pinataMetadata: { name } });
    return `ipfs://${result.IpfsHash}`;
}

async function main() {
    const privateDataPath = path.join(__dirname, 'private_leaves.json');
    if (!fs.existsSync(privateDataPath)) {
        throw new Error("File 'private_leaves.json' not found! Rename your raw data file.");
    }
    const privateLeaves = JSON.parse(fs.readFileSync(privateDataPath));

    const { root, publicLeaves } = await processMerkleTree(privateLeaves);
    
    const publicPath = path.join(__dirname, 'public_leaves.json');
    fs.writeFileSync(publicPath, JSON.stringify(publicLeaves, null, 2));

    console.log("Uploading artifacts...");
    const wasmURI = await uploadToIPFS(path.join(__dirname, 'membership_js/membership.wasm'), 'membership.wasm');
    const zkeyURI = await uploadToIPFS(path.join(__dirname, 'membership_final.zkey'), 'membership.zkey');
    const datasetURI = await uploadToIPFS(publicPath, 'public_leaves.json');

    const manifest = {
        version: "1.0.0",
        name: "Thesis Membership Verifier",
        verificationMethod: "merkle-tree",
        artifacts: { wasmURI, zkeyURI },
        config: {
            treeSourceURI: datasetURI.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/"),
            expectedMinAge: 18,
            depth: 10,
            arity: 2,
            hashAlgorithm: "poseidon"
        },
        userInputs: { secret: "string", age: "number" },
        inputOrder: ["secret", "age"]
    };

    const manifestPath = path.join(__dirname, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const manifestURI = await uploadToIPFS(manifestPath, 'manifest.json');

    console.log("\nSUCCESS");
    console.log("[->] Manifest URI:", manifestURI);
}

main().catch(console.error);