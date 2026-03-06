import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import CreatePoll from './components/CreatePoll';
import VotePage from './components/VotePage';
import contractAddressData from './contracts/contractAddress.json';
import abiData from './contracts/VotingHub.json';
import CenterpieceElement from "./components/CenterpieceElement"

const HUB_ADDRESS = contractAddressData.address;

export default function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState('');
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [polls, setPolls] = useState([]);
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);
  
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [myVotes, setMyVotes] = useState({});

  const searchInputRef = useRef(null);

  useEffect(() => {
    if (window.ethereum) {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);

      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) setAccount(accounts[0]);
        else setAccount('');
      });
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
    
    const saved = JSON.parse(localStorage.getItem("zkVotes") || "{}");
    setMyVotes(saved);
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

  const executeDeepScan = async () => {
      if (!searchQuery.trim() || !provider) return;
      
      setIsDeepScanning(true);
      try {
        const contract = new ethers.Contract(HUB_ADDRESS, abiData.abi, provider);
        const nextPollId = Number(await contract.nextPollId());
        const newPolls = [...polls];
        const rawQuery = searchQuery.trim().toLowerCase();
        
        let searchId = null;
        let searchText = null;

        if (rawQuery.startsWith('id:')) {
          searchId = parseInt(rawQuery.replace('id:', '').trim());
          if (isNaN(searchId)) searchId = null;
        } else if (rawQuery.startsWith('name:') || rawQuery.startsWith('q:')) {
          searchText = rawQuery.replace(/^(name:|q:)/, '').trim();
        } else {
          if (/^\d+$/.test(rawQuery)) {
            searchId = parseInt(rawQuery);
          }
          searchText = rawQuery;
        }

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

  useEffect(() => {
    if (provider && currentView === 'dashboard') {
      fetchPolls();
      setMyVotes(JSON.parse(localStorage.getItem("zkVotes") || "{}"));
      if (searchInputRef.current) {
        setTimeout(() => searchInputRef.current.focus(), 100);
      }
    }
  }, [provider, currentView]);

  const goToVote = (pollId) => {
    setSelectedPollId(pollId);
    setCurrentView('vote');
  };

  const filteredPolls = polls.filter(poll => {
    const rawQuery = searchQuery.trim().toLowerCase();
    let matchesSearch = false;

    if (rawQuery.startsWith('id:')) {
      const id = parseInt(rawQuery.replace('id:', '').trim());
      matchesSearch = poll.id === id;
    } else if (rawQuery.startsWith('name:') || rawQuery.startsWith('q:')) {
      const text = rawQuery.replace(/^(name:|q:)/, '').trim();
      matchesSearch = poll.question.toLowerCase().includes(text);
    } else {
      matchesSearch = poll.question.toLowerCase().includes(rawQuery) || poll.id.toString() === rawQuery;
    }

    const matchesTab = activeTab === 'all' || myVotes[poll.id] !== undefined;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] font-sans selection:bg-[#ccff00] selection:text-[#0a0a0a] relative overflow-hidden flex flex-col">
      
      <CenterpieceElement view={currentView} isLoading={isLoadingPolls || isDeepScanning} />

      <div className="absolute top-6 left-6 z-50 mix-blend-difference">
        <button onClick={() => setCurrentView('dashboard')} className="group flex flex-col items-start cursor-pointer">
          <span className="font-display font-black text-3xl tracking-tighter leading-none group-hover:text-[#ccff00] transition-none">ZK//</span>
          <span className="font-display font-black text-3xl tracking-tighter leading-none group-hover:text-[#ccff00] transition-none">HUB_</span>
        </button>
      </div>

      <div className="absolute top-6 right-6 z-50 flex flex-col items-end gap-2">
        {account ? (
          <div className="glass-panel px-4 py-2 border-[#ccff00]/50 flex items-center gap-3">
            <div className="w-2 h-2 bg-[#ccff00] animate-pulse rounded-none"></div>
            <span className="text-xs tracking-[0.2em] uppercase font-bold text-[#ccff00]">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          </div>
        ) : (
          <button onClick={connectWallet} className="brutal-btn">
            [ INIT_CONNECTION ]
          </button>
        )}
      </div>

      {account && currentView === 'dashboard' && (
        <div className="fixed bottom-6 right-6 z-50">
          <button onClick={() => setCurrentView('create')} className="brutal-btn !bg-[#f0f0f0] !text-[#0a0a0a] hover:!bg-[#ccff00]">
            + SYS.CREATE_POLL()
          </button>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 pt-32 pb-24 relative z-10 h-screen overflow-y-auto">
        {!account ? (
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center">
            <h1 className="font-display text-5xl md:text-7xl font-black mb-6 uppercase tracking-tighter mix-blend-difference">
              Zero Knowledge <br/><span className="text-transparent border-text" style={{ WebkitTextStroke: '1px #f0f0f0' }}>Consensus Protocol</span>
            </h1>
            <p className="text-xs uppercase tracking-[0.3em] text-[#f0f0f0]/60 mb-12">
              Cryptographically secure. Universally verifiable. Identity obliterated.
            </p>
            <button onClick={connectWallet} className="brutal-btn px-12 py-5 text-sm">
              EXECUTE_HANDSHAKE
            </button>
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && (
              <div className="w-full">
                
                <div className="glass-panel p-4 mb-12 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
                  
                  <div className="flex-1 flex items-center gap-3 bg-[#0a0a0a] border border-[#f0f0f0]/20 p-3 relative">
                    <span className="text-[#ccff00] text-xs font-bold tracking-widest whitespace-nowrap hidden sm:inline">
                      root@zkhub:~$
                    </span>
                    <span className="text-[#ccff00] text-xs font-bold sm:hidden">&gt;</span>
                    <input 
                      ref={searchInputRef}
                      type="text" 
                      placeholder="[ID? | NAME?]: KEYWORD..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && executeDeepScan()}
                      className="w-full bg-transparent outline-none text-[#f0f0f0] placeholder-[#f0f0f0]/30 text-xs uppercase tracking-[0.1em] font-bold"
                    />
                    
                    {searchQuery && (
                        <button 
                            onClick={executeDeepScan} 
                            disabled={isDeepScanning}
                            className="text-[#ccff00] hover:text-[#f0f0f0] font-bold text-xs uppercase tracking-widest pl-3 border-l border-[#f0f0f0]/20 transition-colors whitespace-nowrap"
                        >
                            {isDeepScanning ? 'SCANNING...' : 'DEEP_SCAN'}
                        </button>
                    )}
                    <div className="w-2 h-4 bg-[#ccff00] animate-pulse ml-2"></div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setActiveTab('all')} 
                      data-active={activeTab === 'all'}
                      className="brutal-tab flex-1 lg:flex-none text-center"
                    >
                      GLOBAL_NET
                    </button>
                    <button 
                      onClick={() => setActiveTab('my_votes')} 
                      data-active={activeTab === 'my_votes'}
                      className="brutal-tab flex-1 lg:flex-none text-center"
                    >
                      LOCAL_LOGS
                    </button>
                    <button onClick={fetchPolls} className="brutal-tab hover:text-[#ccff00] hover:border-[#ccff00]" title="FORCE_SYNC">
                      SYNC
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-6 border-b border-[#f0f0f0]/20 pb-4">
                  <h2 className="font-display text-2xl font-black uppercase tracking-widest text-[#f0f0f0]">
                    {activeTab === 'all' ? '// ACTIVE_CONTRACTS' : '// VERIFIED_PARTICIPATION'}
                  </h2>
                  <span className="text-xs uppercase tracking-widest text-[#f0f0f0]/50 font-bold">
                    {activeTab === 'all' ? `[ HOT_NODES.SHOW(${filteredPolls.length}) ]` : `[ LOCAL_NODES.SHOW(${filteredPolls.length}) ]`}
                  </span>
                </div>

                <div>
                  {isLoadingPolls || isDeepScanning ? (
                    <div className="glass-panel p-20 flex flex-col items-center justify-center border-dashed border-[#ccff00]/50">
                      <span className="animate-glitch text-xl tracking-[0.4em] font-black uppercase text-[#ccff00]">
                        [ A U T H E N T I C A T I N G _ P A Y L O A D S . . . ]
                      </span>
                    </div>
                  ) : filteredPolls.length === 0 ? (
                    <div className="glass-panel p-16 border-dashed border-[#f0f0f0]/30 flex flex-col items-center text-center">
                      <h3 className="font-display text-4xl text-[#f0f0f0]/50 mb-4 tracking-tighter">// NULL_SET</h3>
                      <p className="text-xs uppercase tracking-widest text-[#f0f0f0]/50 mb-4">
                        {activeTab === 'all' ? "No existing votes match the current search." : "No local buffer votes match the current search."}
                      </p>
                      
                      {searchQuery && activeTab === 'all' && (
                         <button onClick={executeDeepScan} className="brutal-btn !bg-[#ccff00]/10 !text-[#ccff00] !border-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a] mb-8">
                            &gt; FORCE_ONCHAIN_DEEP_SCAN
                         </button>
                      )}

                      {activeTab === 'all' && !searchQuery && (
                        <button onClick={() => setCurrentView('create')} className="brutal-btn text-[#ccff00] border-[#ccff00]">
                          GENERATE_GENESIS_POLL
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {filteredPolls.map(poll => (
                        <div key={poll.id} className="glass-panel p-6 relative group flex flex-col justify-between min-h-[220px]">
                          
                          <div className="absolute top-0 right-2 font-display text-7xl font-black text-[#f0f0f0]/5 pointer-events-none select-none group-hover:text-[#ccff00]/10 transition-none">
                            {poll.id.toString().padStart(3, '0')}
                          </div>

                          <div className="relative z-10 mb-6">
                            <div className="flex justify-between items-start mb-4">
                              <span className="bg-[#f0f0f0] text-[#0a0a0a] px-2 py-1 text-[10px] font-black tracking-widest uppercase">
                                ID:{poll.id}
                              </span>
                              {myVotes[poll.id] && (
                                <span className="text-[#ccff00] text-[10px] font-black tracking-widest uppercase border border-[#ccff00] px-2 py-1">
                                  [ SIGNED ]
                                </span>
                              )}
                            </div>
                            <h3 className="font-display text-xl md:text-2xl font-bold uppercase leading-tight line-clamp-3 group-hover:text-[#ccff00] transition-none">
                              {poll.question}
                            </h3>
                          </div>

                          <div className="relative z-10 mt-auto">
                            {myVotes[poll.id] ? (
                              <div className="mb-4 border-l-2 border-[#ccff00] pl-3">
                                <p className="text-[10px] text-[#f0f0f0]/50 tracking-widest uppercase mb-1">LOCAL_HASH_COMMIT:</p>
                                <p className="text-sm font-bold text-[#ccff00]">{myVotes[poll.id]}</p>
                              </div>
                            ) : (
                              <p className="text-[10px] text-[#f0f0f0]/50 tracking-widest uppercase mb-4 truncate">
                                AUTHOR: {poll.creator}
                              </p>
                            )}

                            <button 
                              onClick={() => goToVote(poll.id)}
                              className="w-full brutal-btn text-center"
                            >
                              {myVotes[poll.id] ? 'DECRYPT_RESULTS' : 'INITIATE_ZK_PROOF'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentView === 'create' && (
              <div className="w-full max-w-3xl mx-auto">
                <button onClick={() => setCurrentView('dashboard')} className="brutal-btn mb-8 border-none hover:bg-transparent hover:text-[#ccff00] hover:shadow-none hover:translate-x-0 hover:translate-y-0 p-0 text-[#f0f0f0]/50">
                  &lt; TERM.KILL_PROCESS()
                </button>
                <div>
                  <CreatePoll votingHubAddress={HUB_ADDRESS} provider={provider} />
                </div>
              </div>
            )}

            {currentView === 'vote' && selectedPollId !== null && (
              <div className="w-full max-w-4xl mx-auto">
                <button onClick={() => setCurrentView('dashboard')} className="brutal-btn mb-8 border-none hover:bg-transparent hover:text-[#ccff00] hover:shadow-none hover:translate-x-0 hover:translate-y-0 p-0 text-[#f0f0f0]/50">
                  &lt; TERM.KILL_PROCESS()
                </button>
                <div>
                  <VotePage pollId={selectedPollId} votingHubAddress={HUB_ADDRESS} provider={provider} />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}