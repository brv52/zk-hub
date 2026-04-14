import { BaseStrategy } from "./BaseStrategy";
import { buildPoseidon } from "circomlibjs";
import { ethers } from "ethers";

export class ProofOfStorageStrategy extends BaseStrategy {

    async buildDatabase(manifest, rawDataset, isPreHashed = false) {
        const depth = manifest.config.depth || 10;
        const poseidon = await buildPoseidon();
        const F = poseidon.F;
        const hashFn = (a, b) => F.toObject(poseidon([a, b]));

        if (!manifest.registrySchema || manifest.registrySchema.length < 2) {
            throw new Error("Storage Proof requires at least 2 fields in registrySchema (Key and Value)");
        }
        const keyField = manifest.registrySchema[0].name;
        const valueField = manifest.registrySchema[1].name;

        const safeDataset = rawDataset.map((r) => {
            if (isPreHashed) {
                if (typeof r === "string" || typeof r === "number" || typeof r === "bigint") {
                    return r.toString();
                }

                return BigInt(r[keyField].toString().trim()).toString();
            }

            return hashFn(BigInt(r[keyField]), BigInt(r[valueField])).toString();
        });

        let currentLevel = safeDataset.map(hash => BigInt(hash));
        let emptyNode = BigInt(0);

        for (let i = 0; i < depth; i++) {
            const nextLevel = [];
            for (let j = 0; j < currentLevel.length; j += 2) {
                const left = currentLevel[j];
                const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : emptyNode;
                nextLevel.push(hashFn(left, right));
            }
            currentLevel = nextLevel;
            emptyNode = hashFn(emptyNode, emptyNode);
        }

        const calculatedRoot = currentLevel[0].toString();

        const configValues = manifest.configKeys.map(key => {
            if (key.toLowerCase().includes('root')) return calculatedRoot;
            if (manifest.config[key] !== undefined) return manifest.config[key];
            throw new Error(`CONFIG_ERROR: Missing key [${key}] in manifest config.`);
        });

        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const encodedConfig = abiCoder.encode(manifest.configABI, configValues);

        return { safeDataset, encodedConfig };
    }

    async resolve(manifest, userInputs, verifierAddress, provider, databaseURI) {
        const config = manifest.config || {};
        const storageState = await this.fetchDataset(databaseURI);

        const keyField = manifest.registrySchema[0].name;
        const valueField = manifest.registrySchema[1].name;

        const targetKeyStr = userInputs[keyField].toString();
        const targetValueStr = userInputs[valueField].toString();

        const poseidon = await buildPoseidon();
        const F = poseidon.F;
        const hashFn = (a, b) => F.toObject(poseidon([a, b]));

        const normalizedLeaves = storageState.map((leaf) => {
            if (typeof leaf === "string" || typeof leaf === "number" || typeof leaf === "bigint") {
                return leaf.toString();
            }

            if (leaf && typeof leaf === "object" && leaf[keyField] !== undefined && leaf[valueField] !== undefined) {
                return hashFn(BigInt(leaf[keyField]), BigInt(leaf[valueField])).toString();
            }

            throw new Error("Storage Proof: Invalid dataset format in DB.");
        });

        const myLeaf = hashFn(BigInt(targetKeyStr), BigInt(targetValueStr)).toString();
        const recordIndex = normalizedLeaves.findIndex(leaf => leaf === myLeaf);

        if (recordIndex === -1) throw new Error("Storage Proof: Credential not found in DB.");

        for (const [confKey, confValue] of Object.entries(config)) {
            const lowerConfKey = confKey.toLowerCase();
            if (lowerConfKey.startsWith('min') && Number(targetValueStr) < Number(confValue)) {
                throw new Error(`INELIGIBLE: ${valueField} is below required ${confKey}`);
            }
            if (lowerConfKey.startsWith('max') && Number(targetValueStr) > Number(confValue)) {
                throw new Error(`INELIGIBLE: ${valueField} exceeds allowed ${confKey}`);
            }
        }

        const treeData = await this.buildSMT(normalizedLeaves, recordIndex, config.depth || 10);

        const allAvailableData = {
            ...userInputs,
            ...config,
            pathElements: treeData.pathElements,
            pathIndices: treeData.pathIndices,
            stateRoot: treeData.calculatedRoot,
            merkleRoot: treeData.calculatedRoot,
            expectedStateRoot: treeData.calculatedRoot,
            root: treeData.calculatedRoot
        };

        let expectedSignals = manifest.circuitSignals;
        if (!expectedSignals) {
            console.warn("WARNING: manifest.circuitSignals is missing. Using heuristic fallback.");
            const rootName = manifest.configKeys?.find(k => k.toLowerCase().includes('root'))?.replace(/^expected/i, '') || 'stateRoot';
            const circomRootKey = rootName.charAt(0).toLowerCase() + rootName.slice(1);
            expectedSignals = [circomRootKey, "pollId", "optionId", "pathElements", "pathIndices", ...Object.keys(userInputs), ...Object.keys(config)];
        }

        return this.sanitizeCircuitInputs(allAvailableData, expectedSignals);
    }

    async buildSMT(storageState, targetIndex, depth) {
        const poseidon = await buildPoseidon();
        const F = poseidon.F;
        const hashFn = (a, b) => F.toObject(poseidon([a, b]));

        let currentLevel = storageState.map(leaf => BigInt(leaf));
        let currentIndex = targetIndex;

        const pathElements = [];
        const pathIndices = [];
        let emptyNode = BigInt(0);

        for (let i = 0; i < depth; i++) {
            const isRightNode = currentIndex % 2 !== 0;
            const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

            pathIndices.push(isRightNode ? 1 : 0);

            const siblingValue = siblingIndex < currentLevel.length ? currentLevel[siblingIndex] : emptyNode;
            pathElements.push(siblingValue.toString());

            const nextLevel = [];
            for (let j = 0; j < currentLevel.length; j += 2) {
                const left = currentLevel[j];
                const right = j + 1 < currentLevel.length ? currentLevel[j + 1] : emptyNode;
                nextLevel.push(hashFn(left, right));
            }

            currentLevel = nextLevel;
            currentIndex = Math.floor(currentIndex / 2);
            emptyNode = hashFn(emptyNode, emptyNode);
        }

        return { pathElements, pathIndices, calculatedRoot: currentLevel[0].toString() };
    }
}