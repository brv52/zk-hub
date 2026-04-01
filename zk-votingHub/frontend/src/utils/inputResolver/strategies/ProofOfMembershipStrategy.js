import { BaseStrategy } from "./BaseStrategy";
import { buildPoseidon, buildMimc7 } from "circomlibjs";
import { ethers } from "ethers";
import { Buffer } from "buffer";

export class ProofOfMembershipStrategy extends BaseStrategy {

    async _getHashFunction(algorithm) {
        const algo = (algorithm || "poseidon").toLowerCase();
        if (algo === "poseidon") {
            const poseidon = await buildPoseidon();
            const F = poseidon.F;
            return (inputs) => F.toObject(poseidon(inputs));
        } else if (algo === "mimc7") {
            const mimc7 = await buildMimc7();
            const F = mimc7.F;
            return (inputs) => F.toObject(mimc7.multiHash(inputs));
        } else {
            throw new Error(`Unsupported hash algorithm: ${algo}`);
        }
    }

    _formatInputToBigInt(value, fieldType) {
        if (value === undefined || value === null || value === '') {
            throw new Error(`MISSING_FIELD_VALUE`);
        }
        
        const strVal = value.toString().trim();
        
        if (fieldType === 'number') {
            return BigInt(strVal);
        } else {
            if (strVal.startsWith('0x') && /^0x[a-fA-F0-9]+$/.test(strVal)) {
                return BigInt(strVal);
            }
            return BigInt('0x' + Buffer.from(strVal).toString('hex'));
        }
    }

    _prepareInputs(manifest, dataSource) {
        return manifest.registrySchema.map(field => {
            const value = dataSource[field.name];
            return this._formatInputToBigInt(value, field.type);
        });
    }

    async buildDatabase(manifest, rawDataset, isPreHashed = false) {
        const depth = manifest.config.depth || 10;
        const arity = manifest.config.arity || 2;
        const hashFn = await this._getHashFunction(manifest.config.hashAlgorithm);

        const safeDataset = rawDataset.map(row => {
            if (isPreHashed) {
                const primaryFieldName = manifest.registrySchema[0].name;
                return BigInt(row[primaryFieldName].toString().trim()).toString();
            } else {
                const inputs = this._prepareInputs(manifest, row);
                return hashFn(inputs).toString();
            }
        });

        let currentLevel = safeDataset.map(leaf => BigInt(leaf));
        let currentEmptyNodeValue = BigInt(manifest.config.emptyNodeValue || "0");

        for (let i = 0; i < depth; i++) {
            const nextLevel = [];
            for (let j = 0; j < currentLevel.length; j += arity) {
                const chunkToHash = [];
                for (let k = 0; k < arity; k++) {
                    const nodeIndex = j + k;
                    chunkToHash.push(nodeIndex < currentLevel.length ? currentLevel[nodeIndex] : currentEmptyNodeValue);
                }
                nextLevel.push(BigInt(hashFn(chunkToHash)));
            }
            currentLevel = nextLevel;
            const emptyChunkToHash = Array(arity).fill(currentEmptyNodeValue);
            currentEmptyNodeValue = BigInt(hashFn(emptyChunkToHash));
        }

        const calculatedRoot = currentLevel[0].toString();

        const configValues = manifest.configKeys.map(key => {
            if (key.toLowerCase().includes('root')) return calculatedRoot;
            const value = manifest.config[key];
            if (value === undefined || value === null) throw new Error(`CONFIG_ERROR: ${key}`);
            return value;
        });

        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const encodedConfig = abiCoder.encode(manifest.configABI, configValues);

        return { safeDataset, encodedConfig };
    }

    async resolve(manifest, userInputs, verifierAddress, provider, databaseURI) {
        const publicLeaves = await this.fetchDataset(databaseURI);
        const treeData = await this.buildClientTree(publicLeaves, manifest, userInputs);

        const formattedUserInputs = {};
        for (const key of (manifest.inputOrder || [])) {
            const schemaField = manifest.registrySchema?.find(f => f.name === key);
            formattedUserInputs[key] = this._formatInputToBigInt(userInputs[key], schemaField?.type).toString();
        }

        for (const [confKey, confValue] of Object.entries(manifest.config || {})) {
            if (confKey.toLowerCase().startsWith('min')) {
                const valKey = Object.keys(formattedUserInputs).find(k => manifest.registrySchema?.find(f => f.name === k)?.type === 'number');
                if (valKey && Number(userInputs[valKey]) < Number(confValue)) {
                    throw new Error(`INELIGIBLE: ${valKey} is below required ${confKey}`);
                }
            }
        }

        const allAvailableData = {
            ...userInputs,
            ...formattedUserInputs,
            ...manifest.config,
            pathElements: treeData.pathElements,
            pathIndices: treeData.pathIndices,
            merkleRoot: treeData.calculatedRoot,
            stateRoot: treeData.calculatedRoot,
            expectedMerkleRoot: treeData.calculatedRoot,
            root: treeData.calculatedRoot
        };

        let expectedSignals = manifest.circuitSignals;
        if (!expectedSignals) {
            console.warn("WARNING: manifest.circuitSignals is missing. Using heuristic fallback.");
            const rootName = manifest.configKeys?.find(k => k.toLowerCase().includes('root'))?.replace(/^expected/i, '') || 'merkleRoot';
            const circomRootKey = rootName.charAt(0).toLowerCase() + rootName.slice(1);
            expectedSignals = [circomRootKey, "pollId", "optionId", "pathElements", "pathIndices", ...Object.keys(formattedUserInputs), ...Object.keys(manifest.config || {})];
        }

        return this.sanitizeCircuitInputs(allAvailableData, expectedSignals);
    }

    async buildClientTree(publicLeaves, manifest, userInputs) {
        const depth = manifest.config.depth || 10;
        const arity = manifest.config.arity || 2;
        const hashFn = await this._getHashFunction(manifest.config.hashAlgorithm);

        const orderedInputs = this._prepareInputs(manifest, userInputs);
        const myLeaf = hashFn(orderedInputs).toString();

        let currentIndex = publicLeaves.findIndex(leaf => leaf.toString() === myLeaf);

        if (currentIndex === -1) {
            throw new Error("Your generated credential does not exist in the authorized registry.");
        }

        const pathElements = [];
        const pathIndices = [];
        let currentLevel = publicLeaves.map(l => BigInt(l));
        let currentEmptyNodeValue = BigInt(manifest.config.emptyNodeValue || "0");

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
                nextLevel.push(BigInt(hashFn(chunkToHash)));
            }
            currentLevel = nextLevel;
            currentIndex = chunkIndex;
            const emptyChunkToHash = Array(arity).fill(currentEmptyNodeValue);
            currentEmptyNodeValue = BigInt(hashFn(emptyChunkToHash));
        }

        return { pathElements, pathIndices, calculatedRoot: currentLevel[0].toString() };
    }
}