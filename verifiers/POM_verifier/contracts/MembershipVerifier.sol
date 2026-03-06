// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUniversalVerifier {
    function verifyProof(uint256 pollId, bytes calldata proofData) external returns (bool isValid, bytes32 nullifier);
}


interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[4] calldata _pubSignals
    ) external view returns (bool);
}

contract MembershipVerifier is IUniversalVerifier {
    IGroth16Verifier public groth16Verifier;
    uint256 public expectedMerkleRoot;
    uint256 public expectedMinAge;

    constructor(address _groth16Verifier, uint256 _merkleRoot, uint256 _minAge) {
        groth16Verifier = IGroth16Verifier(_groth16Verifier);
        expectedMerkleRoot = _merkleRoot;
        expectedMinAge = _minAge;
    }

    function verifyProof(uint256 pollId, bytes calldata proofData) external view override returns (bool isValid, bytes32 nullifier) {
        (
            uint[2] memory pA,
            uint[2][2] memory pB,
            uint[2] memory pC,
            uint256[] memory decodedSignals
        ) = abi.decode(proofData, (uint[2], uint[2][2], uint[2], uint256[]));

        require(decodedSignals.length >= 1, "Invalid public signals length");
        uint256 clientNullifier = decodedSignals[0];

        uint[4] memory pubSignals = [
            clientNullifier,
            expectedMerkleRoot,
            pollId,
            expectedMinAge
        ];

        isValid = groth16Verifier.verifyProof(pA, pB, pC, pubSignals);
        require(isValid, "Invalid ZK Proof");

        nullifier = bytes32(clientNullifier);
        return (isValid, nullifier);
    }

    function updateRoot(uint256 _newRoot) external {
        expectedMerkleRoot = _newRoot;
    }
}