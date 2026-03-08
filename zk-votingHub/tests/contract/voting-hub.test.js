const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("VotingHub Production Security Suite", function () {
    const ORGANIZER_ROLE = ethers.id("ORGANIZER_ROLE");
    const GAS_CREDIT = ethers.parseEther("0.0005");
    const INITIAL_FUNDING = ethers.parseEther("0.1");

    async function deployHubFixture() {
        const [admin, organizer, voter, attacker, forwarder] = await ethers.getSigners();

        // 1. Deploy Mocks
        const ForwarderFactory = await ethers.getContractFactory("MockForwarder");
        const mockForwarder = await ForwarderFactory.deploy();

        const VerifierFactory = await ethers.getContractFactory("MockVerifier");
        const mockVerifier = await VerifierFactory.deploy();

        // 2. Deploy VotingHub
        const VotingHub = await ethers.getContractFactory("VotingHub");
        const votingHub = await VotingHub.deploy(await mockForwarder.getAddress());

        // 3. Setup Roles
        await votingHub.grantRole(ORGANIZER_ROLE, organizer.address);

        return { votingHub, mockVerifier, mockForwarder, admin, organizer, voter, attacker, forwarder };
    }

    describe("I. Deployment & Configuration", function () {
        it("Should initialize with correct constants and roles", async function () {
            const { votingHub, admin } = await loadFixture(deployHubFixture);
            expect(await votingHub.GAS_CREDIT_PER_VOTE()).to.equal(GAS_CREDIT);
            expect(await votingHub.hasRole(ethers.ZeroHash, admin.address)).to.be.true;
        });

        it("Should allow admin to update the forwarder", async function () {
            const { votingHub, admin, attacker } = await loadFixture(deployHubFixture);
            const newForwarder = ethers.Wallet.createRandom().address;
            
            await expect(votingHub.connect(admin).updateForwarder(newForwarder))
                .to.emit(votingHub, "ForwarderUpdated").withArgs(newForwarder);
            
            expect(await votingHub.isTrustedForwarder(newForwarder)).to.be.true;
        });
    });

    describe("II. Poll Lifecycle & Access Control", function () {
        it("Should allow Organizer to create a poll but block Attacker", async function () {
            const { votingHub, organizer, attacker, mockVerifier } = await loadFixture(deployHubFixture);
            await expect(votingHub.connect(organizer).createPoll(await mockVerifier.getAddress(), "Q?", ["A", "B"], "ipfs://", 3600, false)).to.emit(votingHub, "PollCreated");
            await expect(votingHub.connect(attacker).createPoll(await mockVerifier.getAddress(), "S?", ["A", "B"], "ipfs://", 3600, false)).to.be.revertedWithCustomError(votingHub, "AccessControlUnauthorizedAccount");
        });
    });

    describe("III. The Gas Credit Economy (Sponsorship)", function () {
        it("Should accumulate gas deposits and emit GasFunded", async function () {
            const { votingHub, organizer, mockVerifier } = await loadFixture(deployHubFixture);
            await votingHub.connect(organizer).createPoll(await mockVerifier.getAddress(), "Q", ["A", "B"], "U", 3600, true);
            await expect(votingHub.fundPollGas(0, { value: INITIAL_FUNDING })).to.emit(votingHub, "GasFunded").withArgs(0, INITIAL_FUNDING);
            expect(await votingHub.pollGasBalances(0)).to.equal(INITIAL_FUNDING);
        });

        it("Should deduct exactly 0.0005 ETH per vote", async function () {
            const { votingHub, organizer, voter, mockVerifier } = await loadFixture(deployHubFixture);
            await votingHub.connect(organizer).createPoll(await mockVerifier.getAddress(), "Q", ["A", "B"], "U", 3600, true);
            await votingHub.fundPollGas(0, { value: INITIAL_FUNDING });
            const proof = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint256[]"], [[0,0], [[0,0],[0,0]], [0,0], [ethers.ZeroHash, 0, 0, 0]]);
            await votingHub.connect(voter).vote(0, 0, proof);
            expect(await votingHub.pollGasBalances(0)).to.equal(INITIAL_FUNDING - GAS_CREDIT);
        });

        it("Should fail when insolvent", async function () {
            const { votingHub, organizer, voter, mockVerifier } = await loadFixture(deployHubFixture);
            await votingHub.connect(organizer).createPoll(await mockVerifier.getAddress(), "Q", ["A", "B"], "U", 3600, true);
            const proof = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint256[]"], [[0,0], [[0,0],[0,0]], [0,0], [ethers.id("n1"), 0, 0, 0]]);
            await expect(votingHub.connect(voter).vote(0, 0, proof)).to.be.revertedWith("INSOLVENT: Reservoir empty");
        });
    });

    describe("IV. ZK-Voting & Administrative", function () {
        it("Should block double-voting", async function () {
            const { votingHub, organizer, voter, mockVerifier } = await loadFixture(deployHubFixture);
            await votingHub.connect(organizer).createPoll(await mockVerifier.getAddress(), "Q", ["A", "B"], "U", 3600, false);
            const proof = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint256[]"], [[0,0], [[0,0],[0,0]], [0,0], [ethers.id("n1"), 0, 0, 0]]);
            await votingHub.connect(voter).vote(0, 0, proof);
            await expect(votingHub.connect(voter).vote(0, 0, proof)).to.be.revertedWith("Already voted");
        });

        it("Should allow Admin to withdraw protocol profits", async function () {
            const { votingHub, admin, organizer, mockVerifier } = await loadFixture(deployHubFixture);
            await votingHub.connect(organizer).createPoll(await mockVerifier.getAddress(), "Q", ["A", "B"], "U", 3600, true);
            await votingHub.fundPollGas(0, { value: INITIAL_FUNDING });
            const initialBalance = await ethers.provider.getBalance(admin.address);
            await votingHub.connect(admin).withdrawFunds(INITIAL_FUNDING, admin.address);
            expect(await ethers.provider.getBalance(admin.address)).to.be.gt(initialBalance);
        });
    });

    describe("V. Meta-Transactions", function () {
        it("Should resolve sender via forwarder", async function () {
            const { votingHub, organizer, voter, mockForwarder, mockVerifier } = await loadFixture(deployHubFixture);
            await votingHub.connect(organizer).createPoll(await mockVerifier.getAddress(), "Q", ["A", "B"], "U", 3600, false);
            const proof = ethers.AbiCoder.defaultAbiCoder().encode(["uint[2]", "uint[2][2]", "uint[2]", "uint256[]"], [[0,0], [[0,0],[0,0]], [0,0], [ethers.id("mtx"), 0, 0, 0]]);
            const data = votingHub.interface.encodeFunctionData("vote", [0, 0, proof]);
            await expect(mockForwarder.connect(voter).execute(await votingHub.getAddress(), data)).to.not.be.reverted;
            expect(await votingHub.getVotes(0, 0)).to.equal(1);
        });
    });
});