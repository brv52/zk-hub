import axios from 'axios';

export const resolveIPFS = (uri) => {
    if (!uri) return '';
    if (uri.startsWith('ipfs://')) {
        return uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
    }
    return uri;
};

export const fetchManifest = async (uri) => {
    try {
        const url = resolveIPFS(uri);
        const response = await axios.get(url, { timeout: 10000 });
        const data = response.data;

        if (!data || !data.registrySchema || !data.configABI || !data.configKeys) {
            throw new Error("INVALID_MANIFEST_SIGNATURE");
        }
        return data;
    } catch (error) {
        throw new Error(`MANIFEST_FETCH_FAILED: ${error.message}`);
    }
};

export const pinDatasetToIPFS = async (safeDataset) => {
    const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || process.env.REACT_APP_PINATA_JWT;

    if (!PINATA_JWT) {
        throw new Error("Pinata JWT token is missing from environment variables.");
    }

    try {
        const response = await axios.post(
            "https://api.pinata.cloud/pinning/pinJSONToIPFS",
            {
                pinataContent: safeDataset,
                pinataMetadata: {
                    name: `ZK_Poll_Dataset_${new Date().toISOString()}.json`
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${PINATA_JWT}`
                }
            }
        );
        return `ipfs://${response.data.IpfsHash}`;
    } catch (error) {
        console.error("IPFS Upload Error:", error);
        throw new Error("Failed to pin dataset to IPFS.");
    }
};