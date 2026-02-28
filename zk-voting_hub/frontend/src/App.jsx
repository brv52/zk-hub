import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import CreatePoll from "./components/CreatePoll";
import VotePage from "./components/VotePage";

import contractConfig from "./contracts/contractAddress.json";
const VOTING_HUB_ADDRESS = contractConfig.VotingHub;

// The Hexadecimal Chain ID for Sepolia Testnet
const SEPOLIA_CHAIN_ID = "0xaa36a7"; 

export default function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState("");
  const [currentTab, setCurrentTab] = useState("find"); 
  const [searchPollId, setSearchPollId] = useState("");
  const [activePollId, setActivePollId] = useState(null);

  // Auto-Switch Network Logic
  const switchToSepolia = async () => {
    try {
      // Try to switch to the Sepolia testnet
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError) {
      // Error code 4902 means the chain hasn't been added to MetaMask yet.
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia Test Network",
                nativeCurrency: {
                  name: "Sepolia Ether",
                  symbol: "ETH",
                  decimals: 18,
                },
                // Providing a reliable set of public RPCs to bypass rate limits
                rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com", "https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addError) {
          console.error("Failed to add Sepolia network to MetaMask", addError);
        }
      } else {
        console.error("Failed to switch to Sepolia network", switchError);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Please install MetaMask to use zkVote.");
    try {
      // 1. Force network switch to Sepolia FIRST
      await switchToSepolia();

      // 2. Request account access
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      
      setProvider(web3Provider);
      setAccount(accounts[0]);
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  // Auto-connect if already authorized
  useEffect(() => {
    if (window.ethereum) {
      // Listen for network changes to force refresh if they manually change networks
      window.ethereum.on('chainChanged', () => window.location.reload());

      window.ethereum.request({ method: 'eth_accounts' }).then(async (accounts) => {
        if (accounts.length > 0) {
          // Verify they are actually on Sepolia before auto-connecting quietly
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          if (chainId === SEPOLIA_CHAIN_ID) {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);
            setAccount(accounts[0]);
          }
        }
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-2xl font-black text-blue-600 tracking-tight">zkVote.</span>
              <div className="ml-10 flex space-x-2">
                <button onClick={() => { setCurrentTab("find"); setActivePollId(null); }} className={`px-3 py-2 rounded-md text-sm font-bold transition-colors ${currentTab === "find" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"}`}>Find Poll</button>
                <button onClick={() => setCurrentTab("create")} className={`px-3 py-2 rounded-md text-sm font-bold transition-colors ${currentTab === "create" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"}`}>Create Poll</button>
              </div>
            </div>
            {!account ? (
              <button onClick={connectWallet} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                Connect Wallet
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                  Sepolia
                </span>
                <span className="bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-bold border border-green-200">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {!provider ? (
          <div className="text-center py-20">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Zero-Knowledge Voting Hub</h2>
            <p className="mt-4 text-lg text-gray-500">Connect your Web3 wallet to participate anonymously.</p>
            <button onClick={connectWallet} className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-blue-700 transition shadow-md">
              Connect to Sepolia
            </button>
          </div>
        ) : (
          <>
            {currentTab === "create" && <CreatePoll votingHubAddress={VOTING_HUB_ADDRESS} provider={provider} />}
            
            {currentTab === "find" && !activePollId && (
              <div className="bg-white p-8 rounded-lg shadow border border-gray-200 mt-10 text-center animate-fade-in">
                <h2 className="text-xl font-bold mb-4">Join an Election</h2>
                <form onSubmit={(e) => { e.preventDefault(); if (searchPollId) setActivePollId(searchPollId); }} className="space-y-4">
                  <input type="number" min="0" placeholder="Enter Poll ID" className="w-full text-center text-xl p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" value={searchPollId} onChange={(e) => setSearchPollId(e.target.value)} />
                  <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-md hover:bg-gray-800 transition">Load Poll</button>
                </form>
              </div>
            )}

            {currentTab === "find" && activePollId && (
              <div className="animate-fade-in">
                <button onClick={() => setActivePollId(null)} className="mb-6 text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-2">
                  <span>&larr;</span> Back to Search
                </button>
                <VotePage pollId={activePollId} votingHubAddress={VOTING_HUB_ADDRESS} provider={provider} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}