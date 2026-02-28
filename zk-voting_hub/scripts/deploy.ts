// Added 'artifacts' to the Hardhat imports
import { ethers, network, run, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log(`\n🚀 Starting Deployment to network: ${network.name}`);
    console.log("===================================================");

    // 1. Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deploying contracts with the account: ${deployer.address}`);
    
    // In ethers v6, we use provider.getBalance. In v5 it's deployer.getBalance()
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);

    // 2. Deploy VotingHub
    console.log("\n📦 Deploying VotingHub...");
    const VotingHub = await ethers.getContractFactory("VotingHub");
    
    // Deploy the contract (VotingHub has no constructor arguments)
    const votingHub = await VotingHub.deploy();
    
    // Ethers v6 syntax (use votingHub.deployed() if you are on v5)
    await votingHub.waitForDeployment();
    const votingHubAddress = await votingHub.getAddress();
    
    console.log(`✅ VotingHub securely deployed to: ${votingHubAddress}`);

    // 3. Save frontend artifacts automatically
    saveFrontendFiles(votingHubAddress);

    // 4. Contract Verification (Only run on real testnets, skip on localhost/hardhat)
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\n⏳ Waiting for 5 block confirmations before verification...");
        // Wait for a few blocks to ensure Etherscan has indexed the deployment
        const tx = votingHub.deploymentTransaction();
        if (tx) {
            await tx.wait(5);
        }
        console.log("🔍 Verifying contract on explorer...");
        try {
            await run("verify:verify", {
                address: votingHubAddress,
                constructorArguments: [],
            });
            console.log("✅ Contract verified successfully!");
        } catch (error: any) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("ℹ️ Contract is already verified.");
            } else {
                console.error("❌ Verification failed:", error);
            }
        }
    }

    console.log("\n🎉 Deployment sequence completed successfully!");
}

/**
 * Utility function to export the deployed address and ABI to the React frontend
 */
function saveFrontendFiles(votingHubAddress: string) {
    const frontendDir = path.join(__dirname, "..", "frontend", "src", "contracts");

    // Create the directory if it doesn't exist
    if (!fs.existsSync(frontendDir)) {
        fs.mkdirSync(frontendDir, { recursive: true });
    }

    // 1. Save the Address
    fs.writeFileSync(
        path.join(frontendDir, "contractAddress.json"),
        JSON.stringify({ VotingHub: votingHubAddress }, undefined, 2)
    );

    // 2. Save the ABI using the imported 'artifacts' module
    const VotingHubArtifact = artifacts.readArtifactSync("VotingHub");
    fs.writeFileSync(
        path.join(frontendDir, "VotingHub.json"),
        JSON.stringify(VotingHubArtifact, null, 2)
    );

    console.log(`\n📁 Frontend artifacts exported to: ${frontendDir}`);
}

main().catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exitCode = 1;
});