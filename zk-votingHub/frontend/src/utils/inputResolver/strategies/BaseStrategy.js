export class BaseStrategy {
    async resolve(manifest, userInputs, verifierAddress, provider, databaseURI) {
        throw new Error("Method 'resolve' must be implemented");
    }

    async buildDatabase(manifest, rawDataset) {
        throw new Error("Method 'buildDatabase' must be implemented");
    }

    async fetchDataset(uri) {
        if (!uri) throw new Error("Invalid or missing dataset URI.");
        const url = uri.startsWith("ipfs://") 
            ? uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/") 
            : uri;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch dataset from IPFS/HTTP. Status: ${response.status}`);
        return await response.json();
    }

    sanitizeCircuitInputs(rawData, expectedKeys) {
        const cleanInputs = {};
        for (const key of expectedKeys) {
            const value = rawData[key];
            if (value === undefined || value === null) {
                throw new Error(`ZK_PAYLOAD_ERROR: Missing required circuit signal '${key}'`);
            }
            cleanInputs[key] = Array.isArray(value) ? value.map(v => v.toString()) : value.toString();
        }
        return cleanInputs;
    }
}