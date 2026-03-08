import React, { useState } from "react";
import { ethers } from "ethers";
import abi from "../artifacts/VotingHub.json"

export function useGasManagement(pollId, votingHubAddress, provider) {
    const [currentBalance, setCurrentBalance] = useState("0");
    const [isFunding, setIsFunding] = useState(false);

    const fetchBalance = async () => {
        const contract = new ethers.Contract(votingHubAddress, abi.abi, provider);
        const bal = await contract.pollGasBalances(pollId);
        setCurrentBalance(ethers.formatEther(bal));
    };

    const topUp = async (amountInEth) => {
        setIsFunding(true);
        try {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(votingHubAddress, abi.abi, signer);
            const tx = await contract.fundPollGas(pollId, { 
                value: ethers.parseEther(amountInEth) 
            });
            await tx.wait();
            await fetchBalance();
        } finally {
            setIsFunding(false);
        }
    };

    return { currentBalance, topUp, isFunding, fetchBalance };
}