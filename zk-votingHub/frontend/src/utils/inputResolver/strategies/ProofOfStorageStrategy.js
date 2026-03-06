import { BaseStrategy } from "./BaseStrategy";
import { buildPoseidon } from "circomlibjs";

export class ProofOfStorageStrategy extends BaseStrategy {
    async resolve(manifest, userInputs, verifierAddress, provider) {
        const config = manifest.config || {};
        const resolvedInputs = { ...userInputs, ...config };

        const storageState = await this.fetchDataset(config.storageURI);
        
        const targetSlot = userInputs.slot;
        const targetValue = userInputs.value;
        const recordIndex = storageState.findIndex(r => r.slot == targetSlot && r.value == targetValue);
        
        if (recordIndex === -1) throw new Error("Storage Proof: Slot and Value not found in State Root DB.");

        const treeData = await this.buildSMT(storageState, recordIndex, config.depth || 10);

        resolvedInputs.slot = targetSlot.toString();
        resolvedInputs.value = targetValue.toString();
        resolvedInputs.pathElements = treeData.pathElements;
        resolvedInputs.pathIndices = treeData.pathIndices;
        resolvedInputs.stateRoot = treeData.calculatedRoot;

        delete resolvedInputs.storageURI;
        delete resolvedInputs.depth;
        delete resolvedInputs.pollId;

        return resolvedInputs;
    }

    async fetchDataset(uri) {
        const url = uri.startsWith("ipfs://") ? uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/") : uri;
        const res = await fetch(url);
        return await res.json();
    }

    async buildSMT(storageState, targetIndex, depth) {
        const poseidon = await buildPoseidon();
        const F = poseidon.F;
        const hashFn = (a, b) => F.toObject(poseidon([a, b]));

        let currentLevel = storageState.map(r => hashFn(BigInt(r.slot), BigInt(r.value)));
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