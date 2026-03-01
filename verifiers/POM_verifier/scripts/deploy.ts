const hre = require("hardhat");

async function main() {
  const Groth16Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const groth16 = await Groth16Verifier.deploy();
  await groth16.waitForDeployment();
  const groth16Address = await groth16.getAddress();
  console.log("Groth16Verifier deployed to:", groth16Address);

  const initialRoot = "12751348134053001712163731317771687407900004795325752335921057449726690934650";
  const minAge = 18;

  const MembershipVerifier = await hre.ethers.getContractFactory("MembershipVerifier");
  const verifierWrapper = await MembershipVerifier.deploy(groth16Address, initialRoot, minAge);
  await verifierWrapper.waitForDeployment();
  const wrapperAddress = await verifierWrapper.getAddress();
  
  console.log("MembershipVerifier Wrapper deployed to:", wrapperAddress);
  console.log("Pass this address to VotingHub.createPoll()!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});