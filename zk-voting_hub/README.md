# zkVote Universal Hub API Specification (v1.2)

## 1. Smart Contract API (VotingHub.sol)
The VotingHub is the central registry. It stores poll configurations, tallies votes, and routes Zero-Knowledge proofs to the appropriate custom verifier.

### 1.1. Core Data Structures
```solidity
struct Poll {
    address creator;          // Address of the poll deployer
    address verifierContract; // The custom ZK Verifier for this specific poll
    uint256 pollId;           // Sequential ID
    string question;          // The poll subject
    string[] options;         // Array of text options (e.g., ["Yes", "No"])
    string metadataURI;       // IPFS CID containing the manifest.json
    mapping(uint256 => uint256) results;
    mapping(uint256 => bool) usedNullifiers;
    bool exists;
}
```
### 1.2. Write Methods
createPoll
Registers a new poll and attaches a custom verifier.
Parameters:

_verifier (address): Must implement IUniversalVerifier.

_question (string): The human-readable question.

_options (string[]): Minimum 2 options required.

_metadataURI (string): A valid IPFS CID containing the strict Manifest JSON.
Emits: PollCreated(uint256 pollId, address verifier, string question)

vote (Local Circuit Groth16)
Submits an anonymous vote using purely on-chain constraints and local web proofs.

voteWithZKPassport (Mobile Identity Proof)
Submits a vote verified via @zkpassport/sdk.
Parameters:

_pollId (uint256): ID of the target poll.

_optionId (uint256): Index of the chosen option.

version (uint256): Protocol version from ZKPassport.

proofVerificationData (bytes): Serialized byte proof logic.

committedInputs (bytes): Serialized constraints.

serviceConfig (bytes): Service verification parameters.

3. IPFS Manifest Schema (manifest.json)
This JSON schema dictates how the React UI will interact with your poll. We support local web-based compilation and zkpassport based biometric authentication via mobile devices.

Schema Type A: ZKPassport Manifest (New in v1.2)
If you configure your voting poll to require physical biometric validation via NFC E-Passports, specify the validation constraints directly in the manifest:

JSON
{
  "manifestVersion": "1.2",
  "verificationMethod": "zkpassport",
  "metadata": {
    "name": "Federal Election Verification",
    "description": "Requires NFC e-passport scanning."
  },
  "zkpassportConfig": {
    "minAge": 18,
    "nationality": ["US", "FRA", "GBR"] 
  }
}
Schema Type B: Local Circuit Manifest (Standard)
JSON
{
  "manifestVersion": "1.2",
  "verificationMethod": "local",
  "metadata": {
    "name": "Local Merkle Tree Registration",
    "description": "Requires manual leaf and path insertions."
  },
  "artifacts": {
    "wasm": "ipfs://<CID>",
    "zkey": "ipfs://<CID>"
  },
  "frontendDisplay": {
    "userInputs": [ ... ],
    "computedInputs": [ ... ]
  }
}
4. Frontend Input Resolver API
The InputResolver.js automatically maps UI tasks to cryptographic tasks:

parseZKPassportConfig: Extracts rules like Age constraints and feeds them into the QR code queryBuilder.

resolveSystemInputs: Iterates through Type B manifests dynamically querying contract-call bindings or building local merkle-tree structs.