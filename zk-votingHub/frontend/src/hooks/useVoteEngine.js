import { useState, useEffect } from "react";
import { ethers } from "ethers";
import abi from "../artifacts/VotingHub.json";
import { generateAndEncodeProof } from "../utils/prover";
import { resolveSystemInputs } from "../utils/inputResolver/inputResolver";
import { createGelatoEvmRelayerClient } from "@gelatocloud/gasless";

const GELATO_API_KEY = import.meta.env.VITE_GELATO_API_KEY;

const relayer = createGelatoEvmRelayerClient({
    apiKey: GELATO_API_KEY,
    testnet: true 
});

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

    // 2. TTL Timer Engine
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

    // 3. Telemetry / Results Fetcher
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

    // 4. Submission Handlers
    const handleVoteSuccess = () => {
        const savedVotes = JSON.parse(localStorage.getItem("zkVotes") || "{}");
        savedVotes[pollId.toString()] = options[selectedOption];
        localStorage.setItem("zkVotes", JSON.stringify(savedVotes));

        setTxStatus("");
        setUserVotedFor(options[selectedOption]);
    };

    const executeBlockchainTx = async (encodedProofData) => {
        if (selectedOption === null) return alert("ERR: NO_NODE_SELECTED");
        console.log("SPD?: ", isSponsored);

        setIsProving(true);
        try {
            const signer = await provider.getSigner();
            const hubContract = new ethers.Contract(votingHubAddress, abi.abi, signer);

            if (isSponsored) {
                if (!GELATO_API_KEY) throw new Error("API_KEY_MISSING_OR_INVALID");
                
                setTxStatus("> RELAYING_GASLESS_TRANSACTION...");

                const { data } = await hubContract.vote.populateTransaction(
                    pollId,
                    selectedOption,
                    encodedProofData
                );

                const network = await provider.getNetwork();
                const chainId = Number(network.chainId); 

                const taskId = await relayer.sendTransaction({
                    chainId: chainId,
                    data: data,
                    to: votingHubAddress,
                    gasLimit: "2500000"
                });

                setTxStatus(`> TRACKING_RELAY_TASK: ${taskId.slice(0, 10)}...`);

                try {
                    const receipt = await relayer.waitForReceipt({ id: taskId });
                    setTxStatus("> SUCCESS: RELAY_TRANSACTION_MINED.");
                    console.log(`> TX_HASH: ${receipt.transactionHash}`);
                    handleVoteSuccess();
                } catch (error) {
                    throw new Error(`RELAY_FATAL: ${error.message}`);
                }
                
            } else {
                setTxStatus("> AWAITING_WALLET_CONFIRMATION...");
                const tx = await hubContract.vote(pollId, selectedOption, encodedProofData, { gasLimit: 2500000 });

                setTxStatus("> VERIFYING_BLOCK_INCLUSION...");
                await tx.wait();
                handleVoteSuccess();
            }
        } catch (err) {
            setTxStatus(`> ${err.reason || err.message}`);
            throw err;
        } finally {
            setIsProving(false);
        }
    }

    const submitLocalVote = async () => {
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

            const fullInputs = await resolveSystemInputs(manifestData, inputState, pollData.verifierContract, provider);

            setTxStatus("> GENERATING_UNIVERSAL_PAYLOAD...");
            const encodedProofData = await generateAndEncodeProof(manifestData, fullInputs);
            await executeBlockchainTx(encodedProofData);
        } catch (err) {
            setTxStatus(`> ${err.reason || err.message}`);
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