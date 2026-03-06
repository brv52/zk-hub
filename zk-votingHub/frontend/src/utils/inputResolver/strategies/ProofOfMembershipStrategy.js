import { BaseStrategy } from "./BaseStrategy";
import { buildPoseidon, buildMimc7 } from "circomlibjs";

function validateInputs(manifest, userInputs) {
    const requiredKeys = manifest.inputOrder || Object.keys(manifest.userInputs || {});
    return requiredKeys.every(key => 
        userInputs.hasOwnProperty(key) &&
        userInputs[key] !== undefined &&
        userInputs[key] !== null
    );
}

export class ProofOfMembershipStrategy extends BaseStrategy {
    async resolve(manifest, userInputs, verifierAddress, provider) {
        const config = manifest.config || {};
        const resolvedInputs = { ...userInputs, ...config };

        if (!validateInputs(manifest, userInputs)) {
            throw new Error("ProofOfMembership Error: Inputs from manifest do not match User Inputs");
        }
        
        const publicLeaves = await this.fetchDataset(config.treeSourceURI);
        const treeData = await this.buildClientTree(publicLeaves, manifest, userInputs);

        resolvedInputs.pathElements = treeData.pathElements;
        resolvedInputs.pathIndices = treeData.pathIndices;

        resolvedInputs.merkleRoot = treeData.calculatedRoot;
        delete resolvedInputs.treeSourceURI;
        delete resolvedInputs.depth;
        delete resolvedInputs.arity;
        delete resolvedInputs.emptyNodeValue;
        delete resolvedInputs.hashAlgorithm;

        return resolvedInputs;
    }

    async fetchDataset(uri) {
        if (!uri) throw new Error("Invalid or missing dataset URI.");
        const url = uri.startsWith("ipfs://") ? uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/") : uri;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch tree dataset.");
        return await response.json();
    }

    async buildClientTree(publicLeaves, manifest, userInputs) {
        const config = manifest.config || {};
        const depth = config.depth || 10;
        const arity = config.arity || 2;
        const emptyNodeValue = BigInt(config.emptyNodeValue || "0");

        let hashFn, F;
        const algorithm = (config.hashAlgorithm || "poseidon").toLowerCase();

        if (algorithm === "poseidon") {
            const poseidon = await buildPoseidon();
            F = poseidon.F;
            hashFn = (inputs) => F.toObject(poseidon(inputs));
        } else if (algorithm === "mimc7") {
            const mimc7 = await buildMimc7();
            F = mimc7.F;
            hashFn = (inputs) => F.toObject(mimc7.multiHash(inputs));
        } else {
            throw new Error(`Unsupported hash algorithm: ${algorithm}`);
        }

        const orderedInputs = manifest.inputOrder.map(key => BigInt(userInputs[key]));
        const myLeaf = hashFn(orderedInputs);
        let currentIndex = publicLeaves.findIndex(leaf => leaf.toString() === myLeaf.toString());
        
        if (currentIndex === -1) throw new Error("Your generated credential does not exist in the authorized registry.");

        const pathElements = [];
        const pathIndices = [];
        let currentLevel = publicLeaves.map(l => BigInt(l));
        let currentEmptyNodeValue = emptyNodeValue;
        
        for (let i = 0; i < depth; i++) {
            const chunkIndex = Math.floor(currentIndex / arity);
            const positionInChunk = currentIndex % arity;
            
            pathIndices.push(positionInChunk);
            
            const siblings = [];
            for (let k = 0; k < arity; k++) {
                if (k === positionInChunk) continue;
                const nodeIndex = chunkIndex * arity + k;
                const nodeValue = nodeIndex < currentLevel.length ? currentLevel[nodeIndex] : currentEmptyNodeValue;
                siblings.push(nodeValue.toString());
            }
            
            pathElements.push(arity === 2 ? siblings[0] : siblings);

            const nextLevel = [];
            for (let j = 0; j < currentLevel.length; j += arity) {
                const chunkToHash = [];
                for (let k = 0; k < arity; k++) {
                    const nodeIndex = j + k;
                    chunkToHash.push(nodeIndex < currentLevel.length ? currentLevel[nodeIndex] : currentEmptyNodeValue);
                }
                nextLevel.push(hashFn(chunkToHash));
            }
            
            currentLevel = nextLevel;
            currentIndex = chunkIndex;

            const emptyChunkToHash = Array(arity).fill(currentEmptyNodeValue);
            currentEmptyNodeValue = BigInt(hashFn(emptyChunkToHash));
        }

        return { pathElements, pathIndices, calculatedRoot: currentLevel[0].toString() };
    }
}