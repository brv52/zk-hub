import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import abiData from '../artifacts/VotingHub.json';

const parseSearchQuery = (rawQuery) => {
  const query = rawQuery.trim().toLowerCase();
  let searchId = null;
  let searchText = null;

  if (query.startsWith('id:')) {
    searchId = parseInt(query.replace('id:', '').trim(), 10);
    if (isNaN(searchId)) searchId = null;
  } else if (query.startsWith('name:') || query.startsWith('q:')) {
    searchText = query.replace(/^(name:|q:)/, '').trim();
  } else {
    if (/^\d+$/.test(query)) searchId = parseInt(query, 10);
    searchText = query;
  }

  return { searchId, searchText };
};

export function useZkHub(HUB_ADDRESS) {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState('');
  const [polls, setPolls] = useState([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [myVotes, setMyVotes] = useState({});

  useEffect(() => {
    if (window.ethereum) {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);

      window.ethereum.on('accountsChanged', (accounts) => {
        setAccount(accounts.length > 0 ? accounts[0] : '');
      });
      window.ethereum.on('chainChanged', () => window.location.reload());
    }

    setMyVotes(JSON.parse(localStorage.getItem("zkVotes") || "{}"));
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) return alert('ERR: METAMASK_NOT_DETECTED');
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
      const startId = nextPollId > 6n ? Number(nextPollId) - 6 : 0;
      
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

  const executeDeepScan = async () => {
    if (!searchQuery.trim() || !provider) return;
    
    setIsDeepScanning(true);
    try {
      const contract = new ethers.Contract(HUB_ADDRESS, abiData.abi, provider);
      const nextPollId = Number(await contract.nextPollId());
      const newPolls = [...polls];
      const { searchId, searchText } = parseSearchQuery(searchQuery);

      if (searchId !== null && searchId < nextPollId && !newPolls.find(p => p.id === searchId)) {
        const poll = await contract.polls(searchId);
        if (poll.exists) {
          newPolls.push({ id: searchId, question: poll.question, creator: poll.creator, verifier: poll.verifierContract });
        }
      }

      if (searchText) {
        for (let i = nextPollId - 1; i >= 0; i--) {
          if (newPolls.find(p => p.id === i)) continue; 
          const poll = await contract.polls(i);
          if (poll.exists && poll.question.toLowerCase().includes(searchText)) {
            newPolls.push({ id: i, question: poll.question, creator: poll.creator, verifier: poll.verifierContract });
          }
        }
      }
      
      newPolls.sort((a, b) => b.id - a.id);
      setPolls(newPolls);
    } catch (error) {
      console.error('Deep scan failed:', error);
    } finally {
      setIsDeepScanning(false);
    }
  };

  const getFilteredPolls = () => {
    return polls.filter(poll => {
      const { searchId, searchText } = parseSearchQuery(searchQuery);
      let matchesSearch = false;

      if (searchId !== null && searchText !== null && searchId.toString() !== searchText) {
         matchesSearch = poll.id === searchId || poll.question.toLowerCase().includes(searchText);
      } else if (searchId !== null) {
         matchesSearch = poll.id === searchId;
      } else if (searchText !== null) {
         matchesSearch = poll.question.toLowerCase().includes(searchText);
      } else {
         matchesSearch = true;
      }

      const matchesTab = activeTab === 'all' || myVotes[poll.id] !== undefined;
      return matchesSearch && matchesTab;
    });
  };

  return {
    provider,
    account,
    polls,
    isLoadingPolls,
    isDeepScanning,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    myVotes,
    connectWallet,
    fetchPolls,
    executeDeepScan,
    getFilteredPolls
  };
}