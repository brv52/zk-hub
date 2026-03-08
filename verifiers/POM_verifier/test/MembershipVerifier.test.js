const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MembershipVerifier Smart Contract", function () {
    let mockVerifier;
    let membershipVerifier;
    let owner;
    let attacker;

    const INITIAL_ROOT = ethers.id("MOCK_ROOT");
    const MIN_AGE = 18n;

    function generateDummyProofData(clientNullifier) {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        return abiCoder.encode(
            ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[]"],
            [
                [0n, 0n],
                [[0n, 0n], [0n, 0n]],
                [0n, 0n],
                [clientNullifier]
            ]
        );
    }

    beforeEach(async function () {
        [owner, attacker] = await ethers.getSigners();

        const MockVerifierFactory = await ethers.getContractFactory("MockGroth16Verifier");
        mockVerifier = await MockVerifierFactory.deploy();

        const MembershipVerifierFactory = await ethers.getContractFactory("MembershipVerifier");
        membershipVerifier = await MembershipVerifierFactory.deploy(
            await mockVerifier.getAddress(),
            INITIAL_ROOT,
            MIN_AGE
        );
    });

    describe("1. Deployment & Initial State", function () {
        it("Should set the correct initial state variables", async function () {
            expect(await membershipVerifier.expectedMerkleRoot()).to.equal(INITIAL_ROOT);
            expect(await membershipVerifier.expectedMinAge()).to.equal(MIN_AGE);
            expect(await membershipVerifier.groth16Verifier()).to.equal(await mockVerifier.getAddress());
        });
    });

    describe("2. Valid Verification (Happy Path)", function () {
        it("Should successfully verify a valid proof and return the nullifier", async function () {
            const pollId = 1n;
            const optionId = 2n;
            const clientNullifier = 123456789n; 
            
            const proofData = generateDummyProofData(clientNullifier);

            const [isValid, nullifier] = await membershipVerifier.verifyProof(pollId, optionId, proofData);

            expect(isValid).to.be.true;
            expect(nullifier).to.equal(ethers.toBeHex(clientNullifier, 32));
        });
    });

    describe("3. Invalid Proofs & Reverts (Edge Cases)", function () {
        it("Should REVERT if the underlying Groth16 verifier returns false", async function () {
            await mockVerifier.setShouldPass(false);

            const pollId = 1n;
            const optionId = 2n;
            const proofData = generateDummyProofData(999n);

            await expect(
                membershipVerifier.verifyProof(pollId, optionId, proofData)
            ).to.be.revertedWith("Invalid ZK Proof: Option mismatch or bad math");
        });

        it("Should REVERT if proofData is totally malformed", async function () {
            const pollId = 1n;
            const optionId = 2n;
            const malformedData = ethers.hexlify(ethers.randomBytes(32));

            await expect(
                membershipVerifier.verifyProof(pollId, optionId, malformedData)
            ).to.be.reverted; 
        });

        it("Should REVERT if decodedSignals array is empty", async function () {
            const pollId = 1n;
            const optionId = 2n;
            
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const badProofData = abiCoder.encode(
                ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[]"],
                [[0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], []]
            );

            await expect(
                membershipVerifier.verifyProof(pollId, optionId, badProofData)
            ).to.be.revertedWith("Invalid public signals length");
        });
    });
});