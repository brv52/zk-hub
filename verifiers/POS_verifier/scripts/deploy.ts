import { ethers } from "hardhat";
const { saveDeploymentInfo } = require("../../logger.js");

async function main() {
    console.log("> INITIATING_DEPLOYMENT: PROOF_OF_STORAGE");

    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const groth16 = await Groth16Verifier.deploy();
    await groth16.waitForDeployment();
    const groth16Address = await groth16.getAddress();

    console.log(`> GROTH16_CORE_DEPLOYED: ${groth16Address}`);

    const StorageWrapper = await ethers.getContractFactory("StorageProofWrapper");
    const wrapper = await StorageWrapper.deploy(groth16Address);
    await wrapper.waitForDeployment();
    const wrapperAddress = await wrapper.getAddress();

    console.log(`> STATELESS_WRAPPER_DEPLOYED: ${wrapperAddress}`);

    saveDeploymentInfo('ProofOfStorage', 'contractAddress', wrapperAddress);
    console.log("> STATUS: SUCCESS");
}

main().catch((error) => {
    console.error("> ERROR:", error);
    process.exitCode = 1;
});