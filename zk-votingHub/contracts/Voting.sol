// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IUniversalVerifier
 * @notice The new Universal Interface every verifier must implement.
 */
interface IUniversalVerifier {
    /**
     * @param pollId The ID of the poll being voted on.
     * @param proofData The ABI-encoded cryptographic proof (Groth16, ZKPassport, etc.)
     * @return isValid True if the proof mathematically verifies.
     * @return nullifier A unique bytes32 hash to prevent double voting.
     */
    function verifyProof(uint256 pollId, bytes calldata proofData) external returns (bool isValid, bytes32 nullifier);
}

contract VotingHub {
    struct Poll {
        address creator;
        address verifierContract;
        uint256 pollId;
        string question;
        string[] options;
        string metadataURI;
        mapping(uint256 => uint256) results;
        mapping(uint256 => bool) usedNullifiers;
        bool exists;
    }

    mapping(uint256 => Poll) public polls;
    uint256 public nextPollId;

    event PollCreated(uint256 pollId, address verifier, string question);
    event VoteCast(uint256 pollId, uint256 optionId);

    function createPoll(
        address _verifier,
        string memory _question,
        string[] memory _options,
        string memory _metadataURI
    ) external {
        require(_options.length >= 2, "At least 2 options required");
        
        uint256 pollId = nextPollId++;
        Poll storage p = polls[pollId];

        p.creator = msg.sender;
        p.verifierContract = _verifier;
        p.question = _question;
        p.options = _options;
        p.metadataURI = _metadataURI;
        p.exists = true;

        emit PollCreated(pollId, _verifier, _question);
    }

    function vote(
        uint256 _pollId,
        uint256 _optionId,
        bytes calldata _proofData
    ) external {
        Poll storage p = polls[_pollId];
        require(p.exists, "Poll not found");
        require(_optionId < p.options.length, "Invalid option");

        IUniversalVerifier verifier = IUniversalVerifier(p.verifierContract);
        
        (bool isValid, bytes32 nullifier) = verifier.verifyProof(_pollId, _proofData);
        require(isValid, "Invalid ZK Proof");

        uint256 numericNullifier = uint256(nullifier);
        require(!p.usedNullifiers[numericNullifier], "Double voting");
        
        p.usedNullifiers[numericNullifier] = true;
        p.results[_optionId]++;

        emit VoteCast(_pollId, _optionId);
    }

    function getOptions(uint256 _pollId) external view returns (string[] memory) {
        require(polls[_pollId].exists, "Poll not found");
        return polls[_pollId].options;
    }

    function getVotes(uint256 _pollId, uint256 _optionId) external view returns (uint256) {
        require(polls[_pollId].exists, "Poll not found");
        return polls[_pollId].results[_optionId];
    } 
}