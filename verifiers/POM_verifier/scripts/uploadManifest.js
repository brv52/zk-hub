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
    console.log("> INITIATING_MANIFEST_UPLOAD: PROOF_OF_MEMBERSHIP");

    const wasmURI = await pinFileToIPFS(path.join(__dirname, 'membership_js/membership.wasm'), 'membership.wasm');
    const zkeyURI = await pinFileToIPFS(path.join(__dirname, 'membership_final.zkey'), 'membership.zkey');

    const manifest = {
        version: "2.0.0",
        name: "Universal Membership & Threshold Verifier",
        verificationMethod: "merkle-tree",
        artifacts: { wasmURI, zkeyURI },
        config: {
            depth: 10,
            arity: 2,
            hashAlgorithm: "poseidon",
            emptyNodeValue: "0",
            minThreshold: 1
        },
        registrySchema: [
            { name: "secret", type: "string", label: "Voter Secret (Entropy)" },
            { name: "value", type: "number", label: "Threshold Value (Age/Balance/etc)" }
        ],
        configABI: ["uint256", "uint256"],
        configKeys: ["merkleRoot", "minThreshold"],
        userInputs: { secret: "string", value: "number" },
        inputOrder: ["secret", "value"],
        circuitSignals: ["merkleRoot", "pollId", "minThreshold", "optionId", "secret", "value", "pathElements", "pathIndices"]
    };

    const manifestPath = path.join(__dirname, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    const manifestURI = await pinFileToIPFS(manifestPath, 'POM_Manifest.json');

    console.log(`> MANIFEST_URI: ${manifestURI}`);
    saveDeploymentInfo('ProofOfMembership', 'manifestURI', manifestURI);
    console.log("> STATUS: SUCCESS");
}

main().catch(console.error);