const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("VotingHub Production Security Suite", function () {
    const ORGANIZER_ROLE = ethers.id("ORGANIZER_ROLE");
    const INITIAL_FUNDING = ethers.parseEther("0.1");
    const EMPTY_BYTES = "0x";

    async function deployHubFixture() {
        const [admin, organizer, voter, attacker] = await ethers.getSigners();

        const VerifierFactory = await ethers.getContractFactory("MockVerifier");
        const mockVerifier = await VerifierFactory.deploy();

        const ForwarderFactory = await ethers.getContractFactory("MockForwarder");
        const mockForwarder = await ForwarderFactory.deploy();

        const VotingHub = await ethers.getContractFactory("VotingHub");
        const votingHub = await VotingHub.deploy();

        await votingHub.grantRole(ORGANIZER_ROLE, organizer.address);

        return { votingHub, mockVerifier, mockForwarder, admin, organizer, voter, attacker };
    }

    describe("I. Deployment & Configuration", function () {
        it("Should initialize with correct roles granted to deployer", async function () {
            const { votingHub, admin } = await loadFixture(deployHubFixture);

            expect(await votingHub.hasRole(ethers.ZeroHash, admin.address)).to.be.true;
            expect(await votingHub.hasRole(ORGANIZER_ROLE, admin.address)).to.be.true;
        });
    });

    describe("II. Poll Lifecycle & Access Control", function () {
        it("Should allow Organizer to create a poll and emit event", async function () {
            const { votingHub, organizer, mockVerifier } = await loadFixture(deployHubFixture);
            const verifierAddr = await mockVerifier.getAddress();

            await expect(
                votingHub.connect(organizer).createPoll(
                    verifierAddr, EMPTY_BYTES, "Question?", ["A", "B"], "ipfs://meta", "ipfs://db", 3600, false
                )
            )
                .to.emit(votingHub, "PollCreated")
                .withArgs(0, organizer.address, verifierAddr, false);

            const options = await votingHub.getOptions(0);
            expect(options).to.deep.equal(["A", "B"]);
        });

        it("Should block Attacker from creating a poll", async function () {
            const { votingHub, attacker, mockVerifier } = await loadFixture(deployHubFixture);

            await expect(
                votingHub.connect(attacker).createPoll(
                    await mockVerifier.getAddress(), EMPTY_BYTES, "Q?", ["A", "B"], "", "", 3600, false
                )
            ).to.be.revertedWithCustomError(votingHub, "AccessControlUnauthorizedAccount");
        });
    });

    describe("III. The Gas Credit Economy (Sponsorship)", function () {
        it("Should accumulate gas deposits and emit GasFunded", async function () {
            const { votingHub, organizer, mockVerifier } = await loadFixture(deployHubFixture);
            await votingHub.connect(organizer).createPoll(
                await mockVerifier.getAddress(), EMPTY_BYTES, "Q", ["A", "B"], "", "", 3600, true
            );

            await expect(votingHub.fundPollGas(0, { value: INITIAL_FUNDING }))
                .to.emit(votingHub, "GasFunded")
                .withArgs(0, INITIAL_FUNDING);

            expect(await votingHub.pollGasBalances(0)).to.equal(INITIAL_FUNDING);
        });

        it("Should deduct calculated gas overhead when called via a relayer (msg.sender != tx.origin)", async function () {
            const { votingHub, organizer, voter, mockForwarder, mockVerifier } = await loadFixture(deployHubFixture);

            await votingHub.connect(organizer).createPoll(
                await mockVerifier.getAddress(), EMPTY_BYTES, "Q", ["A", "B"], "", "", 3600, true
            );
            await votingHub.fundPollGas(0, { value: INITIAL_FUNDING });

            const proof = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint[2]", "uint[2][2]", "uint[2]", "uint256[]"],
                [[0, 0], [[0, 0], [0, 0]], [0, 0], [ethers.ZeroHash, 0, 0, 0]]
            );

            const data = votingHub.interface.encodeFunctionData("vote", [0, 0, proof]);

            await mockForwarder.connect(voter).execute(
                await votingHub.getAddress(),
                data,
                { gasPrice: ethers.parseUnits("10", "gwei") }
            );

            const balanceAfter = await votingHub.pollGasBalances(0);
            expect(balanceAfter).to.be.lt(INITIAL_FUNDING);
        });

        it("Should fail when the sponsor reservoir is insolvent", async function () {
            const { votingHub, organizer, voter, mockForwarder, mockVerifier } = await loadFixture(deployHubFixture);

            await votingHub.connect(organizer).createPoll(
                await mockVerifier.getAddress(), EMPTY_BYTES, "Q", ["A", "B"], "", "", 3600, true
            );

            const proof = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint[2]", "uint[2][2]", "uint[2]", "uint256[]"],
                [[0, 0], [[0, 0], [0, 0]], [0, 0], [ethers.id("n1"), 0, 0, 0]]
            );

            const data = votingHub.interface.encodeFunctionData("vote", [0, 0, proof]);

            await expect(mockForwarder.connect(voter).execute(await votingHub.getAddress(), data))
                .to.be.revertedWith("INSOLVENT: Sponsor reservoir empty");
        });
    });

    describe("IV. ZK-Voting & Administrative", function () {
        it("Should allow a valid direct vote and block double-voting", async function () {
            const { votingHub, organizer, voter, mockVerifier } = await loadFixture(deployHubFixture);

            await votingHub.connect(organizer).createPoll(
                await mockVerifier.getAddress(), EMPTY_BYTES, "Q", ["A", "B"], "", "", 3600, false
            );

            const proof = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint[2]", "uint[2][2]", "uint[2]", "uint256[]"],
                [[0, 0], [[0, 0], [0, 0]], [0, 0], [ethers.id("nullifier1"), 0, 0, 0]]
            );

            await expect(votingHub.connect(voter).vote(0, 0, proof))
                .to.emit(votingHub, "VoteCast")
                .withArgs(0, 0);

            expect(await votingHub.getVotes(0, 0)).to.equal(1);

            await expect(votingHub.connect(voter).vote(0, 0, proof))
                .to.be.revertedWith("Already voted");
        });

        it("Should allow Admin to withdraw protocol profits", async function () {
            const { votingHub, admin, organizer, mockVerifier } = await loadFixture(deployHubFixture);

            await votingHub.connect(organizer).createPoll(
                await mockVerifier.getAddress(), EMPTY_BYTES, "Q", ["A", "B"], "", "", 3600, true
            );
            await votingHub.fundPollGas(0, { value: INITIAL_FUNDING });

            const initialBalance = await ethers.provider.getBalance(admin.address);

            const tx = await votingHub.connect(admin).withdrawFunds(INITIAL_FUNDING, admin.address);
            const receipt = await tx.wait();

            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const finalBalance = await ethers.provider.getBalance(admin.address);

            expect(finalBalance).to.equal(initialBalance + INITIAL_FUNDING - gasUsed);
        });
    });
});