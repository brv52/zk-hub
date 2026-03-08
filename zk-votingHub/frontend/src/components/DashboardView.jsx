import React, { useEffect, useRef } from 'react';
import PollCard from './PollCard';

export default function DashboardView({
  provider,
  searchQuery, setSearchQuery,
  activeTab, setActiveTab,
  isDeepScanning, isLoadingPolls,
  filteredPolls, myVotes,
  fetchPolls, executeDeepScan,
  goToVote, setCurrentView
}) {
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (provider) {
      fetchPolls();
      if (searchInputRef.current) {
        setTimeout(() => searchInputRef.current.focus(), 100);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return (
    <div className="w-full">
      {/* Search & Tabs Block */}
      <div className="glass-panel mb-12 flex flex-col items-stretch justify-between gap-4 p-4 lg:flex-row lg:items-center">
        <div className="relative flex flex-1 items-center gap-3 border border-[#f0f0f0]/20 bg-[#0a0a0a] p-3">
          <span className="hidden whitespace-nowrap text-xs font-bold tracking-widest text-[#ccff00] sm:inline">
            root@zkhub:~$
          </span>
          <span className="text-xs font-bold text-[#ccff00] sm:hidden">&gt;</span>
          
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="[ID? | NAME?]: KEYWORD..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeDeepScan()}
            className="w-full bg-transparent font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#f0f0f0] placeholder-[#f0f0f0]/30 outline-none"
          />
          
          {searchQuery && (
            <button 
              onClick={executeDeepScan} 
              disabled={isDeepScanning}
              className="whitespace-nowrap border-l border-[#f0f0f0]/20 pl-3 font-mono text-xs font-bold uppercase tracking-widest text-[#ccff00] transition-colors hover:text-[#f0f0f0]"
            >
              {isDeepScanning ? 'SCANNING...' : 'DEEP_SCAN'}
            </button>
          )}
          <div className="ml-2 h-4 w-2 animate-pulse bg-[#ccff00]"></div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('all')} 
            data-active={activeTab === 'all'}
            className="brutal-tab flex-1 text-center lg:flex-none"
          >
            GLOBAL_NET
          </button>
          <button 
            onClick={() => setActiveTab('my_votes')} 
            data-active={activeTab === 'my_votes'}
            className="brutal-tab flex-1 text-center lg:flex-none"
          >
            LOCAL_LOGS
          </button>
          <button 
            onClick={fetchPolls} 
            title="FORCE_SYNC"
            className="brutal-tab hover:border-[#ccff00] hover:text-[#ccff00]" 
          >
            SYNC
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-end justify-between border-b border-[#f0f0f0]/20 pb-4">
        <h2 className="font-display text-2xl font-black uppercase tracking-widest text-[#f0f0f0]">
          {activeTab === 'all' ? '// ACTIVE_CONTRACTS' : '// VERIFIED_PARTICIPATION'}
        </h2>
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#f0f0f0]/50">
          {activeTab === 'all' ? `[ HOT_NODES.SHOW(${filteredPolls.length}) ]` : `[ LOCAL_NODES.SHOW(${filteredPolls.length}) ]`}
        </span>
      </div>

      {/* Dashboard Grid Logic */}
      <div>
        {isLoadingPolls || isDeepScanning ? (
          <div className="glass-panel flex flex-col items-center justify-center border-dashed border-[#ccff00]/50 p-20">
            <span className="animate-glitch font-mono text-lg font-black uppercase tracking-[0.4em] text-[#ccff00]">
              [ A U T H E N T I C A T I N G _ P A Y L O A D S . . . ]
            </span>
          </div>
        ) : filteredPolls.length === 0 ? (
          <div className="glass-panel flex flex-col items-center border-dashed border-[#f0f0f0]/30 p-16 text-center">
            <h3 className="mb-4 font-display text-4xl tracking-tighter text-[#f0f0f0]/50">// NULL_SET</h3>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[#f0f0f0]/50">
              {activeTab === 'all' ? "No existing votes match the current search." : "No local buffer votes match the current search."}
            </p>
            
            {searchQuery && activeTab === 'all' && (
               <button 
                 onClick={executeDeepScan} 
                 className="brutal-btn mb-8 !border-[#ccff00] !bg-[#ccff00]/10 !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a]"
               >
                  &gt; FORCE_ONCHAIN_DEEP_SCAN
               </button>
            )}

            {activeTab === 'all' && !searchQuery && (
              <button 
                onClick={() => setCurrentView('create')} 
                className="brutal-btn border-[#ccff00] text-[#ccff00]"
              >
                GENERATE_GENESIS_POLL
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredPolls.map(poll => (
              <PollCard 
                key={poll.id} 
                poll={poll} 
                myVoteStatus={myVotes[poll.id]} 
                onGoToVote={goToVote} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}