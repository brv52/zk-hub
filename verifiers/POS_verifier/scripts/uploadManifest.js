require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pinataSDK = require('@pinata/sdk');

const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

async function pinFileToIPFS(filePath, name) {
    if (!fs.existsSync(filePath)) {
        console.error(`\nERROR: File not found at path: ${filePath}`);
        console.error(`Make sure you ran ./setup.sh successfully and the path is correct.\n`);
        process.exit(1);
    }

    const stream = fs.createReadStream(filePath);
    const result = await pinata.pinFileToIPFS(stream, { pinataMetadata: { name } });
    return `ipfs://${result.IpfsHash}`;
}

async function main() {
    console.log("1. Uploading WASM...");
    const wasmPath = path.join(__dirname, "../circuit/StorageProof_js/StorageProof.wasm");
    const wasmURI = await pinFileToIPFS(wasmPath, "StorageProof.wasm");
    
    console.log("2. Uploading ZKey...");
    const zkeyPath = path.join(__dirname, "../circuit/storage_final.zkey");
    const zkeyURI = await pinFileToIPFS(zkeyPath, "StorageProof.zkey");

    console.log("3. Uploading REAL State Database...");
    const dbPath = path.join(__dirname, "storage_db.json");
    const storageURI = await pinFileToIPFS(dbPath, "Storage_DB");

    console.log("4. Generating and Uploading Manifest...");
    const manifest = {
        version: "1.0.0",
        name: "L2 State Storage Proof",
        verificationMethod: "storage-proof",
        artifacts: {
            wasmURI,
            zkeyURI
        },
        config: {
            storageURI,
            depth: 10
        },
        userInputs: {
            slot: "number",
            value: "number"
        },
        inputOrder: ["slot", "value"]
    };

    const manifestPath = path.join(__dirname, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    const manifestURI = await pinFileToIPFS(manifestPath, "StorageProof_Manifest");

    console.log("\nDONE");
    console.log("[->] Manifest URI:", manifestURI);
}

main().catch(console.error);