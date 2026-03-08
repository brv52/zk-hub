// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Context.sol";

interface IUniversalVerifier {
    function verifyProof(uint256 pollId, uint256 optionId, bytes calldata proofData) external returns (bool isValid, bytes32 nullifier);
}

contract VotingHub is ReentrancyGuard, AccessControl {
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    uint256 public constant GAS_CREDIT_PER_VOTE = 0.0005 ether;
    uint256 public constant VERIFIER_GAS_LIMIT = 2500000;

    address private _trustedForwarder;

    mapping(uint256 => uint256) public pollGasBalances;

    struct Poll {
        address creator;          
        bool exists;
        bool isSponsored;
        uint64 endTime;
        address verifierContract;
        string question;
        string metadataURI;
    }

    uint256 public nextPollId;
    mapping(uint256 => Poll) public polls;
    mapping(uint256 => string[]) public pollOptions;
    mapping(uint256 => mapping(uint256 => uint256)) public votes;
    mapping(uint256 => mapping(bytes32 => bool)) public hasVoted;

    event PollCreated(uint256 indexed pollId, address indexed creator, address verifier, bool isSponsored);
    event VoteCast(uint256 indexed pollId, uint256 indexed optionId);
    event GasFunded(uint256 indexed pollId, uint256 amount);
    event FundsWithdrawn(address indexed admin, uint256 amount);
    event ForwarderUpdated(address indexed newForwarder);

    constructor(address forwarder) {
        _trustedForwarder = forwarder;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORGANIZER_ROLE, msg.sender);
    }

    function isTrustedForwarder(address forwarder) public view virtual returns (bool) {
        return forwarder == _trustedForwarder;
    }

    function _msgSender() internal view virtual override returns (address sender) {
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            return super._msgSender();
        }
    }

    function _msgData() internal view virtual override returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            return msg.data[:msg.data.length - 20];
        } else {
            return super._msgData();
        }
    }

    function updateForwarder(address newForwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newForwarder != address(0), "Invalid forwarder");
        _trustedForwarder = newForwarder;
        emit ForwarderUpdated(newForwarder);
    }

    function createPoll(
        address _verifier,
        string calldata _question,
        string[] calldata _options,
        string calldata _metadataURI,
        uint64 _durationInSeconds,
        bool _isSponsored
    ) external onlyRole(ORGANIZER_ROLE) {
        require(_options.length >= 2, "At least 2 options required");
        require(_durationInSeconds > 0, "Duration must be > 0");
        require(_verifier != address(0), "Invalid verifier address");

        uint256 pollId = nextPollId++;
        uint64 endTime = uint64(block.timestamp) + _durationInSeconds;

        polls[pollId] = Poll({
            creator: _msgSender(),
            exists: true,
            endTime: endTime,
            isSponsored: _isSponsored,
            verifierContract: _verifier,
            question: _question,
            metadataURI: _metadataURI
        });

        pollOptions[pollId] = _options;
        emit PollCreated(pollId, _msgSender(), _verifier, _isSponsored);
    }

    function fundPollGas(uint256 _pollId) external payable {
        require(polls[_pollId].exists, "Poll does not exist");
        require(polls[_pollId].isSponsored, "Poll is not set to sponsored mode");
        pollGasBalances[_pollId] += msg.value;
        emit GasFunded(_pollId, msg.value);
    }

    function vote(uint256 _pollId, uint256 _optionId, bytes calldata _proofData) external nonReentrant {
        Poll storage p = polls[_pollId];
        require(p.exists, "Poll does not exist");
        require(block.timestamp < p.endTime, "Voting is closed"); 
        require(_optionId < pollOptions[_pollId].length, "Invalid option");

        if (p.isSponsored) {
            require(pollGasBalances[_pollId] >= GAS_CREDIT_PER_VOTE, "INSOLVENT: Reservoir empty");
            pollGasBalances[_pollId] -= GAS_CREDIT_PER_VOTE;
        }

        IUniversalVerifier verifier = IUniversalVerifier(p.verifierContract);
        bool isValid;
        bytes32 nullifier;
        
        try verifier.verifyProof{gas: VERIFIER_GAS_LIMIT}(_pollId, _optionId, _proofData) 
            returns (bool _isValid, bytes32 _nullifier) 
        {
            isValid = _isValid;
            nullifier = _nullifier;
        } catch {
            revert("Verifier call failed or exceeded gas limit");
        }

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

    function withdrawFunds(uint256 _amount, address payable _to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(_to != address(0), "Invalid destination address");
        require(address(this).balance >= _amount, "Insufficient contract balance");

        (bool success, ) = _to.call{value: _amount}("");
        require(success, "ETH_TRANSFER_FAILED");

        emit FundsWithdrawn(_to, _amount);
    }
}