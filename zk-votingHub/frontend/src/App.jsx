import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

import CreatePoll from './components/CreatePoll';
import VotePage from './components/VotePage';

import contractAddressData from './contracts/contractAddress.json';
import abiData from './contracts/VotingHub.json';

const HUB_ADDRESS = contractAddressData.address;

export default function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState('');
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [polls, setPolls] = useState([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);

  useEffect(() => {
    if (window.ethereum) {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);

      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) setAccount(accounts[0]);
        else setAccount('');
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) return alert('Please install MetaMask to use this dApp.');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  const fetchPolls = async () => {
    if (!provider) return;
    try {
      setIsLoadingPolls(true);
      const contract = new ethers.Contract(HUB_ADDRESS, abiData.abi, provider);
      const nextPollId = await contract.nextPollId();
      
      const loadedPolls = [];
      const startId = nextPollId > 10n ? Number(nextPollId) - 10 : 0;
      for (let i = Number(nextPollId) - 1; i >= startId; i--) {
        const poll = await contract.polls(i);
        if (poll.exists) {
          loadedPolls.push({
            id: i,
            question: poll.question,
            creator: poll.creator,
            verifier: poll.verifierContract
          });
        }
      }
      setPolls(loadedPolls);
    } catch (error) {
      console.error('Failed to fetch polls:', error);
    } finally {
      setIsLoadingPolls(false);
    }
  };

  useEffect(() => {
    if (provider && currentView === 'dashboard') {
      fetchPolls();
    }
  }, [provider, currentView]);

  const goToVote = (pollId) => {
    setSelectedPollId(pollId);
    setCurrentView('vote');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Навигационная панель (Header) */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setCurrentView('dashboard')}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              ZK
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Voting Hub
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentView('create')}
              className="text-sm font-bold text-gray-600 hover:text-blue-600 transition"
            >
              + Create Poll
            </button>
            
            {account ? (
              <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-full text-sm font-mono font-bold text-gray-700">
                {account.slice(0, 6)}...{account.slice(-4)}
              </div>
            ) : (
              <button 
                onClick={connectWallet}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-bold rounded-full hover:bg-black transition shadow-sm"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!account ? (
          <div className="text-center py-20">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Welcome to ZK Voting Hub</h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Secure, anonymous, and universally verifiable polling powered by Zero-Knowledge Proofs. Connect your wallet to participate or create a poll.
            </p>
            <button 
              onClick={connectWallet}
              className="px-8 py-4 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 transition shadow-lg"
            >
              Connect Wallet to Start
            </button>
          </div>
        ) : (
          <>
            {/* Экран 1: Дашборд (Список голосований) */}
            {currentView === 'dashboard' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">Active Polls</h1>
                  <button onClick={fetchPolls} className="text-sm font-bold text-blue-600 hover:text-blue-800">
                    Refresh
                  </button>
                </div>

                {isLoadingPolls ? (
                  <div className="text-center py-12 text-gray-500 font-medium animate-pulse">Loading polls from blockchain...</div>
                ) : polls.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500 mb-4">No polls found.</p>
                    <button onClick={() => setCurrentView('create')} className="text-blue-600 font-bold hover:underline">
                      Create the first one!
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {polls.map(poll => (
                      <div key={poll.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded">ID: {poll.id}</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2" title={poll.question}>
                          {poll.question}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono mb-4 truncate">By: {poll.creator}</p>
                        <button 
                          onClick={() => goToVote(poll.id)}
                          className="w-full py-2 bg-gray-50 text-gray-900 border border-gray-200 font-bold rounded-lg group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition"
                        >
                          Participate &rarr;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Экран 2: Создание голосования */}
            {currentView === 'create' && (
              <div>
                <button onClick={() => setCurrentView('dashboard')} className="text-sm font-bold text-gray-500 hover:text-gray-900 mb-4 flex items-center gap-2">
                  &larr; Back to Dashboard
                </button>
                <CreatePoll votingHubAddress={HUB_ADDRESS} provider={provider} />
              </div>
            )}

            {/* Экран 3: Страница голосования */}
            {currentView === 'vote' && selectedPollId !== null && (
              <div>
                <button onClick={() => setCurrentView('dashboard')} className="text-sm font-bold text-gray-500 hover:text-gray-900 mb-4 flex items-center gap-2">
                  &larr; Back to Dashboard
                </button>
                <VotePage pollId={selectedPollId} votingHubAddress={HUB_ADDRESS} provider={provider} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}