import { ethers, network, run } from "hardhat";

async function main() {
    console.log(`\nStarting Deployment to network: ${network.name}`);
    
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);

    const domain = "localhost"; 
    const expectedMinAge = 18;  
    const expectedNationalities = ["CZE", "RUS"];

    console.log(`\nDeploying ZKPassport Poll Wrapper...`);
    console.log(`   - Domain: ${domain}`);
    console.log(`   - Min Age: ${expectedMinAge}`);
    console.log(`   - Nationalities: ${expectedNationalities.join(", ")}`);
    
    const Wrapper = await ethers.getContractFactory("ZKPassportPollWrapper");
    
    const wrapper = await Wrapper.deploy(domain, expectedMinAge, expectedNationalities);

    await wrapper.waitForDeployment();
    const wrapperAddress = await wrapper.getAddress();
    
    console.log(`\n [->] ZKPassportPollWrapper deployed to: ${wrapperAddress}`);

    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\nWaiting for 5 block confirmations before verification...");
        const tx = wrapper.deploymentTransaction();
        if (tx) {
            await tx.wait(5);
        }
        
        console.log("Verifying ZKPassportPollWrapper on Etherscan...");
        try {
            await run("verify:verify", {
                address: wrapperAddress,
                constructorArguments: [domain, expectedMinAge, expectedNationalities], 
            });
            console.log("Contract verified successfully!");
        } catch (error: any) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("ℹAlready verified.");
            } else {
                console.error("Verification failed:", error);
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});