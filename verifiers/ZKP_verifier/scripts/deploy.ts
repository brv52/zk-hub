import { ethers, network, run } from "hardhat";
const { saveDeploymentInfo } = require("../../logger.js");

async function main() {
    console.log("> INITIATING_DEPLOYMENT: ZK_PASSPORT");
    console.log(`> NETWORK: ${network.name}`);

    const Wrapper = await ethers.getContractFactory("ZKPassportPollWrapper");
    
    const wrapper = await Wrapper.deploy();
    await wrapper.waitForDeployment();
    const wrapperAddress = await wrapper.getAddress();
    
    console.log(`> STATELESS_WRAPPER_DEPLOYED: ${wrapperAddress}`);
    saveDeploymentInfo('ZKPassport', 'contractAddress', wrapperAddress);

    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("> AWAITING_BLOCK_CONFIRMATIONS...");
        const tx = wrapper.deploymentTransaction();
        if (tx) await tx.wait(5);
        
        console.log("> VERIFYING_ON_ETHERSCAN...");
        try {
            await run("verify:verify", {
                address: wrapperAddress,
                constructorArguments: [], 
            });
            console.log("> VERIFICATION_SUCCESS");
        } catch (error: any) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("> STATUS: ALREADY_VERIFIED");
            } else {
                console.error("> VERIFICATION_ERROR:", error);
            }
        }
    }
    console.log("> STATUS: SUCCESS");
}

main().catch((error) => {
    console.error("> ERROR:", error);
    process.exitCode = 1;
});