import React, { useState } from "react";
import PollManifestViewer from "./PollManifestViewer";
import { useVoteEngine } from "../hooks/useVoteEngine";
import { VoteTelemetry, NodeSelector, ProvingEngineRouter } from "./VotePageSubComponents";
import GasRefillStation from "./GasRefillStation";

import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  window.global = window.global || window;
  window.Buffer = window.Buffer || Buffer;
  Uint8Array.prototype._isBuffer = true;
  if (!Uint8Array.prototype.copy) {
    Uint8Array.prototype.copy = function (target, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
      const source = this.subarray(sourceStart, sourceEnd);
      target.set(source, targetStart);
      return source.length;
    };
  }
}

export default function VotePage({ pollId, votingHubAddress, provider, account }) {
  const {
    options, selectedOption, setSelectedOption,
    manifestData, displayInputs, setZkInputs,
    isProving, txStatus, pageError, isLoading,
    startPassportFlow, setStartPassportFlow,
    timeLeftStr, isClosed, userVotedFor,
    pollResults, totalVotes, executeBlockchainTx,
    isSponsored, pollSubject, sponsorAddress,
    handleVoteSuccess, submitLocalVote
  } = useVoteEngine(pollId, votingHubAddress, provider);

  const [isExpanded, setIsExpanded] = useState(false);
  const TEXT_LIMIT = 60; // Немного увеличил лимит для компактного шрифта
  const needsTruncation = pollSubject && pollSubject.length > TEXT_LIMIT;

  const getTruncatedText = (text) => {
    if (!text) return "";
    if (!needsTruncation || isExpanded) return text;
    const start = text.substring(0, TEXT_LIMIT / 2);
    const end = text.substring(text.length - TEXT_LIMIT / 2);
    return `${start}...${end}`;
  };

  const displayQuestion = getTruncatedText(pollSubject);

  if (isLoading) {
    return (
      <div className="glass-panel relative mx-auto flex min-h-[300px] w-full max-w-3xl flex-col items-center justify-center overflow-hidden border border-[#ccff00]/10 bg-[#0a0a0a]/80 p-12 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="absolute top-[-100px] left-[-100px] h-[300px] w-[300px] rounded-full bg-[#ccff00]/5 blur-[120px] pointer-events-none" />
        <div className="h-8 w-8 animate-spin border-y-2 border-[#ccff00] rounded-full mb-6" />
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#ccff00] animate-pulse">
          [ SYNCING_LEDGER_STATE... ]
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="glass-panel mx-auto w-full max-w-3xl border border-red-500/30 bg-[#0a0a0a]/90 p-8 shadow-[0_0_30px_rgba(239,68,68,0.1)] backdrop-blur-xl">
        <div className="mb-4 flex items-center space-x-3 border-b border-red-500/20 pb-4">
          <span className="flex h-6 w-6 items-center justify-center bg-red-500/20 text-red-500 font-mono text-xs font-bold">!</span>
          <h3 className="font-mono text-sm uppercase tracking-widest text-red-500">System Error</h3>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-red-400/80 break-words">
          {pageError}
        </div>
      </div>
    );
  }

  const showResults = isClosed || userVotedFor;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-12">
      
      {/* 1. COMPONENT: Manifest Viewer */}
      <PollManifestViewer manifest={manifestData} />
      
      {/* 2. COMPONENT: Sponsor Gas Station (Visible only to Sponsor) */}
      {isSponsored && account?.toLowerCase() === sponsorAddress?.toLowerCase() && !isClosed && (
        <GasRefillStation 
          pollId={pollId} 
          votingHubAddress={votingHubAddress} 
          provider={provider} 
        />
      )}

      {/* 3. PANEL: Core Information & Subject */}
      <div className="glass-panel relative overflow-hidden border border-[#f0f0f0]/10 bg-[#0a0a0a]/80 p-5 md:p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl z-20">
        <div className="absolute top-[-100px] right-[-100px] h-[300px] w-[300px] rounded-full bg-[#ccff00]/5 blur-[120px] pointer-events-none" />
        
        {/* Header */}
        <div className="mb-6 flex flex-col items-start justify-between gap-3 border-b border-[#f0f0f0]/10 pb-4 md:flex-row md:items-end relative z-10">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-black uppercase tracking-widest text-[#f0f0f0] drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
              {showResults ? (isClosed ? "Final Output" : "Live Telemetry") : "Cast Payload"}
            </h2>
          </div>
          
          <div className={`flex items-center space-x-2 border px-2 py-1 font-mono text-[9px] uppercase tracking-widest bg-black/40 backdrop-blur-sm
            ${isClosed ? 'border-red-500/30 text-red-500' : 'border-[#ccff00]/30 text-[#ccff00]'}`}
          >
            {!isClosed && <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] animate-pulse" />}
            <span>{isClosed ? "[ HALTED ]" : "[ TTL ]"} {timeLeftStr}</span>
          </div>
        </div>

        {/* Question Area */}
        <div className="relative z-10">
          <label className="mb-2 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#f0f0f0]/40 flex items-center space-x-2">
            <span className="text-[#ccff00] opacity-50">&gt;</span> 
            <span>MANIFEST_SUBJECT</span>
          </label>

          <h3 className={`break-words font-display leading-[1.2] uppercase tracking-tight text-[#f0f0f0] transition-all duration-300
            ${isExpanded ? 'text-m md:text-xl font-black opacity-100' : 'text-2xl md:text-3xl font-black opacity-90'}`}
          >
            {displayQuestion}
          </h3>

          {needsTruncation && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#f0f0f0]/40 transition-colors hover:text-[#ccff00] bg-[#f0f0f0]/5 px-2 py-1 border border-[#f0f0f0]/10"
            >
              <span className="text-[#ccff00] font-bold text-xs">{isExpanded ? "-" : "+"}</span>
              {isExpanded ? "COLLAPSE_METADATA" : "DECRYPT_FULL_SUBJECT"}
            </button>
          )}

          {isSponsored && (
            <div className="mt-5 inline-flex items-center gap-2 border border-[#ccff00]/30 bg-[#ccff00]/5 px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[#ccff00]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ccff00] opacity-50"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ccff00]"></span>
              </span>
              Sponsorship: ACTIVE // GASLESS_EXECUTION
            </div>
          )}
        </div>
      </div>

      {/* 4. PANEL: Interactive Routing (Voting or Results) */}
      <div className="glass-panel relative overflow-visible border border-[#f0f0f0]/10 bg-[#0a0a0a]/80 p-5 md:p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl z-10">
        {showResults ? (
            <VoteTelemetry
            userVotedFor={userVotedFor}
            pollResults={pollResults}
            totalVotes={totalVotes}
          />
        ) : (
          <div className="animate-fade-in relative z-10">
            {(!startPassportFlow || manifestData?.verificationMethod !== "zkpassport") && (
              <div className="mb-6">
                <label className="mb-3 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#f0f0f0]/40 flex items-center space-x-2">
                  <span className="text-[#ccff00] opacity-50">&gt;</span> 
                  <span>SELECT_NODE_TARGET</span>
                </label>
                <NodeSelector
                  options={options}
                  selectedOption={selectedOption}
                  setSelectedOption={setSelectedOption}
                />
              </div>
            )}

            <ProvingEngineRouter
              method={manifestData?.verificationMethod}
              startPassportFlow={startPassportFlow}
              setStartPassportFlow={setStartPassportFlow}
              pollId={pollId}
              selectedOption={selectedOption}
              manifestData={manifestData}
              votingHubAddress={votingHubAddress}
              provider={provider}
              handleVoteSuccess={handleVoteSuccess}
              displayInputs={displayInputs}
              setZkInputs={setZkInputs}
              submitLocalVote={submitLocalVote}
              isProving={isProving}
              txStatus={txStatus}
              executeBlockchainTx={executeBlockchainTx}
            />
          </div>
        )}
      </div>
    </div>
  );
}