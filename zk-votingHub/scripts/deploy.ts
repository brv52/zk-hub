import { ethers, network, run, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const GELATO_FORWARDERS: { [key: string]: string } = {
    "sepolia": "0xd8253782c45a12053594b9deB72d8e8aB2Fca54c",
    "arbitrumSepolia": "0xd8253782c45a12053594b9deB72d8e8aB2Fca54c",
    "localhost": "0x0000000000000000000000000000000000000000",
};

async function main() {
    console.log(`\nStarting Deployment to network: ${network.name}`);
    const [deployer] = await ethers.getSigners();
    const forwarder = GELATO_FORWARDERS[network.name] || GELATO_FORWARDERS["localhost"];

    if (forwarder === "0x0000000000000000000000000000000000000000" && network.name !== "hardhat") {
        console.warn("Warning: Using a null address for the Trusted Forwarder.");
    }

    console.log(`Deploying contracts with the account: ${deployer.address}`);
    console.log(`Using Trusted Forwarder: ${forwarder}`);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);
    
    console.log("\nDeploying VotingHub...");
    const VotingHub = await ethers.getContractFactory("VotingHub");
    const votingHub = await VotingHub.deploy(forwarder);
    await votingHub.waitForDeployment();

    const votingHubAddress = await votingHub.getAddress();
    console.log(`VotingHub deployed to: ${votingHubAddress}`);
    saveFrontendFiles(votingHubAddress);
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\nWaiting for 5 block confirmations before verification...");
        await votingHub.deploymentTransaction()?.wait(5);
        console.log("Verifying contract on explorer...");
        try {
            await run("verify:verify", {
                address: votingHubAddress,
                constructorArguments: [forwarder],
            });
            console.log("Contract verified successfully!");
        } catch (error: any) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("Contract is already verified.");
            } else {
                console.error("Verification failed:", error.message);
            }
        }
    }
    console.log("\nDeployment sequence completed successfully!");
}

function saveFrontendFiles(votingHubAddress: string) {
    const frontendDir = path.join(__dirname, "..", "frontend", "src", "artifacts");
    if (!fs.existsSync(frontendDir)) {
        fs.mkdirSync(frontendDir, { recursive: true });
    }
    fs.writeFileSync(
        path.join(frontendDir, "contractAddress.json"),
        JSON.stringify({ address: votingHubAddress }, undefined, 2)
    );
    const VotingHubArtifact = artifacts.readArtifactSync("VotingHub");
    fs.writeFileSync(
        path.join(frontendDir, "VotingHub.json"),
        JSON.stringify(VotingHubArtifact, null, 2)
    );
    console.log(`\nFrontend artifacts exported to: ${frontendDir}`);
}

main().catch((error) => {
    console.error("\nDeployment failed:");
    console.error(error);
    process.exitCode = 1;
});