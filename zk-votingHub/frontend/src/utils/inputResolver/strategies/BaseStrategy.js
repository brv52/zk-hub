export class BaseStrategy {
    /**
     * @param {Object} manifest - Full JSON manifest from IPFS
     * @param {Object} userInputs - Data from user for proof generation
     * @param {String} verifierAddress - Address of IUniversalVerifier contract
     * @param {Object} provider - Ethers.js provider
     * @returns {Object} Inputs ready for ZK-proof generation
     */
    async resolve(manifest, userInputs, verifierAddress, provider) {
        throw new Error("Method 'resolve' must be implemented");
    }
}