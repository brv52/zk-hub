const chai = require("chai");
const path = require("path");
const wasm_tester = require("circom_tester").wasm;
const { buildPoseidon } = require("circomlibjs");

const assert = chai.assert;
const expect = chai.expect;

describe("StorageProof ZK Circuit Tests", function () {
    let poseidon;
    let F;
    let circuit;

    const DEPTH = 10; 

    function generateStateRoot(leaf, pathElements, pathIndices) {
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
        
        circuit = await wasm_tester(path.join(__dirname, "../circuit", "StorageProof.circom"),
                                    { include: path.join(__dirname, "../node_modules") });
    });

    describe("1. Valid User Flows (Happy Paths)", () => {
        it("Should generate a valid proof for a correct storage slot and value", async () => {
            const slot = 5n;
            const value = 1000n;
            const optionId = 42n;

            const leaf = poseidon([slot, value]);

            const pathElements = new Array(DEPTH).fill(12345n);
            const pathIndices = new Array(DEPTH).fill(0);

            const stateRoot = F.toObject(generateStateRoot(leaf, pathElements, pathIndices));

            const input = {
                slot,
                value,
                pathElements,
                pathIndices,
                optionId,
                stateRoot,
                pollId: 1n
            };

            const witness = await circuit.calculateWitness(input, true);
            await circuit.checkConstraints(witness);
        });
    });

    describe("2. Invalid Inputs & Data Integrity", () => {
        it("Should FAIL if an incorrect value is provided for the slot", async () => {
            const slot = 5n;
            const correctValue = 1000n;
            const fakeValue = 9999n;

            const leaf = poseidon([slot, correctValue]);
            const pathElements = new Array(DEPTH).fill(12345n);
            const pathIndices = new Array(DEPTH).fill(0);
            
            const stateRoot = F.toObject(generateStateRoot(leaf, pathElements, pathIndices));

            const input = {
                slot,
                value: fakeValue,
                pathElements,
                pathIndices,
                optionId: 42n,
                stateRoot,
                pollId: 1n
            };

            try {
                await circuit.calculateWitness(input, true);
                assert.fail("Should have thrown an error due to stateRoot mismatch");
            } catch (err) {
                expect(err.message).to.include("Assert Failed");
            }
        });

        it("Should FAIL if the Merkle path elements are tampered with", async () => {
            const slot = 5n;
            const value = 1000n;

            const leaf = poseidon([slot, value]);
            const pathElements = new Array(DEPTH).fill(12345n);
            const pathIndices = new Array(DEPTH).fill(0);
            
            const stateRoot = F.toObject(generateStateRoot(leaf, pathElements, pathIndices));

            const tamperedPathElements = [...pathElements];
            tamperedPathElements[3] = 88888n; 

            const input = {
                slot,
                value,
                pathElements: tamperedPathElements,
                pathIndices,
                optionId: 42n,
                stateRoot,
                pollId: 1n
            };

            try {
                await circuit.calculateWitness(input, true);
                assert.fail("Should have thrown an error due to invalid path elements");
            } catch (err) {
                expect(err.message).to.include("Assert Failed");
            }
        });
    });

    describe("3. Circuit Soundness & Vulnerability Checks", () => {
        it("Should FAIL if a non-binary index is provided for pathIndices", async () => {
            const slot = 5n;
            const value = 1000n;

            const leaf = poseidon([slot, value]);
            const pathElements = new Array(DEPTH).fill(12345n);
            const pathIndices = new Array(DEPTH).fill(0);
            const stateRoot = F.toObject(generateStateRoot(leaf, pathElements, pathIndices));

            const tamperedIndices = [...pathIndices];
            tamperedIndices[0] = 2;

            const input = {
                slot,
                value,
                pathElements,
                pathIndices: tamperedIndices,
                optionId: 42n,
                stateRoot,
                pollId: 1n
            };

            try {
                await circuit.calculateWitness(input, true);
                assert.fail("Circuit is vulnerable! It allowed a non-binary path index. Add pathIndices[i] * (1 - pathIndices[i]) === 0 to fix this.");
            } catch (err) {
                expect(err.message).to.include("Assert Failed");
            }
        });
    });
});