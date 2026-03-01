#!/bin/bash
set -e

echo "Compiling circuit..."
circom membership.circom --r1cs --wasm --sym -l ../node_modules

echo "Starting Trusted Setup (Powers of Tau)..."
snarkjs powersoftau new bn128 13 pot13_0000.ptau -v
snarkjs powersoftau contribute pot13_0000.ptau pot13_0001.ptau --name="First contribution" -v -e="Random entropy text"

echo "Phase 2..."
snarkjs powersoftau prepare phase2 pot13_0001.ptau pot13_final.ptau -v
snarkjs groth16 setup membership.r1cs pot13_final.ptau membership_0000.zkey
snarkjs zkey contribute membership_0000.zkey membership_final.zkey --name="Second contribution" -v -e="More random entropy text"

echo "Exporting Verification Key..."
snarkjs zkey export verificationkey membership_final.zkey verification_key.json

echo "Generating Solidity Verifier..."
snarkjs zkey export solidityverifier membership_final.zkey Groth16Verifier.sol

echo "Done! Wasm, Zkey, and Groth16Verifier.sol are ready."

echo "Moving artifacts to scripts folder..."
mkdir -p ../scripts/membership_js
cp ./membership_js/membership.wasm ../scripts/membership_js/
cp ./membership_js/witness_calculator.js ../scripts/membership_js/
cp ./membership_final.zkey ../scripts/
cp ./verification_key.json ../scripts/

echo "All artifacts synced!"