const axios = require('axios');
require('dotenv').config();
const { saveDeploymentInfo } = require('../../logger.js');

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;

const manifest = {
    version: "2.0.0",
    name: "Universal ZKPassport Verifier",
    verificationMethod: "zkpassport",
    artifacts: {},
    config: {
        domain: "localhost",
        minAge: 18,
        inNationality: ["CZE", "RUS"]
    },
    registrySchema: [],
    configABI: ["string", "uint8", "string[]"],
    configKeys: ["domain", "minAge", "inNationality"],
    userInputs: {},
    inputOrder: []
};

async function main() {
    console.log("> INITIATING_MANIFEST_UPLOAD: ZK_PASSPORT");
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

    try {
        const res = await axios.post(url, manifest, {
            headers: {
                'Content-Type': 'application/json',
                pinata_api_key: pinataApiKey,
                pinata_secret_api_key: pinataSecretApiKey
            }
        });

        const manifestURI = `ipfs://${res.data.IpfsHash}`;
        console.log(`> MANIFEST_URI: ${manifestURI}`);
        saveDeploymentInfo('ZKPassport', 'manifestURI', manifestURI);
        console.log("> STATUS: SUCCESS");
    } catch (error) {
        console.error("> ERROR:", error.response ? error.response.data : error.message);
    }
}

main();