import { describe, test, expect, beforeAll, vi } from 'vitest';
import { buildPoseidon, buildMimc7 } from "circomlibjs";
import { ProofOfMembershipStrategy } from "../strategies/ProofOfMembershipStrategy"; 

describe("ProofOfMembershipStrategy - Universal Merkle Tree Builder", () => {
    let strategy;
    let poseidonFn;
    let mimc7Fn;

    beforeAll(async () => {
        strategy = new ProofOfMembershipStrategy();
        
        const poseidon = await buildPoseidon();
        poseidonFn = (arr) => poseidon.F.toObject(poseidon(arr)).toString();

        const mimc7 = await buildMimc7();
        mimc7Fn = (arr) => mimc7.F.toObject(mimc7.multiHash(arr)).toString();
        
        strategy.fetchDataset = vi.fn();
    });

    test("1. Standard Binary Tree (Poseidon, Depth 2)", async () => {
        const userInputs = { secret: "123", age: "25" };
        const manifest = {
            inputOrder: ["secret", "age"],
            config: { depth: 2, arity: 2, hashAlgorithm: "poseidon" }
        };

        const leaves = [
            poseidonFn([123n, 25n]),
            poseidonFn([456n, 30n]), 
            poseidonFn([789n, 40n]), 
            poseidonFn([999n, 50n])
        ];
        
        strategy.fetchDataset.mockResolvedValueOnce(leaves);
        const treeData = await strategy.resolve(manifest, userInputs);

        expect(treeData.pathElements.length).toBe(2);
        expect(treeData.pathIndices).toEqual([0, 0]);

        const level1Left = poseidonFn([BigInt(leaves[0]), BigInt(leaves[1])]);
        const level1Right = poseidonFn([BigInt(leaves[2]), BigInt(leaves[3])]);
        const expectedRoot = poseidonFn([BigInt(level1Left), BigInt(level1Right)]);

        expect(treeData.merkleRoot).toBe(expectedRoot);
    });

    test("2. N-ary Tree (Poseidon, Arity 3, Depth 2)", async () => {
        const userInputs = { secret: "777", age: "18" };
        const manifest = {
            inputOrder: ["secret", "age"],
            config: { depth: 2, arity: 3, hashAlgorithm: "poseidon" }
        };

        const myLeaf = poseidonFn([777n, 18n]);
        const leaves = Array(9).fill("100"); 
        leaves[4] = myLeaf;

        strategy.fetchDataset.mockResolvedValueOnce(leaves);
        const treeData = await strategy.resolve(manifest, userInputs);

        expect(treeData.pathElements.length).toBe(2);
        
        expect(Array.isArray(treeData.pathElements[0])).toBe(true);
        expect(treeData.pathElements[0].length).toBe(2);
        
        expect(treeData.pathIndices[0]).toBe(1); 
    });

    test("3. Binary Tree with MiMC7 Hashing", async () => {
        const userInputs = { secret: "555", age: "33" };
        const manifest = {
            inputOrder: ["secret", "age"],
            config: { depth: 1, arity: 2, hashAlgorithm: "mimc7" }
        };

        const leaves = [
            mimc7Fn([555n, 33n]),
            mimc7Fn([999n, 44n])
        ];

        strategy.fetchDataset.mockResolvedValueOnce(leaves);
        const treeData = await strategy.resolve(manifest, userInputs);

        const expectedRoot = mimc7Fn([BigInt(leaves[0]), BigInt(leaves[1])]);
        
        expect(treeData.pathElements.length).toBe(1);
        expect(treeData.merkleRoot).toBe(expectedRoot);
    });

    test("4. Unbalanced Tree with Custom Empty Node Padding", async () => {
        const userInputs = { secret: "111", age: "20" };
        const manifest = {
            inputOrder: ["secret", "age"],
            config: { depth: 2, arity: 2, emptyNodeValue: "9999", hashAlgorithm: "poseidon" } 
        };

        const myLeaf = poseidonFn([111n, 20n]);
        const leaves = [myLeaf, poseidonFn([222n, 21n])]; 

        strategy.fetchDataset.mockResolvedValueOnce(leaves);
        const treeData = await strategy.resolve(manifest, userInputs);

        const level1Node1 = poseidonFn([BigInt(leaves[0]), BigInt(leaves[1])]);
        const level1Node2 = poseidonFn([9999n, 9999n]);
        const expectedRoot = poseidonFn([BigInt(level1Node1), BigInt(level1Node2)]);

        expect(treeData.merkleRoot).toBe(expectedRoot);
    });

    test("5. Input Ordering Resilience", async () => {
        const manifest = {
            inputOrder: ["secret", "age"],
            config: { depth: 1, arity: 2, hashAlgorithm: "poseidon" }
        };

        const myLeaf = poseidonFn([123n, 45n]);
        const leaves = [myLeaf, poseidonFn([999n, 99n])];

        const userInputsUI = { age: "45", secret: "123" };

        strategy.fetchDataset.mockResolvedValueOnce(leaves);
        const treeData = await strategy.resolve(manifest, userInputsUI);
        
        expect(treeData.pathIndices[0]).toBe(0); 
    });

    test("6. Error: Missing Required User Inputs", async () => {
        const userInputs = { secret: "123" };
        const manifest = {
            inputOrder: ["secret", "age"],
            config: { depth: 2, arity: 2 }
        };

        await expect(strategy.resolve(manifest, userInputs))
            .rejects
            .toThrow("ProofOfMembership Error: Inputs from manifest do not match User Inputs");
    });

    test("7. Error: User Not Found in Public Dataset", async () => {
        const userInputs = { secret: "999", age: "99" };
        const manifest = {
            inputOrder: ["secret", "age"],
            config: { depth: 2, arity: 2, hashAlgorithm: "poseidon" }
        };

        const leaves = [poseidonFn([1n, 1n]), poseidonFn([2n, 2n])];

        strategy.fetchDataset.mockResolvedValueOnce(leaves);
        await expect(strategy.resolve(manifest, userInputs))
            .rejects
            .toThrow("Your generated credential does not exist in the authorized registry.");
    });

    test("8. Error: Unsupported Hash Algorithm", async () => {
        const userInputs = { secret: "123", age: "25" };
        const manifest = {
            inputOrder: ["secret", "age"],
            config: { depth: 2, arity: 2, hashAlgorithm: "sha256" }
        };

        strategy.fetchDataset.mockResolvedValueOnce(["123"]);
        await expect(strategy.resolve(manifest, userInputs))
            .rejects
            .toThrow("Unsupported hash algorithm: sha256");
    });
});