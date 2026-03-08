import React, { useState } from 'react';
import { useZkHub } from './hooks/useZkHub';

import contractAddressData from './artifacts/contractAddress.json';
import CenterpieceElement from "./components/CenterpieceElement";
import TopNav from './components/TopNav';
import LandingScreen from './components/LandingScreen';
import DashboardView from './components/DashboardView';
import CreatePoll from './components/CreatePoll';
import VotePage from './components/VotePage';

const HUB_ADDRESS = contractAddressData.address;

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedPollId, setSelectedPollId] = useState(null);

  const {
    provider,
    account,
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
  } = useZkHub(HUB_ADDRESS);

  const goToVote = (pollId) => {
    setSelectedPollId(pollId);
    setCurrentView('vote');
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0a0a] font-sans text-[#f0f0f0] selection:bg-[#ccff00] selection:text-[#0a0a0a]">
      
      <CenterpieceElement view={currentView} isLoading={isLoadingPolls || isDeepScanning} />

      <TopNav 
        account={account} 
        connectWallet={connectWallet} 
        resetView={() => setCurrentView('dashboard')} 
      />

      {/* Floating Action Button */}
      {account && currentView === 'dashboard' && (
        <div className="fixed bottom-6 right-6 z-50">
          <button 
            onClick={() => setCurrentView('create')} 
            className="brutal-btn !bg-[#f0f0f0] !text-[#0a0a0a] hover:!bg-[#ccff00]"
          >
            + SYS.CREATE_POLL()
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto h-screen w-full max-w-7xl flex-1 overflow-y-auto px-6 pb-24 pt-32">
        {!account ? (
          <LandingScreen connectWallet={connectWallet} />
        ) : (
          <>
            {currentView === 'dashboard' && (
              <DashboardView 
                provider={provider}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isDeepScanning={isDeepScanning}
                isLoadingPolls={isLoadingPolls}
                filteredPolls={getFilteredPolls()}
                myVotes={myVotes}
                fetchPolls={fetchPolls}
                executeDeepScan={executeDeepScan}
                goToVote={goToVote}
                setCurrentView={setCurrentView}
              />
            )}

            {(currentView === 'create' || currentView === 'vote') && (
              <div className={`mx-auto w-full ${currentView === 'vote' ? 'max-w-4xl' : 'max-w-3xl'}`}>
                <button 
                  onClick={() => setCurrentView('dashboard')} 
                  className="mb-8 border-none bg-transparent p-0 font-mono text-[10px] uppercase tracking-widest text-[#f0f0f0]/50 outline-none transition-colors hover:text-[#ccff00]"
                >
                  &lt; TERM.KILL_PROCESS()
                </button>
                
                <div>
                  {currentView === 'create' && <CreatePoll votingHubAddress={HUB_ADDRESS} provider={provider} />}
                  {currentView === 'vote' && <VotePage pollId={selectedPollId} votingHubAddress={HUB_ADDRESS} provider={provider} account={account} />}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}