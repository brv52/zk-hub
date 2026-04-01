require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pinataSDK = require('@pinata/sdk');
const { saveDeploymentInfo } = require('../../logger.js');

const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

async function pinFileToIPFS(filePath, name) {
    if (!fs.existsSync(filePath)) throw new Error(`FILE_NOT_FOUND: ${filePath}`);
    const stream = fs.createReadStream(filePath);
    const result = await pinata.pinFileToIPFS(stream, { pinataMetadata: { name } });
    return `ipfs://${result.IpfsHash}`;
}

async function main() {
    console.log("> INITIATING_MANIFEST_UPLOAD: PROOF_OF_STORAGE");

    const wasmURI = await pinFileToIPFS(path.join(__dirname, "../circuit/StorageProof_js/StorageProof.wasm"), "StorageProof.wasm");
    const zkeyURI = await pinFileToIPFS(path.join(__dirname, "../circuit/storage_final.zkey"), "StorageProof.zkey");

    const manifest = {
        version: "2.0.0",
        name: "L2 State Storage Verifier (Gated)",
        verificationMethod: "storage-proof",
        artifacts: { wasmURI, zkeyURI },
        config: {
            depth: 10,
            minThreshold: 100
        },
        registrySchema: [
            { name: "slot", type: "string", label: "Storage Slot (User ID/Address)" },
            { name: "value", type: "number", label: "Storage Value (Token Balance)" }
        ],
        configABI: ["uint256", "uint256"],
        configKeys: ["expectedStateRoot", "minThreshold"],
        userInputs: { slot: "string", value: "number" },
        inputOrder: ["slot", "value"],
        circuitSignals: ["stateRoot", "pollId", "minThreshold", "optionId", "slot", "value", "pathElements", "pathIndices"]
    };

    const manifestPath = path.join(__dirname, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const manifestURI = await pinFileToIPFS(manifestPath, "POS_Manifest.json");

    console.log(`> MANIFEST_URI: ${manifestURI}`);
    saveDeploymentInfo('ProofOfStorage', 'manifestURI', manifestURI);
    console.log("> STATUS: SUCCESS");
}

main().catch(console.error);