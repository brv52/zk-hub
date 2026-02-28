#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e 

CIRCUIT_NAME="circuit"
PTAU_SIZE=13
PTAU_FILE="pot${PTAU_SIZE}_final.ptau"

echo "--- 1. Preparing Powers of Tau ---"
if [ -f "$PTAU_FILE" ]; then
    echo "$PTAU_FILE already exists. Skipping download."
else
    echo "Downloading $PTAU_FILE from Hermez network..."
    wget "https://hermez.s3-eu-west-1.amazonaws.com/${PTAU_FILE}"
fi

echo "--- 2. Compilation and Setup ---"
# This will generate circuit.r1cs, circuit.sym, and a circuit_js folder containing circuit.wasm
circom ${CIRCUIT_NAME}.circom --r1cs --wasm --sym

echo "Running Groth16 setup..."
snarkjs groth16 setup ${CIRCUIT_NAME}.r1cs ${PTAU_FILE} ${CIRCUIT_NAME}_0000.zkey

echo "Contributing to phase 2..."
# In production, this should be done securely. For testing, 'random' entropy is fine.
snarkjs zkey contribute ${CIRCUIT_NAME}_0000.zkey ${CIRCUIT_NAME}_final.zkey --name="Universal" -v -e="random"

echo "Exporting verification key..."
snarkjs zkey export verificationkey ${CIRCUIT_NAME}_final.zkey verification_key.json

echo "--- 3. Generating Base Verifier ---"
snarkjs zkey export solidityverifier ${CIRCUIT_NAME}_final.zkey Verifier.sol

echo "--- 4. Organizing IPFS Artifacts ---"
mkdir -p build
cp ${CIRCUIT_NAME}_final.zkey build/
cp verification_key.json build/
cp ${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm build/

echo "--- Done! ---"
echo "Your Verifier.sol is ready for the VotingHub."
echo "Your IPFS artifacts (.zkey, .json, .wasm) are located in the /build directory."