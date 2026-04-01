import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import abiData from '../artifacts/VotingHub.json';

const SEPOLIA_CHAIN_ID = '0xaa36a7';

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

  const refreshMyVotes = useCallback(() => {
    setMyVotes(JSON.parse(localStorage.getItem("zkVotes") || "{}"));
  }, []);

  useEffect(() => {
    const init = async () => {
      const rpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

      try {
        const publicProvider = new ethers.JsonRpcProvider(rpcUrl);
        await publicProvider.getNetwork();
        setProvider(publicProvider);
      } catch (err) {
        console.error("RPC_CONNECTION_FAILED: Check your CSP or URL", err);
      }

      if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
          setAccount(accounts.length > 0 ? accounts[0] : '');
        });
        window.ethereum.on('chainChanged', () => window.location.reload());
      }

      refreshMyVotes(); 
    };

    init();
  }, [refreshMyVotes]);

  const connectWallet = async () => {
    if (!window.ethereum) return alert('ERR: METAMASK_NOT_DETECTED');

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });

      if (currentChainId !== SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: SEPOLIA_CHAIN_ID,
                chainName: 'Sepolia Test Network',
                rpcUrls: [import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://rpc.ankr.com/eth_sepolia'],
                nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                blockExplorerUrls: ['https://sepolia.etherscan.io']
              }],
            });
          } else {
            throw switchError;
          }
        }
      }
      setAccount(accounts[0]);
    } catch (error) {
      console.error('Connection/Switch Sequence Failed:', error);
      alert(`CONNECTION_ERR: ${error.message}`);
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

  // --- ДОБАВЛЕНО: Автоматическая догрузка недостающих логов ---
  useEffect(() => {
    if (activeTab === 'my_votes' && provider) {
      const votedIds = Object.keys(myVotes).map(Number);
      if (votedIds.length === 0) return;

      const contract = new ethers.Contract(HUB_ADDRESS, abiData.abi, provider);

      setPolls(prevPolls => {
        // Ищем ID, которые есть в localStorage, но которых нет в массиве polls
        const missingIds = votedIds.filter(id => !prevPolls.some(p => p.id === id));
        
        if (missingIds.length === 0) return prevPolls; // Всё уже загружено

        setIsLoadingPolls(true);
        
        // Параллельно подтягиваем только недостающие контракты
        Promise.all(missingIds.map(async (id) => {
          try {
            const poll = await contract.polls(id);
            if (poll.exists) {
              return { id, question: poll.question, creator: poll.creator, verifier: poll.verifierContract };
            }
          } catch (e) {
            console.error(`Failed to fetch local poll ${id}:`, e);
          }
          return null;
        })).then(results => {
          const validResults = results.filter(p => p !== null);
          if (validResults.length > 0) {
            setPolls(current => {
              const combined = [...current, ...validResults];
              // Убираем дубликаты (на всякий случай) и сортируем по убыванию (новые сверху)
              const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
              return unique.sort((a, b) => b.id - a.id);
            });
          }
        }).finally(() => {
          setIsLoadingPolls(false);
        });

        return prevPolls;
      });
    }
  }, [activeTab, myVotes, provider, HUB_ADDRESS]);

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
    getFilteredPolls,
    refreshMyVotes
  };
}