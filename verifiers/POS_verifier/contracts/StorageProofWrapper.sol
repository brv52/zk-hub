// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IUniversalVerifier {
    function verifyProof (
        uint256 pollId, 
        uint256 optionId, 
        bytes calldata proofData,
        bytes calldata verifierConfig
    ) external returns (bool isValid, bytes32 nullifier);
}

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA, 
        uint[2][2] calldata _pB, 
        uint[2] calldata _pC, 
        uint[5] calldata _pubSignals // <-- ИЗМЕНЕНО НА 5 СИГНАЛОВ
    ) external view returns (bool);
}

contract StorageProofWrapper is IUniversalVerifier {
    IGroth16Verifier public groth16Verifier;

    constructor(address _groth16Verifier) {
        groth16Verifier = IGroth16Verifier(_groth16Verifier);
    }

    function verifyProof(
        uint256 pollId, 
        uint256 optionId, 
        bytes calldata proofData,
        bytes calldata verifierConfig
    ) external view override returns (bool, bytes32) {
        // Декодируем и стейт рут, и требуемый порог баланса
        (uint256 expectedStateRoot, uint256 expectedThreshold) = abi.decode(verifierConfig, (uint256, uint256));

        (
            uint[2] memory pA, 
            uint[2][2] memory pB, 
            uint[2] memory pC, 
            uint256[] memory decodedSignals
        ) = abi.decode(proofData, (uint[2], uint[2][2], uint[2], uint256[]));

        require(decodedSignals.length == 5, "StorageProof: Invalid signals count");

        uint256 clientNullifier = decodedSignals[0];
        uint256 proofStateRoot  = decodedSignals[1];

        require(proofStateRoot == expectedStateRoot, "StorageProof: Invalid State Root Snapshot");

        // Массив публичных сигналов должен СТРОГО соответствовать circom
        uint[5] memory pubSignals = [
            clientNullifier, 
            expectedStateRoot, 
            pollId, 
            expectedThreshold, // <-- Передаем порог в ZK-машину
            optionId
        ];

        bool isValid = groth16Verifier.verifyProof(pA, pB, pC, pubSignals);
        require(isValid, "StorageProof: Cryptographic proof is invalid or balance too low");

        return (true, bytes32(clientNullifier));
    }
}