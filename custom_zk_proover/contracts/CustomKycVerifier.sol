// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// @notice The Universal Interface expected by the new VotingHub
interface IUniversalVerifier {
    function verifyProof(uint256 pollId, bytes calldata proofData) external returns (bool isValid, bytes32 nullifier);
}

/// @notice The standard SnarkJS generated Groth16 Verifier
interface IGroth16Verifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[4] memory input
    ) external view returns (bool);
}
 
/// @title Custom KYC Verifier for ZK Voting
/// @notice Wraps a standard Groth16 verifier to enforce specific poll constraints.
contract CustomKycVerifier is IUniversalVerifier {
    IGroth16Verifier public immutable baseVerifier;
    uint256 public immutable expectedMerkleRoot;
    uint256 public immutable expectedMinAge;

    /// @param _baseVerifier Address of the underlying snarkjs Groth16 verifier
    /// @param _merkleRoot The valid Poseidon Merkle root of registered voters
    /// @param _minAge The minimum age required to participate in this poll
    constructor(address _baseVerifier, uint256 _merkleRoot, uint256 _minAge) {
        baseVerifier = IGroth16Verifier(_baseVerifier);
        expectedMerkleRoot = _merkleRoot;
        expectedMinAge = _minAge;
    }

    /// @notice Decodes the universal bytes payload, verifies constraints, and extracts the nullifier.
    function verifyProof(uint256 pollId, bytes calldata proofData) external view override returns (bool, bytes32) {
        
        // 1. Decode the universal bytes payload into Groth16 structured arrays
        (
            uint256[2] memory a,
            uint256[2][2] memory b,
            uint256[2] memory c,
            uint256[4] memory input
        ) = abi.decode(proofData, (uint256[2], uint256[2][2], uint256[2], uint256[4]));

        // 2. Prevent Cross-Poll Replay Attacks
        // Assuming input[1] is pollId based on the circuit specification
        require(input[1] == pollId, "CustomKycVerifier: Proof not generated for this Poll ID");

        // 3. Enforce poll-specific constraints
        require(input[2] == expectedMerkleRoot, "CustomKycVerifier: Invalid Merkle Root");
        require(input[3] == expectedMinAge, "CustomKycVerifier: Age requirement not met");

        // 4. Forward to the generated Groth16 verifier
        bool isValid = baseVerifier.verifyProof(a, b, c, input);
        require(isValid, "CustomKycVerifier: Cryptographic proof mathematically invalid");

        // 5. Return the result and the nullifier (input[0] is the nullifierHash)
        return (true, bytes32(input[0]));
    }
}