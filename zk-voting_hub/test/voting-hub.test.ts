import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");
import path from "path";

describe("VotingHub & ZK Verifier Integration", function () {
    let votingHub: Contract;
    let baseVerifier: Contract;
    let kycVerifier: Contract; // Добавляем переменную для Враппера
    let owner: any;
    let user1: any;

    let savedA: any, savedB: any, savedC: any, savedPubInputs: any;
    const pollId = 0;
    const optionId = 1; 
    const minAge = 18; // Выносим наверх
    let merkleRoot: string; // Выносим наверх
    let pathElements: any[] = [];
    let pathIndices: any[] = [];
    let userSecret = 123456n;
    let userAge = 25;

    const wasmPath = path.join(__dirname, "../frontend/public/zk/circuit.wasm");
    const zkeyPath = path.join(__dirname, "../frontend/public/zk/circuit_final.zkey");

    before(async function () {
        [owner, user1] = await ethers.getSigners();

        // 1. Деплоим базовую математику
        const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
        baseVerifier = await VerifierFactory.deploy();
        await baseVerifier.waitForDeployment();

        // 2. Деплоим Хаб
        const HubFactory = await ethers.getContractFactory("VotingHub");
        votingHub = await HubFactory.deploy();
        await votingHub.waitForDeployment();

        // 3. ЗАРАНЕЕ вычисляем Merkle Root
        const poseidon = await circomlibjs.buildPoseidon();
        const F = poseidon.F;
        const treeDepth = 10;
        const maxLeaves = 2 ** treeDepth;

        const voters = [
            { secret: userSecret, age: userAge },
            { secret: 987654n, age: 20 }
        ];

        const leaves = voters.map(v => poseidon([v.secret, v.age]));
        const zeroHash = poseidon([0, 0]);

        while (leaves.length < maxLeaves) {
            leaves.push(zeroHash);
        }

        let currentLevel = leaves;
        let userIndex = 0;

        for (let i = 0; i < treeDepth; i++) {
            const nextLevel = [];
            const isRightNode = userIndex % 2 === 1;
            pathIndices.push(isRightNode ? 1 : 0);

            const siblingIndex = isRightNode ? userIndex - 1 : userIndex + 1;
            pathElements.push(F.toString(currentLevel[siblingIndex]));

            for (let j = 0; j < currentLevel.length; j += 2) {
                nextLevel.push(poseidon([currentLevel[j], currentLevel[j + 1]]));
            }

            currentLevel = nextLevel;
            userIndex = Math.floor(userIndex / 2);
        }

        merkleRoot = F.toString(currentLevel[0]);

        // 4. ДЕПЛОИМ ВРАППЕР с нужными параметрами опроса
        const baseVerifierAddress = await baseVerifier.getAddress();
        const KycVerifierFactory = await ethers.getContractFactory("KycPollVerifier");
        kycVerifier = await KycVerifierFactory.deploy(baseVerifierAddress, merkleRoot, minAge);
        await kycVerifier.waitForDeployment();
    });

    it("Should create a new poll", async function () {
        // ПЕРЕДАЕМ АДРЕС ВРАППЕРА, а не базового верификатора
        const kycVerifierAddress = await kycVerifier.getAddress();
        const tx = await votingHub.createPoll(
            kycVerifierAddress, 
            "Who should be the President?",
            ["Alice", "Bob"],
            "ipfs://metadata"
        );
        await tx.wait();

        const poll = await votingHub.polls(pollId);
        expect(poll.question).to.equal("Who should be the President?");
        expect(poll.verifierContract).to.equal(kycVerifierAddress);
    });

    it("Should cast a valid ZK vote", async function () {
        // Подготавливаем входы для схемы (Merkle Tree уже вычислено)
        const inputs = {
            userSecret: userSecret.toString(),
            userAge: userAge.toString(),
            pathElements: pathElements,
            pathIndices: pathIndices,
            merkleRoot: merkleRoot,
            pollId: pollId.toString(),
            minAge: minAge.toString()
        };

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath);
        
        const calldataBlob = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const argv = calldataBlob.replace(/["[\]\s]/g, "").split(",").map((x: string) => BigInt(x).toString());

        savedA = [argv[0], argv[1]];
        savedB = [[argv[2], argv[3]], [argv[4], argv[5]]];
        savedC = [argv[6], argv[7]];
        savedPubInputs = argv.slice(8);

        await expect(votingHub.connect(user1).vote(pollId, optionId, savedA, savedB, savedC, savedPubInputs))
            .to.emit(votingHub, "VoteCast")
            .withArgs(pollId, optionId);

        const bobVotes = await votingHub.getVotes(pollId, optionId);
        expect(bobVotes).to.equal(1n);
    });

    it("Should reject double voting with the same proof/nullifier", async function () {
        await expect(
            votingHub.connect(user1).vote(pollId, optionId, savedA, savedB, savedC, savedPubInputs)
        ).to.be.revertedWith("Double voting");
    });
});