#!/bin/bash
set -e

echo "1. Compiling StorageProof circuit..."
circom StorageProof.circom --r1cs --wasm --sym -l ../node_modules

echo "2. Generating Powers of Tau (PTAU)..."
snarkjs powersoftau new bn128 13 pot13_0000.ptau -v
snarkjs powersoftau contribute pot13_0000.ptau pot13_0001.ptau --name="First contribution" -v -e="random text"
snarkjs powersoftau prepare phase2 pot13_0001.ptau pot13_final.ptau -v

echo "3. Generating ZKey (Proving Key)..."
snarkjs groth16 setup StorageProof.r1cs pot13_final.ptau storage_0000.zkey
snarkjs zkey contribute storage_0000.zkey storage_final.zkey --name="Second contribution" -v -e="another random text"

echo "4. Exporting Verification Key and Solidity Verifier..."
snarkjs zkey export verificationkey storage_final.zkey verification_key.json
snarkjs zkey export solidityverifier storage_final.zkey Groth16StorageVerifier.sol

echo "Done! Artifacts ready in ./StorageProof_js/ and storage_final.zkey"