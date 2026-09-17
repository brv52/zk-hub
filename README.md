# ZK-Voting Hub

ZK-Voting Hub is a privacy-preserving voting platform built around zero-knowledge proofs. It lets an organizer publish a poll with a configurable eligibility verifier while voters prove eligibility without revealing the underlying membership, balance, or identity data.

The repository is a JavaScript/TypeScript monorepo containing:

- A Solidity `VotingHub` contract and React/Vite web application.
- Pluggable verifier packages for Proof of Membership (POM), Proof of Storage (POS), and ZKPassport.
- Circom/Groth16 proving artifacts, verifier wrappers, IPFS manifests, and deployment scripts.
- Hardhat contract tests and frontend utility tests.

Live demo: [zk-hub-seven.vercel.app](https://zk-hub-seven.vercel.app/)

## Project Overview

The system separates poll management from eligibility verification. A poll stores its question, options, verifier contract, verifier configuration, and metadata references. At vote time, the frontend generates or obtains a proof and submits it to `VotingHub`. The selected verifier checks the proof and returns a nullifier. `VotingHub` records the nullifier for that poll and rejects a second vote using the same nullifier.

This model supports multiple voting policies without changing the core voting contract:

| Verifier | Use case | Proof input |
| --- | --- | --- |
| Proof of Membership | Prove membership in an allowlist | Merkle root and membership witness |
| Proof of Storage | Prove a balance or state threshold from a snapshot | State root and threshold |
| ZKPassport | Prove configured identity attributes | ZKPassport proof, age, nationality, and scope |

The application supports both regular wallet transactions and sponsored voting. Sponsored polls can use an Alchemy account-abstraction client and gas policy; the contract also maintains a per-poll ETH reservoir for relayed calls.

## Core Architecture

```text
React/Vite frontend
  |-- wallet connection, poll UI, proof generation, IPFS manifest loading
  |-- direct transaction or ERC-4337 UserOperation
  v
VotingHub.sol
  |-- poll lifecycle and ORGANIZER_ROLE access control
  |-- option validation and voting-window enforcement
  |-- universal verifier dispatch
  |-- per-poll nullifier replay protection
  v
IUniversalVerifier adapters
  |-- MembershipVerifier -> Groth16Verifier
  |-- StorageProofWrapper -> Groth16Verifier
  |-- ZKPassportPollWrapper -> deployed ZKPassport verifier
```

### Technical implementation

- **Smart contracts:** Solidity `0.8.21`, Hardhat, OpenZeppelin `AccessControl` and `ReentrancyGuard`.
- **Verifier interface:** every adapter implements `verifyProof(pollId, optionId, proofData, verifierConfig)` and returns `(isValid, nullifier)`.
- **Privacy and replay protection:** verifier-specific private inputs remain off-chain; only the proof, public signals, and returned nullifier are used on-chain. A nullifier is scoped to a poll through `hasVoted[pollId][nullifier]`.
- **Proof system:** Circom circuits and SnarkJS/Groth16 artifacts are used by the POM and POS flows. WASM, ZKEY, and manifest files are addressed through IPFS CIDs.
- **Manifest-driven frontend:** manifests define the registry schema, circuit signals, configuration ABI, and public artifact locations. This allows the frontend to render verifier-specific input and proof flows without hard-coding every poll type.
- **Storage:** poll metadata and datasets are referenced by URI. The current integration uses Pinata as an IPFS pinning service and resolves `ipfs://` URIs through a gateway.
- **Non-blocking browser I/O:** the React frontend uses asynchronous wallet, RPC, IPFS, proof-generation, and UserOperation APIs so the UI remains responsive while proofs and transactions are processed. The Solidity contracts execute synchronously on-chain; they do not use sockets or a server-side event loop.
- **No Docker orchestration:** the repository does not currently contain Dockerfiles, Compose configuration, a Makefile, or CMake files. Build and deployment are npm/Hardhat workflows.

## Repository Layout

```text
zk-hub/
├── zk-votingHub/
│   ├── contracts/              Core VotingHub contract and mocks
│   ├── scripts/                Deployment and deployment metadata helpers
│   ├── tests/contract/          Hardhat security and lifecycle tests
│   └── frontend/                React/Vite client
└── verifiers/
    ├── POM_verifier/           Circom/Groth16 membership verifier
    ├── POS_verifier/           Storage/state-threshold verifier
    ├── ZKP_verifier/            ZKPassport adapter
    └── deployed_verifiers.json Deployment registry
```

## Prerequisites

- Node.js 18 or newer and npm.
- A browser wallet such as MetaMask for local or Sepolia interaction.
- A Sepolia RPC endpoint and a test account with Sepolia ETH for deployment.
- An Etherscan API key for explorer verification on Sepolia.
- A Pinata account/API credentials when publishing manifests or datasets to IPFS.
- Alchemy API credentials and a gas policy ID for the sponsored ERC-4337 flow.

The contracts can be compiled and tested locally without an RPC provider. Never use a wallet private key that controls real funds in `.env`.

## Installation and Build

There is no Makefile or CMake build. Each Hardhat package and the frontend has its own npm dependency set.

```bash
git clone <repository-url>
cd zk-hub

# Core contracts and contract tests
cd zk-votingHub
npm install

# Frontend
cd frontend
npm install

# Return to the repository root for verifier packages
cd ../../verifiers/POM_verifier
npm install

cd ../POS_verifier
npm install

cd ../ZKP_verifier
npm install
```

Create environment files from the checked-in examples before deploying:

```bash
cd ../../zk-votingHub
cp .env.example .env
```

Set at least `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, and `ETHERSCAN_API_KEY` for Sepolia deployment. Frontend-only operation also requires the relevant `VITE_*` values described in `zk-votingHub/.env.example` and `zk-votingHub/frontend/.env.example`.

### Compile and test

```bash
cd zk-votingHub
npx hardhat compile
npx hardhat test

cd frontend
npm run build
npm test -- --run
```

The verifier packages use the same Hardhat commands:

```bash
cd verifiers/POM_verifier && npx hardhat compile && npx hardhat test
cd ../POS_verifier && npx hardhat compile && npx hardhat test
cd ../ZKP_verifier && npx hardhat compile
```

## Deployment

### 1. Deploy the core contract

Configure `.env`, then deploy to a local Hardhat network or Sepolia:

```bash
cd zk-votingHub
npx hardhat node                         # optional, for a local chain
npx hardhat run scripts/deploy.ts --network localhost
# or
npx hardhat run scripts/deploy.ts --network sepolia
```

The deployment script writes the deployed address and ABI to `frontend/src/artifacts/`, making the frontend use the newly deployed `VotingHub` automatically. On public networks it waits for confirmations and attempts Etherscan verification.

### 2. Deploy a verifier

Deploy the verifier package to the same network as `VotingHub`:

```bash
cd verifiers/POM_verifier
npx hardhat run scripts/deploy.ts --network sepolia
node scripts/uploadManifest.js
```

Use the corresponding commands in `POS_verifier` or `ZKP_verifier` for the other verifier types. The manifest upload requires Pinata credentials and produces an IPFS URI. Record the verifier contract address and manifest URI for poll creation.

### 3. Start the frontend

```bash
cd zk-votingHub/frontend
npm run dev
```

Open the Vite URL, connect a wallet, and switch it to the network where the contracts are deployed. The current vote flow explicitly expects Sepolia for browser transactions.

## Usage Examples

### Create a poll

An organizer selects a deployed verifier, supplies its ABI-encoded configuration and IPFS manifest URI, then defines the question, options, duration, and sponsorship mode. The equivalent contract call is:

```javascript
await votingHub.createPoll(
  verifierAddress,
  verifierConfig,
  "Which proposal should be adopted?",
  ["Approve", "Reject"],
  "ipfs://<poll-metadata-cid>",
  "ipfs://<dataset-cid>",
  24 * 60 * 60,
  false
);
```

Poll creation requires `ORGANIZER_ROLE` and at least two options.

### Vote with a zero-knowledge proof

The frontend loads the poll manifest, collects the verifier-specific inputs, generates or obtains the proof, ABI-encodes the proof payload, and calls:

```javascript
await votingHub.vote(pollId, optionId, encodedProofData);
```

The transaction succeeds only when the verifier accepts the proof, the proof is bound to the poll and option where applicable, and the returned nullifier has not already voted in that poll.

### Fund a sponsored poll

```javascript
await votingHub.fundPollGas(pollId, { value: ethers.parseEther("0.1") });
```

For sponsored browser voting, configure `VITE_ALCHEMY_API_KEY` and `VITE_ALCHEMY_GAS_POLICY_ID`. The frontend submits an ERC-4337 UserOperation through Alchemy; the contract deducts the estimated relayed gas cost from the poll's sponsorship balance.

### Add a verifier

Implement the `IUniversalVerifier` interface, deploy the verifier contract, publish a manifest containing the frontend schema and proof artifacts, and pass the verifier address plus ABI-encoded configuration to `createPoll`. This keeps verifier-specific eligibility logic outside the core poll contract.

## Testing and Security Scope

The core test suite covers deployment roles, organizer authorization, poll creation, sponsorship deposits and deductions, insolvency behavior, valid voting, double-vote rejection, and administrative withdrawals. Verifier packages also include circuit and wrapper-specific tests where applicable.

This repository should be treated as a research and portfolio implementation, not as an audited production election system. Before mainnet use, review the verifier circuits and generated keys, formalize trusted-forwarder/account-abstraction assumptions, harden IPFS and secret handling, add CI and dependency auditing, and obtain an independent smart-contract/security audit.

## Portfolio Readiness

**Yes, it is a strong portfolio project for a blockchain, zero-knowledge, or full-stack Web3 role.** It demonstrates meaningful systems work: Solidity access control and reentrancy protection, pluggable verifier architecture, Groth16/Circom integration, nullifier-based privacy, IPFS content addressing, React integration, and account abstraction.

For recruiters, the project will present best when the README is paired with reproducible test commands, a short architecture diagram, verified testnet addresses, and a concise demo video. It is not yet “production-ready” in the operational or security-audit sense: the repository has no CI workflow, no Docker/Make/CMake automation, sparse package scripts, and depends on external RPC, Pinata, ZKPassport, and Alchemy services. Those are clear next improvements rather than reasons to hide the project.

## License

The individual package metadata currently uses the ISC license declaration. Confirm and standardize the intended repository-wide license before public distribution.
