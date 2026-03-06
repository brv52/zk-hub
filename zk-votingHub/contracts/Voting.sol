// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IUniversalVerifier {
    function verifyProof(uint256 pollId, bytes calldata proofData) external returns (bool isValid, bytes32 nullifier);
}

contract VotingHub {
    struct Poll {
        address creator;
        address verifierContract;
        uint256 pollId;
        string question;
        string metadataURI;
        uint256 endTime;
        bool exists;
    }

    uint256 public nextPollId;
    mapping(uint256 => Poll) public polls;
    mapping(uint256 => string[]) public pollOptions;
    mapping(uint256 => mapping(uint256 => uint256)) public votes;
    mapping(uint256 => mapping(bytes32 => bool)) public hasVoted;

    event PollCreated(uint256 pollId, address verifier, string question, uint256 endTime);
    event VoteCast(uint256 pollId, uint256 optionId);

    function createPoll(
        address _verifier,
        string memory _question,
        string[] memory _options,
        string memory _metadataURI,
        uint256 _durationInSeconds
    ) external {
        require(_options.length >= 2, "At least 2 options required");
        require(_durationInSeconds > 0, "Duration must be > 0");

        uint256 pollId = nextPollId++;
        uint256 endTime = block.timestamp + _durationInSeconds;

        polls[pollId] = Poll({
            creator: msg.sender,
            verifierContract: _verifier,
            pollId: pollId,
            question: _question,
            metadataURI: _metadataURI,
            endTime: endTime,
            exists: true
        });

        pollOptions[pollId] = _options;
        emit PollCreated(pollId, _verifier, _question, endTime);
    }

    function vote(uint256 _pollId, uint256 _optionId, bytes calldata _proofData) external {
        Poll storage p = polls[_pollId];
        require(p.exists, "Poll does not exist");
        
        require(block.timestamp < p.endTime, "Voting is closed"); 
        
        require(_optionId < pollOptions[_pollId].length, "Invalid option");

        IUniversalVerifier verifier = IUniversalVerifier(p.verifierContract);
        (bool isValid, bytes32 nullifier) = verifier.verifyProof(_pollId, _proofData);

        require(isValid, "Invalid ZK proof");
        require(!hasVoted[_pollId][nullifier], "Already voted");

        hasVoted[_pollId][nullifier] = true;
        votes[_pollId][_optionId] += 1;

        emit VoteCast(_pollId, _optionId);
    }

    function getOptions(uint256 _pollId) external view returns (string[] memory) {
        return pollOptions[_pollId];
    }

    function getVotes(uint256 _pollId, uint256 _optionId) external view returns (uint256) {
        return votes[_pollId][_optionId];
    }
}