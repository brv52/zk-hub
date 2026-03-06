import { ethers, network, run, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log(`\nStarting Deployment to network: ${network.name}`);

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying contracts with the account: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

    console.log("\nDeploying VotingHub...");
    const VotingHub = await ethers.getContractFactory("VotingHub");
    
    const votingHub = await VotingHub.deploy();
    
    await votingHub.waitForDeployment();
    const votingHubAddress = await votingHub.getAddress();
    
    console.log(`VotingHub securely deployed to: ${votingHubAddress}`);

    saveFrontendFiles(votingHubAddress);

    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\nWaiting for 5 block confirmations before verification...");
        const tx = votingHub.deploymentTransaction();
        if (tx) {
            await tx.wait(5);
        }
        console.log("Verifying contract on explorer...");
        try {
            await run("verify:verify", {
                address: votingHubAddress,
                constructorArguments: [],
            });
            console.log("Contract verified successfully!");
        } catch (error: any) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("Contract is already verified.");
            } else {
                console.error("Verification failed:", error);
            }
        }
    }

    console.log("\nDeployment sequence completed successfully!");
}

function saveFrontendFiles(votingHubAddress: string) {
    const frontendDir = path.join(__dirname, "..", "frontend", "src", "contracts");

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