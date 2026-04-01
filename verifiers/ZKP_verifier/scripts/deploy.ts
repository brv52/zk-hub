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

    console.log("> STATUS: SUCCESS");
}

main().catch((error) => {
    console.error("> ERROR:", error);
    process.exitCode = 1;
});