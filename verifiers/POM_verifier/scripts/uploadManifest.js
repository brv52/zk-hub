const pinataSDK = require('@pinata/sdk');
const fs = require('fs');
const path = require('path');
const { buildPoseidon } = require("circomlibjs");
require('dotenv').config();

const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

/**
 * Calculates Merkle Root and returns the hashed leaves for IPFS
 */
async function processMerkleTree(privateLeaves, depth = 10) {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    // 1. Generate the public (hashed) leaves from private data
    // Circuit expects: Poseidon(secret, age)
    let hashedLeaves = privateLeaves.map(leaf => 
        F.toObject(poseidon([BigInt(leaf.secret), BigInt(leaf.age)])).toString()
    );

    console.log(`Generated ${hashedLeaves.length} public hashes from private data.`);

    // 2. Calculate the Root for the Smart Contract
    let currentLevel = hashedLeaves.map(h => BigInt(h));
    const totalLeaves = Math.pow(2, depth);
    
    // Pad with zeros to reach tree capacity
    while (currentLevel.length < totalLeaves) {
        currentLevel.push(0n);
    }

    // Hash up the tree
    for (let d = 0; d < depth; d++) {
        let nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            nextLevel.push(F.toObject(poseidon([currentLevel[i], currentLevel[i + 1]])));
        }
        currentLevel = nextLevel;
    }

    return {
        root: currentLevel[0].toString(),
        publicLeaves: hashedLeaves // The flat array to upload to IPFS
    };
}

async function uploadToIPFS(filePath, name) {
    const stream = fs.createReadStream(filePath);
    const result = await pinata.pinFileToIPFS(stream, { pinataMetadata: { name } });
    return `ipfs://${result.IpfsHash}`;
}

async function main() {
    // 1. Load the Private Data
    const privateDataPath = path.join(__dirname, 'private_leaves.json');
    if (!fs.existsSync(privateDataPath)) {
        throw new Error("File 'private_leaves.json' not found! Rename your raw data file.");
    }
    const privateLeaves = JSON.parse(fs.readFileSync(privateDataPath));

    // 2. Process Tree
    const { root, publicLeaves } = await processMerkleTree(privateLeaves);
    
    console.log("\n==================================================");
    console.log("🚀 ACTUAL MERKLE ROOT:", root);
    console.log("👉 COPY THIS INTO YOUR deploy.ts initialRoot variable!");
    console.log("==================================================\n");

    // 3. Save the Public Hashes to a temporary file for upload
    const publicPath = path.join(__dirname, 'public_leaves.json');
    fs.writeFileSync(publicPath, JSON.stringify(publicLeaves, null, 2));

    // 4. Upload everything to IPFS
    console.log("Uploading artifacts...");
    const wasmURI = await uploadToIPFS(path.join(__dirname, 'membership_js/membership.wasm'), 'membership.wasm');
    const zkeyURI = await uploadToIPFS(path.join(__dirname, 'membership_final.zkey'), 'membership.zkey');
    const datasetURI = await uploadToIPFS(publicPath, 'public_leaves.json');

    // 5. Create and upload Manifest
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

    console.log("\n✅ SUCCESS!");
    console.log("Manifest URI:", manifestURI);
    
    // Optional: Clean up the local public_leaves file after upload
    // fs.unlinkSync(publicPath);
}

main().catch(console.error);