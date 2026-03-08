import { BaseStrategy } from "./BaseStrategy";
import { buildPoseidon, buildMimc7 } from "circomlibjs";

function validateInputs(manifest, userInputs) {
    const requiredKeys = manifest.inputOrder || Object.keys(manifest.userInputs || {});
    
    for (const key of requiredKeys) {
        const value = userInputs[key];
        if (value === undefined || value === null || value === "") {
            throw new Error(`Validation Error: Missing required input '${key}'.`);
        }
        if (isNaN(Number(value))) {
            throw new Error(`Validation Error: Input '${key}' must be a numeric string. Received: ${value}`);
        }
    }
    
    return true;
}

export class ProofOfMembershipStrategy extends BaseStrategy {
    async resolve(manifest, userInputs, verifierAddress, provider) {
        const config = manifest.config || {};
        
        if (!validateInputs(manifest, userInputs)) {
            throw new Error("ProofOfMembership Error: Inputs from manifest do not match User Inputs");
        }
        
        const publicLeaves = await this.fetchDataset(config.treeSourceURI);
        const treeData = await this.buildClientTree(publicLeaves, manifest, userInputs);

        const allAvailableData = {
            ...userInputs, 
            ...config,
            pathElements: treeData.pathElements,
            pathIndices: treeData.pathIndices,
            merkleRoot: treeData.calculatedRoot
        };

        const STRATEGY_DIRECTIVES = [
            "treeSourceURI", 
            "depth", 
            "arity", 
            "hashAlgorithm", 
            "emptyNodeValue"
        ];

        const customConfigSignals = Object.keys(config).filter(
            key => !STRATEGY_DIRECTIVES.includes(key)
        );

        const expectedCircuitSignals = [
            "merkleRoot", 
            "pollId", 
            "optionId", 
            "pathElements", 
            "pathIndices",
            ...(manifest.inputOrder || []),
            ...customConfigSignals
        ];

        return this.sanitizeCircuitInputs(allAvailableData, expectedCircuitSignals);
    }

    async buildClientTree(publicLeaves, manifest, userInputs) {
        const config = manifest.config || {};
        const depth = config.depth || 10;
        const arity = config.arity || 2;
        const emptyNodeValue = BigInt(config.emptyNodeValue || "0");
        const algorithm = (config.hashAlgorithm || "poseidon").toLowerCase();

        let hashFn;

        if (algorithm === "poseidon") {
            const poseidon = await buildPoseidon();
            const F = poseidon.F;
            hashFn = (inputs) => F.toObject(poseidon(inputs));
        } else if (algorithm === "mimc7") {
            const mimc7 = await buildMimc7();
            const F = mimc7.F;
            hashFn = (inputs) => F.toObject(mimc7.multiHash(inputs));
        } else {
            throw new Error(`Unsupported hash algorithm: ${algorithm}`);
        }

        const orderedInputs = manifest.inputOrder.map(key => BigInt(userInputs[key]));
        const myLeaf = hashFn(orderedInputs);
        let currentIndex = publicLeaves.findIndex(leaf => leaf.toString() === myLeaf.toString());
        
        if (currentIndex === -1) {
            throw new Error("Your generated credential does not exist in the authorized registry.");
        }

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