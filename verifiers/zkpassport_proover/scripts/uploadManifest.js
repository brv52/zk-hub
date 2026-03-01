const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;

const manifest = {
  version: "1.0.0",
  name: "Biometric ZKPassport Verification",
  verificationMethod: "zkpassport",
  artifacts: {},
  config: {
    minAge: 18,
    nationality: ["CZE", "RUS"]
  },
  userInputs: {},
  inputOrder: []
}

async function uploadToPinata() {
  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

  try {
    const res = await axios.post(url, manifest, {
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretApiKey
      }
    });
    console.log("✅ Manifest uploaded to IPFS!");
    console.log(`✅ CID: ${res.data.IpfsHash}`);
    console.log(`Gateway URL: https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`);
    console.log("\nPlug this CID into your React App's Create Poll page.");
  } catch (error) {
    console.error("Error uploading to Pinata:", error);
  }
}

uploadToPinata();