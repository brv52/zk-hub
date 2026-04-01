import { ethers, network, run, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";
const { saveDeploymentInfo } = require("./logger.js");

async function main() {
    console.log(`> INITIATING_DEPLOYMENT: VOTING_HUB_CORE (ERC-4337 NATIVE)`);
    console.log(`> NETWORK: ${network.name}`);

    const [deployer] = await ethers.getSigners();

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`> OPERATOR: ${deployer.address}`);
    console.log(`> BALANCE: ${ethers.formatEther(balance)} ETH`);
    
    console.log("> EXECUTING_DEPLOYMENT_ROUTINE...");
    const VotingHub = await ethers.getContractFactory("VotingHub");
    
    const votingHub = await VotingHub.deploy();
    await votingHub.waitForDeployment();

    const votingHubAddress = await votingHub.getAddress();
    console.log(`> VOTING_HUB_DEPLOYED: ${votingHubAddress}`);

    saveDeploymentInfo('Core', 'votingHubAddress', votingHubAddress);

    saveFrontendFiles(votingHubAddress);

    // if (network.name !== "hardhat" && network.name !== "localhost") {
    //     console.log("> AWAITING_BLOCK_CONFIRMATIONS...");
    //     await votingHub.deploymentTransaction()?.wait(5);
        
    //     console.log("> VERIFYING_ON_EXPLORER...");
    //     try {
    //         await run("verify:verify", {
    //             address: votingHubAddress,
    //             constructorArguments: [], // Массив аргументов теперь пустой
    //         });
    //         console.log("> VERIFICATION_SUCCESS");
    //     } catch (error: any) {
    //         if (error.message.toLowerCase().includes("already verified")) {
    //             console.log("> STATUS: ALREADY_VERIFIED");
    //         } else {
    //             console.error("> VERIFICATION_ERROR:", error.message);
    //         }
    //     }
    // }
    
    console.log("> DEPLOYMENT_SEQUENCE_COMPLETED");
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
    console.log(`> FRONTEND_ARTIFACTS_EXPORTED: ${frontendDir}`);
}

main().catch((error) => {
    console.error("\n> DEPLOYMENT_FAILED:");
    console.error(error);
    process.exitCode = 1;
});