import { ethers, network, run, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log(`\n🚀 Starting Deployment to network: ${network.name}`);
    
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deploying with account: ${deployer.address}`);

    // --- CONSTRUCTOR ARGUMENTS ---
    const domain = "localhost"; 
    const expectedMinAge = 18;  
    const expectedNationalities = ["CZE", "RUS"]; // Must be passed as an array of strings

    console.log(`\n📦 Deploying ZKPassport Poll Wrapper...`);
    console.log(`   - Domain: ${domain}`);
    console.log(`   - Min Age: ${expectedMinAge}`);
    console.log(`   - Nationalities: ${expectedNationalities.join(", ")}`);
    
    const Wrapper = await ethers.getContractFactory("ZKPassportPollWrapper");
    
    // Deploying with all 3 arguments
    const wrapper = await Wrapper.deploy(domain, expectedMinAge, expectedNationalities);

    await wrapper.waitForDeployment();
    const wrapperAddress = await wrapper.getAddress();
    
    console.log(`\n✅ ZKPassportPollWrapper deployed to: ${wrapperAddress}`);

    // Export artifacts to the frontend
    saveFrontendFiles(wrapperAddress);

    // Verify on Etherscan if not on a local network
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\n⏳ Waiting for 5 block confirmations before verification...");
        const tx = wrapper.deploymentTransaction();
        if (tx) {
            await tx.wait(5);
        }
        
        console.log("🔍 Verifying ZKPassportPollWrapper on Etherscan...");
        try {
            await run("verify:verify", {
                address: wrapperAddress,
                constructorArguments: [domain, expectedMinAge, expectedNationalities], 
            });
            console.log("✅ Contract verified successfully!");
        } catch (error: any) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("ℹ️ Already verified.");
            } else {
                console.error("❌ Verification failed:", error);
            }
        }
    }
}

function saveFrontendFiles(wrapperAddress: string) {
    // // Make sure this path correctly points to your React frontend directory
    // const frontendDir = path.join(__dirname, "..", "..", "frontend", "src", "contracts");
    // if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });

    // fs.writeFileSync(
    //     path.join(frontendDir, "ZKPassportWrapperAddress.json"),
    //     JSON.stringify({ ZKPassportWrapper: wrapperAddress }, undefined, 2)
    // );
    
    // const VerifierArtifact = artifacts.readArtifactSync("ZKPassportPollWrapper");
    // fs.writeFileSync(
    //     path.join(frontendDir, "ZKPassportPollWrapper.json"),
    //     JSON.stringify(VerifierArtifact, null, 2)
    // );
    
    // console.log(`📁 Artifacts exported to: ${frontendDir}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});