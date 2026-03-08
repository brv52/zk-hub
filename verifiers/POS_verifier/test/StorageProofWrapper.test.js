const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StorageProofWrapper Smart Contract", function () {
    let mockVerifier;
    let storageProofWrapper;
    let owner;

    const EXPECTED_STATE_ROOT = 88888888n;

    function generateProofData(pubSignalsArray) {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        return abiCoder.encode(
            ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[]"],
            [
                [0n, 0n],
                [[0n, 0n], [0n, 0n]],
                [0n, 0n],
                pubSignalsArray
            ]
        );
    }

    beforeEach(async function () {
        [owner] = await ethers.getSigners();

        const MockVerifierFactory = await ethers.getContractFactory("MockGroth16Verifier4");
        mockVerifier = await MockVerifierFactory.deploy();

        const StorageWrapperFactory = await ethers.getContractFactory("StorageProofWrapper");
        storageProofWrapper = await StorageWrapperFactory.deploy(
            await mockVerifier.getAddress(),
            EXPECTED_STATE_ROOT
        );
    });

    describe("1. Deployment & Initial State", function () {
        it("Should set the correct expected state root and verifier address", async function () {
            expect(await storageProofWrapper.expectedStateRoot()).to.equal(EXPECTED_STATE_ROOT);
            expect(await storageProofWrapper.groth16Verifier()).to.equal(await mockVerifier.getAddress());
        });
    });

    describe("2. Valid Verification (Contract Logic Happy Path)", function () {
        it("Should verify a valid proof and return the slot as a nullifier", async function () {
            const slot = 42n;
            const optionId = 1n;
            const pollId = 1n;
            const dummyNullifier = 99999n;
            
            const proofData = generateProofData([dummyNullifier, EXPECTED_STATE_ROOT, pollId, optionId]);

            const [isValid, nullifier] = await storageProofWrapper.verifyProof(pollId, optionId, proofData);

            expect(isValid).to.be.true;
            expect(nullifier).to.equal(ethers.toBeHex(dummyNullifier, 32));
        });
    });

    describe("3. Invalid Inputs & Reverts (Edge Cases)", function () {
        it("Should REVERT if the state root does not match the expected snapshot", async function () {
        const optionId = 1n;
        const pollId = 1n;
        const dummyNullifier = 99999n;
        const outdatedStateRoot = 11111111n; 
        
        const proofData = generateProofData([dummyNullifier, outdatedStateRoot, pollId, optionId]);

        await expect(
            storageProofWrapper.verifyProof(pollId, optionId, proofData)
            ).to.be.revertedWith("StorageProof: Invalid State Root Snapshot");
        });

        it("Should REVERT if the underlying ZK proof is mathematically invalid", async function () {
            await mockVerifier.setShouldPass(false); 

            const optionId = 1n;
            const pollId = 1n;
            const dummyNullifier = 99999n;
            
            const proofData = generateProofData([dummyNullifier, EXPECTED_STATE_ROOT, pollId, optionId]);

            await expect(
                storageProofWrapper.verifyProof(pollId, optionId, proofData)
            ).to.be.revertedWith("StorageProof: Cryptographic proof is invalid or option mismatch");
        });

        it("Should REVERT if proofData is missing public signals", async function () {
            const optionId = 1n;
            const proofData = generateProofData([42n]); 

            await expect(
                storageProofWrapper.verifyProof(1n, optionId, proofData)
            ).to.be.revertedWith("StorageProof: Invalid signals count");
        });
    });
});