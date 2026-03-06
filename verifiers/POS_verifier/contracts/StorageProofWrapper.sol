// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IUniversalVerifier {
    function verifyProof(uint256 pollId, bytes calldata proofData) external returns (bool isValid, bytes32 nullifier);
}

interface IGroth16Verifier {
    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[2] calldata _pubSignals) external view returns (bool);
}

contract StorageProofWrapper is IUniversalVerifier {
    IGroth16Verifier public groth16Verifier;
    uint256 public expectedStateRoot;

    constructor(address _groth16Verifier, uint256 _expectedStateRoot) {
        groth16Verifier = IGroth16Verifier(_groth16Verifier);
        expectedStateRoot = _expectedStateRoot;
    }

    function verifyProof(uint256 /*pollId*/, bytes calldata proofData) external view override returns (bool, bytes32) {
        (
            uint[2] memory pA, 
            uint[2][2] memory pB, 
            uint[2] memory pC, 
            uint256[] memory pubSignals
        ) = abi.decode(proofData, (uint[2], uint[2][2], uint[2], uint256[]));

        require(pubSignals.length == 2, "StorageProof: Invalid signals count");

        uint256 slot = pubSignals[0]; 
        uint256 stateRoot = pubSignals[1]; 

        require(stateRoot == expectedStateRoot, "StorageProof: Invalid State Root Snapshot");

        uint[2] memory fixedPubSignals = [pubSignals[0], pubSignals[1]];
        bool isValid = groth16Verifier.verifyProof(pA, pB, pC, fixedPubSignals);
        require(isValid, "StorageProof: Cryptographic proof is invalid");

        return (true, bytes32(slot));
    }
}