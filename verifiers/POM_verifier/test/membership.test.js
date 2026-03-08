const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;
const { buildPoseidon } = require("circomlibjs");

const assert = chai.assert;
const expect = chai.expect;

describe("Membership ZK Circuit Tests", function () {
    let poseidon;
    let F;
    let circuit;

    const DEPTH = 10; 

    function generateMerkleProof(leaf, pathElements, pathIndices) {
        let currentHash = leaf;
        for (let i = 0; i < DEPTH; i++) {
            if (pathIndices[i] === 0) {
                currentHash = poseidon([currentHash, pathElements[i]]);
            } else {
                currentHash = poseidon([pathElements[i], currentHash]);
            }
        }
        return currentHash;
    }

    before(async () => {
        poseidon = await buildPoseidon();
        F = poseidon.F;
        
        circuit = await wasm_tester(path.join(__dirname, "../circuit", "membership.circom"),
                                    { include: path.join(__dirname, "../node_modules") });
    });

    describe("1. Valid User Flows (Happy Paths)", () => {
        it("Should generate a valid proof for a user older than the minimum age", async () => {
            const secret = 123456789n;
            const age = 25;
            const expectedMinAge = 18;
            const pollId = 1n;
            const optionId = 2n;

            const leaf = poseidon([secret, age]);

            const pathElements = new Array(DEPTH).fill(0n);
            const pathIndices = new Array(DEPTH).fill(0);

            const merkleRoot = F.toObject(generateMerkleProof(leaf, pathElements, pathIndices));

            const input = {
                merkleRoot,
                pollId,
                expectedMinAge,
                optionId,
                secret,
                age,
                pathElements,
                pathIndices
            };

            const witness = await circuit.calculateWitness(input, true);
            await circuit.checkConstraints(witness);
        });

        it("Should generate a valid proof for a user exactly at the minimum age (Boundary Check)", async () => {
            const secret = 987654321n;
            const age = 18;
            const expectedMinAge = 18;
            
            const leaf = poseidon([secret, age]);
            const pathElements = new Array(DEPTH).fill(1n);
            const pathIndices = new Array(DEPTH).fill(1);
            const merkleRoot = F.toObject(generateMerkleProof(leaf, pathElements, pathIndices));

            const input = {
                merkleRoot,
                pollId: 1n,
                expectedMinAge,
                optionId: 1n,
                secret,
                age,
                pathElements,
                pathIndices
            };

            const witness = await circuit.calculateWitness(input, true);
            await circuit.checkConstraints(witness);
        });
    });

    describe("2. Tricky Edge Cases & Unauthorized Access", () => {
        it("Should FAIL if the user is underage", async () => {
            const secret = 1111n;
            const age = 17;
            const expectedMinAge = 18;
            
            const leaf = poseidon([secret, age]);
            const pathElements = new Array(DEPTH).fill(0n);
            const pathIndices = new Array(DEPTH).fill(0);
            const merkleRoot = F.toObject(generateMerkleProof(leaf, pathElements, pathIndices));

            const input = {
                merkleRoot, pollId: 1n, expectedMinAge, optionId: 1n,
                secret, age, pathElements, pathIndices
            };

            try {
                await circuit.calculateWitness(input, true);
                assert.fail("Should have thrown an error due to underage");
            } catch (err) {
                expect(err.message).to.include("Assert Failed");
            }
        });

        it("Should FAIL if the Merkle path is invalid (fake sibling)", async () => {
            const secret = 2222n;
            const leaf = poseidon([secret, 20]);
            const pathElements = new Array(DEPTH).fill(0n);
            const pathIndices = new Array(DEPTH).fill(0);
            
            const correctMerkleRoot = F.toObject(generateMerkleProof(leaf, pathElements, pathIndices));

            const tamperedPathElements = [...pathElements];
            tamperedPathElements[5] = 999n; 

            const input = {
                merkleRoot: correctMerkleRoot, pollId: 1n, expectedMinAge: 18, optionId: 1n,
                secret, age: 20, pathElements: tamperedPathElements, pathIndices
            };

            try {
                await circuit.calculateWitness(input, true);
                assert.fail("Should have thrown an error due to invalid path elements");
            } catch (err) {
                expect(err.message).to.include("Assert Failed");
            }
        });

        it("Should FAIL if a non-binary index is provided for pathIndices", async () => {
            const secret = 3333n;
            const leaf = poseidon([secret, 25]);
            const pathElements = new Array(DEPTH).fill(0n);
            const pathIndices = new Array(DEPTH).fill(0);
            const merkleRoot = F.toObject(generateMerkleProof(leaf, pathElements, pathIndices));

            const tamperedIndices = [...pathIndices];
            tamperedIndices[0] = 2;

            const input = {
                merkleRoot, pollId: 1n, expectedMinAge: 18, optionId: 1n,
                secret, age: 25, pathElements, pathIndices: tamperedIndices
            };

            try {
                await circuit.calculateWitness(input, true);
                assert.fail("Should have thrown an error due to non-binary path index");
            } catch (err) {
                expect(err.message).to.include("Assert Failed");
            }
        });

        it("Should FAIL if age exceeds 8-bit allocation (overflow attempt)", async () => {
            const secret = 4444n;
            const age = 256;
            const expectedMinAge = 18;
            
            const leaf = poseidon([secret, age]);
            const pathElements = new Array(DEPTH).fill(0n);
            const pathIndices = new Array(DEPTH).fill(0);
            const merkleRoot = F.toObject(generateMerkleProof(leaf, pathElements, pathIndices));

            const input = {
                merkleRoot, pollId: 1n, expectedMinAge, optionId: 1n,
                secret, age, pathElements, pathIndices
            };

            try {
                await circuit.calculateWitness(input, true);
                assert.fail("Should have thrown an error due to bit-length overflow in GreaterEqThan");
            } catch (err) {
                expect(err.message).to.include("Assert Failed");
            }
        });
    });

    describe("3. Output Verification", () => {
        it("Should generate the correct nullifier hash", async () => {
            const secret = 5555n;
            const pollId = 99n;
            
            const leaf = poseidon([secret, 25]);
            const pathElements = new Array(DEPTH).fill(0n);
            const pathIndices = new Array(DEPTH).fill(0);
            const merkleRoot = F.toObject(generateMerkleProof(leaf, pathElements, pathIndices));

            const input = {
                merkleRoot, pollId, expectedMinAge: 18, optionId: 1n,
                secret, age: 25, pathElements, pathIndices
            };

            const witness = await circuit.calculateWitness(input, true);
            
            const expectedNullifier = F.toObject(poseidon([secret, pollId]));
            
            await circuit.assertOut(witness, { nullifier: expectedNullifier });
        });
    });
});