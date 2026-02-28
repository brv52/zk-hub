const axios = require('axios');
require('dotenv').config();

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;

// This defines the Local Groth16 Manifest (Schema Type B)
const manifest = {
  manifestVersion: "1.2",
  verificationMethod: "local",
  metadata: {
    name: "Local Web3 Merkle Poll",
    description: "Generates Groth16 Zero-Knowledge proofs directly in your browser."
  },
  artifacts: {
    wasm: "ipfs://bafybeieso67ujpwgf2zhz77ohykdmqtb6poe2vrsibhcaelk2cbj5q55bm",
    zkey: "ipfs://bafybeibdzqjteqcakrghxxadqcsqv4ceqezfrkbzqqzh2n456sgrexetka"
  },
  frontendDisplay: {
    userInputs: [
      { id: "userSecret", label: "Secret ID", type: "number", description: "Your private registration secret", isPrivate: true },
      { id: "userAge", label: "Age", type: "number", description: "Your registered age", isPrivate: true }
    ],
    computedInputs: [
      { id: "pollId", provider: "static" },
      { id: "minAge", provider: "contract-call", method: "expectedMinAge()" },
      { id: "merkleRoot", provider: "contract-call", method: "expectedMerkleRoot()" },
      { id: "pathElements", provider: "merkle-tree" },
      { id: "pathIndices", provider: "merkle-tree" }
    ]
  }
};

async function uploadToPinata() {
  console.log("📤 Uploading Local Voting Manifest to Pinata IPFS...");
  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

  try {
    const res = await axios.post(url, manifest, {
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretApiKey
      }
    });
    console.log("✅ Manifest successfully pinned to IPFS!");
    console.log(`📌 CID: ${res.data.IpfsHash}`);
    console.log(`🔗 Gateway: https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`);
    console.log("\nUse this CID in your frontend when calling createPoll().");
  } catch (error) {
    console.error("❌ Error uploading to Pinata:");
    console.error(error.response ? error.response.data : error.message);
  }
}

uploadToPinata();