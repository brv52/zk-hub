// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IUniversalVerifier {
    function verifyProof(uint256 pollId, uint256 optionId, bytes calldata proofData) external returns (bool isValid, bytes32 nullifier);
}

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA, 
        uint[2][2] calldata _pB, 
        uint[2] calldata _pC, 
        uint[4] calldata _pubSignals
    ) external view returns (bool);
}

contract StorageProofWrapper is IUniversalVerifier {
    IGroth16Verifier public groth16Verifier;
    uint256 public expectedStateRoot;

    constructor(address _groth16Verifier, uint256 _expectedStateRoot) {
        groth16Verifier = IGroth16Verifier(_groth16Verifier);
        expectedStateRoot = _expectedStateRoot;
    }

    function verifyProof(uint256 pollId, uint256 optionId, bytes calldata proofData) external view override returns (bool, bytes32) {
        (
            uint[2] memory pA, 
            uint[2][2] memory pB, 
            uint[2] memory pC, 
            uint256[] memory decodedSignals
        ) = abi.decode(proofData, (uint[2], uint[2][2], uint[2], uint256[]));

        require(decodedSignals.length == 4, "StorageProof: Invalid signals count");

        uint256 clientNullifier = decodedSignals[0];
        uint256 proofStateRoot  = decodedSignals[1]; 
        
        require(proofStateRoot == expectedStateRoot, "StorageProof: Invalid State Root Snapshot");

        uint[4] memory pubSignals = [clientNullifier, expectedStateRoot, pollId, optionId];
        
        bool isValid = groth16Verifier.verifyProof(pA, pB, pC, pubSignals);
        require(isValid, "StorageProof: Cryptographic proof is invalid or option mismatch");

        return (true, bytes32(clientNullifier));
    }
}