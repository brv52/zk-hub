import { BaseStrategy } from "./BaseStrategy";
import { buildPoseidon } from "circomlibjs";
import { ethers } from "ethers";

export class ProofOfStorageStrategy extends BaseStrategy {

    async buildDatabase(manifest, rawDataset) {
        const depth = manifest.config.depth || 10;
        const poseidon = await buildPoseidon();
        const F = poseidon.F;
        const hashFn = (a, b) => F.toObject(poseidon([a, b]));

        if (!manifest.registrySchema || manifest.registrySchema.length < 2) {
            throw new Error("Storage Proof requires at least 2 fields in registrySchema (Key and Value)");
        }
        const keyField = manifest.registrySchema[0].name;
        const valueField = manifest.registrySchema[1].name;

        let currentLevel = rawDataset.map(r => hashFn(BigInt(r[keyField]), BigInt(r[valueField])));
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

        return { safeDataset: rawDataset, encodedConfig };
    }

    async resolve(manifest, userInputs, verifierAddress, provider, databaseURI) {
        const config = manifest.config || {};
        const storageState = await this.fetchDataset(databaseURI);

        const keyField = manifest.registrySchema[0].name;
        const valueField = manifest.registrySchema[1].name;

        const targetKeyStr = userInputs[keyField].toString();
        const targetValueStr = userInputs[valueField].toString();

        const recordIndex = storageState.findIndex(r =>
            r[keyField].toString() === targetKeyStr &&
            r[valueField].toString() === targetValueStr
        );

        if (recordIndex === -1) throw new Error(`Storage Proof: [${keyField}] and [${valueField}] not found in DB.`);

        for (const [confKey, confValue] of Object.entries(config)) {
            const lowerConfKey = confKey.toLowerCase();
            if (lowerConfKey.startsWith('min') && Number(targetValueStr) < Number(confValue)) {
                throw new Error(`INELIGIBLE: ${valueField} is below required ${confKey}`);
            }
            if (lowerConfKey.startsWith('max') && Number(targetValueStr) > Number(confValue)) {
                throw new Error(`INELIGIBLE: ${valueField} exceeds allowed ${confKey}`);
            }
        }

        const treeData = await this.buildSMT(storageState, recordIndex, config.depth || 10, keyField, valueField);

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

    async buildSMT(storageState, targetIndex, depth, keyField, valueField) {
        const poseidon = await buildPoseidon();
        const F = poseidon.F;
        const hashFn = (a, b) => F.toObject(poseidon([a, b]));

        let currentLevel = storageState.map(r => hashFn(BigInt(r[keyField]), BigInt(r[valueField])));
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