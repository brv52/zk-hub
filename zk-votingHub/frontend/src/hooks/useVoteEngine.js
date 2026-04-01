import { useState, useEffect } from "react";
import { ethers } from "ethers";
import abi from "../artifacts/VotingHub.json";
import { generateAndEncodeProof } from "../utils/prover";
import { resolveSystemInputs } from "../utils/inputResolver/inputResolver";

import { WalletClientSigner } from "@alchemy/aa-core";
import { createModularAccountAlchemyClient } from "@alchemy/aa-alchemy";
import { createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";

const alchemySepolia = {
    ...sepolia,
    rpcUrls: {
        ...sepolia.rpcUrls,
        alchemy: {
            http: ["https://eth-sepolia.g.alchemy.com/v2"],
        },
    },
};

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const ALCHEMY_GAS_POLICY_ID = import.meta.env.VITE_ALCHEMY_GAS_POLICY_ID;

const resolveGateway = (uri) => {
    if (!uri) return "";
    if (uri.startsWith("ipfs://")) return uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    if (uri.startsWith("http")) return uri;
    return `https://gateway.pinata.cloud/ipfs/${uri}`;
};

export function useVoteEngine(pollId, votingHubAddress, provider) {
    const [options, setOptions] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [manifestData, setManifestData] = useState(null);
    const [displayInputs, setDisplayInputs] = useState([]);
    const [zkInputs, setZkInputs] = useState({});
    const [pollSubject, setPollSubject] = useState("");

    const [isProving, setIsProving] = useState(false);
    const [txStatus, setTxStatus] = useState("");
    const [pageError, setPageError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const [startPassportFlow, setStartPassportFlow] = useState(false);

    const [endTime, setEndTime] = useState(0);
    const [timeLeftStr, setTimeLeftStr] = useState("");
    const [isClosed, setIsClosed] = useState(false);
    const [userVotedFor, setUserVotedFor] = useState(null);
    const [isSponsored, setIsSponsored] = useState(false);
    const [sponsorAddress, setSponsorAddress] = useState("");

    const [pollResults, setPollResults] = useState([]);
    const [totalVotes, setTotalVotes] = useState(0);

    useEffect(() => {
        const fetchPollData = async () => {
            if (!provider) return;
            try {
                setIsLoading(true);
                const contract = new ethers.Contract(votingHubAddress, abi.abi, provider);

                const pollData = await contract.polls(pollId);
                if (pollData === undefined || !pollData?.exists) throw new Error("INSTANCE_NOT_FOUND");

                setEndTime(Number(pollData.endTime));
                setOptions(await contract.getOptions(pollId));

                setIsSponsored(pollData.isSponsored);
                setPollSubject(pollData.question);
                setSponsorAddress(pollData.isSponsored ? pollData.creator : "none");

                const savedVotes = JSON.parse(localStorage.getItem("zkVotes") || "{}");
                if (savedVotes[pollId.toString()]) {
                    setUserVotedFor(savedVotes[pollId.toString()]);
                }

                const res = await fetch(resolveGateway(pollData.metadataURI));
                if (!res.ok) throw new Error("IPFS_MANIFEST_UNREACHABLE");

                const manifest = await res.json();
                setManifestData(manifest);

                if (manifest?.verificationMethod !== "zkpassport") {
                    const inputsToDisplay = manifest?.inputOrder
                        ? manifest.inputOrder.map(key => ({ id: key, label: key, type: manifest.userInputs?.[key] || 'text' }))
                        : manifest?.frontendDisplay?.userInputs || [];
                    setDisplayInputs(inputsToDisplay);
                }
            } catch (err) {
                setPageError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPollData();
    }, [pollId, votingHubAddress, provider]);

    useEffect(() => {
        if (!endTime) return;
        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);
            if (now >= endTime) {
                setIsClosed(true);
                setTimeLeftStr("LIFESPAN_TERMINATED");
            } else {
                const diff = endTime - now;
                const d = Math.floor(diff / 86400);
                const h = Math.floor((diff % 86400) / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                setTimeLeftStr(`${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`);
            }
        };
        updateTimer();
        const timerId = setInterval(updateTimer, 1000);
        return () => clearInterval(timerId);
    }, [endTime]);

    useEffect(() => {
        const fetchResults = async () => {
            if ((isClosed || userVotedFor) && options.length > 0 && provider) {
                const contract = new ethers.Contract(votingHubAddress, abi.abi, provider);
                let tempTotal = 0;
                let tempResults = [];

                for (let i = 0; i < options.length; i++) {
                    const count = Number(await contract.getVotes(pollId, i));
                    tempResults.push({ name: options[i], count });
                    tempTotal += count;
                }

                tempResults.sort((a, b) => b.count - a.count);
                setPollResults(tempResults);
                setTotalVotes(tempTotal);
            }
        };
        fetchResults();
    }, [isClosed, userVotedFor, options, provider, pollId, votingHubAddress]);

    const handleVoteSuccess = () => {
        const savedVotes = JSON.parse(localStorage.getItem("zkVotes") || "{}");
        savedVotes[pollId.toString()] = options[selectedOption];
        localStorage.setItem("zkVotes", JSON.stringify(savedVotes));

        setTxStatus("");
        setUserVotedFor(options[selectedOption]);
    };

    const executeBlockchainTx = async (encodedProofData) => {
        if (selectedOption === null) {
            setIsProving(false);
            return alert("ERR: NO_NODE_SELECTED");
        }

        try {
            if (!window.ethereum) throw new Error("Wallet not found!");

            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const network = await browserProvider.getNetwork();
            if (Number(network.chainId) !== 11155111) {
                throw new Error("Please switch MetaMask to Sepolia Testnet!");
            }

            const signer = await browserProvider.getSigner();
            const hubContract = new ethers.Contract(votingHubAddress, abi.abi, signer);

            let isAlchemySuccess = false;

            if (isSponsored) {
                try {
                    if (!ALCHEMY_API_KEY || ALCHEMY_API_KEY === "undefined") {
                        throw new Error("VITE_ALCHEMY_API_KEY is not defined in .env");
                    }

                    setTxStatus("> INITIALIZING_SMART_ACCOUNT (ERC-4337)...");

                    const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });

                    const viemWalletClient = createWalletClient({
                        account,
                        chain: alchemySepolia,
                        transport: custom(window.ethereum),
                    });

                    const alchemySigner = new WalletClientSigner(
                        viemWalletClient,
                        "json-rpc"
                    );

                    const alchemyClient = await createModularAccountAlchemyClient({
                        apiKey: ALCHEMY_API_KEY,
                        chain: alchemySepolia,
                        signer: alchemySigner,
                        gasManagerConfig: {
                            policyId: ALCHEMY_GAS_POLICY_ID,
                        },
                    });

                    setTxStatus("> REQUESTING_PAYMASTER_SPONSORSHIP...");

                    const { data } = await hubContract.vote.populateTransaction(
                        pollId,
                        selectedOption,
                        encodedProofData
                    );

                    const { hash: uoHash } = await alchemyClient.sendUserOperation({
                        uo: {
                            target: votingHubAddress,
                            data: data,
                        },
                        overrides: {
                            callGasLimit: 5000000n,
                        }
                    });

                    setTxStatus(`> TRACKING_USER_OP: ${uoHash.slice(0, 10)}...`);

                    const txHash = await alchemyClient.waitForUserOperationTransaction({
                        hash: uoHash,
                    });

                    const receipt = await alchemyClient.getUserOperationReceipt(uoHash);

                    if (receipt && !receipt.success) {
                        throw new Error("SPONSOR_RESERVOIR_EMPTY_OR_REVERTED");
                    }

                    setTxStatus("> SUCCESS: VOTE_CAST_VIA_SMART_ACCOUNT.");
                    isAlchemySuccess = true;
                    handleVoteSuccess();

                } catch (alchemyErr) {
                    console.warn("Alchemy Sponsor Flow Failed:", alchemyErr);
                    setTxStatus("> SPONSOR_UNAVAILABLE: FALLING_BACK_TO_WALLET...");
                    await new Promise(res => setTimeout(res, 2000));
                }
            }

            if (!isSponsored || (!isAlchemySuccess && isSponsored)) {
                setTxStatus(isSponsored
                    ? "> AWAITING_WALLET_CONFIRMATION (FALLBACK: USER PAYS)..."
                    : "> AWAITING_WALLET_CONFIRMATION (USER PAYS GAS)..."
                );

                const tx = await hubContract.vote(pollId, selectedOption, encodedProofData, { gasLimit: 5000000 });
                setTxStatus("> VERIFYING_BLOCK_INCLUSION...");
                await tx.wait();
                handleVoteSuccess();
            }

        } catch (err) {
            console.error("TX_ERROR_DETAILS:", err);
            setTxStatus(`> ERROR: ${err.shortMessage || err.message}`);
            throw err;
        } finally {
            setIsProving(false);
        }
    }

    const submitLocalVote = async () => {
        if (isProving) return;

        setIsProving(true);
        setTxStatus("> RESOLVING_LOCAL_INPUTS...");

        try {
            const hubContract = new ethers.Contract(votingHubAddress, abi.abi, provider);
            if (selectedOption === null) throw new Error("Please select an option first.");

            const pollData = await hubContract.polls(pollId);
            if (!pollData.exists) throw new Error("This poll does not exist on-chain.");

            const inputState = {
                ...zkInputs,
                pollId: pollId.toString(),
                optionId: selectedOption.toString()
            };

            const fullInputs = await resolveSystemInputs(
                manifestData,
                inputState,
                pollData.verifierContract,
                provider,
                pollData.databaseURI
            );

            setTxStatus("> GENERATING_UNIVERSAL_PAYLOAD...");
            const encodedProofData = await generateAndEncodeProof(manifestData, fullInputs);

            await executeBlockchainTx(encodedProofData);

        } catch (err) {
            setTxStatus(`> ${err.reason || err.message}`);
            setIsProving(false);
        }
    };

    return {
        options, selectedOption, setSelectedOption,
        manifestData, displayInputs, setZkInputs,
        isProving, txStatus, pageError, isLoading,
        startPassportFlow, setStartPassportFlow,
        timeLeftStr, isClosed, userVotedFor,
        pollResults, totalVotes, isSponsored,
        pollSubject, handleVoteSuccess, submitLocalVote,
        executeBlockchainTx, sponsorAddress
    };
}