// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IUniversalVerifier {
    function verifyProof(uint256 pollId, uint256 optionId, bytes calldata proofData) external returns (bool isValid, bytes32 nullifier);
}

struct ProofVerificationParams {
    bytes32 version;
    ProofVerificationData proofVerificationData;
    bytes committedInputs;
    ServiceConfig serviceConfig;
}

struct ProofVerificationData {
    bytes32 vkeyHash;
    bytes proof;
    bytes32[] publicInputs;
}

struct ServiceConfig {
    uint256 validityPeriodInSeconds;
    string domain;
    string scope;
    bool devMode;
}

struct BoundData {
    address senderAddress;
    uint256 chainId;
    string customData;
}

interface IZKPassportHelper {
    function verifyScopes(bytes32[] calldata publicInputs, string calldata domain, string calldata scope) external pure returns (bool);
    function isAgeAboveOrEqual(uint8 minAge, bytes calldata committedInputs) external pure returns (bool);
    function getBoundData(bytes calldata committedInputs) external pure returns (BoundData memory);
    function isNationalityIn(string[] memory countryList, bytes calldata committedInputs) external pure returns (bool);
}

interface IZKPassportVerifier {
    function verify(ProofVerificationParams calldata params) external returns (bool verified, bytes32 uniqueIdentifier, IZKPassportHelper helper);
}

contract ZKPassportPollWrapper is IUniversalVerifier {
    IZKPassportVerifier public constant zkPassportVerifier = IZKPassportVerifier(0x1D000001000EFD9a6371f4d90bB8920D5431c0D8);
    string public expectedDomain;
    uint8 public expectedMinAge;
    string[] public expectedNationalities;

    constructor(string memory _domain, uint8 _minAge, string[] memory _nationalities) {
        expectedDomain = _domain;
        expectedMinAge = _minAge;
        expectedNationalities = _nationalities;
    }

    function verifyProof(uint256 pollId, uint256 optionId, bytes calldata proofData) external override returns (bool, bytes32) {
        ProofVerificationParams memory params = abi.decode(proofData, (ProofVerificationParams));
        (bool isValid, bytes32 uniqueIdentifier, IZKPassportHelper helper) = zkPassportVerifier.verify(params);
        
        require(isValid, "ZKPassport: Cryptographic proof is invalid");
        
        require(
            helper.verifyScopes(params.proofVerificationData.publicInputs, expectedDomain, "voting-scope"),
            "ZKPassport: Invalid app domain or scope"
        );

        BoundData memory boundData = helper.getBoundData(params.committedInputs);
        string memory expectedCustomData = string(abi.encodePacked(uint2str(pollId), "_", uint2str(optionId)));
        require(
            keccak256(abi.encodePacked(boundData.customData)) == keccak256(abi.encodePacked(expectedCustomData)),
            "ZKPassport: Proof not bound to this Poll ID and Option ID"
        );
        require(
            helper.isAgeAboveOrEqual(expectedMinAge, params.committedInputs),
            "ZKPassport: Voter does not meet age requirement"
        );
        require(
            helper.isNationalityIn(expectedNationalities, params.committedInputs),
            "ZKPassport: Voter nationality is not eligible for this poll"
        );
        
        return (true, uniqueIdentifier);
    }

    function uint2str(uint256 _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}