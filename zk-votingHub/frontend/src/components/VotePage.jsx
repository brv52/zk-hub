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
  const TEXT_LIMIT = 50;
  const needsTruncation = pollSubject.length > TEXT_LIMIT;

  const getTruncatedText = (text) => {
    if (!needsTruncation || isExpanded) return text;
    const start = text.substring(0, TEXT_LIMIT / 2);
    const end = text.substring(text.length - TEXT_LIMIT / 2);
    return `${start}...${end}`;
  };

  const displayQuestion = getTruncatedText(pollSubject);

  if (isLoading) {
    return (
      <div className="glass-panel mx-auto w-full max-w-4xl animate-pulse p-12 text-center font-mono uppercase tracking-widest text-[#ccff00]">
        [ SYNCING_LEDGER_STATE... ]
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="glass-panel mx-auto w-full max-w-4xl border-red-500/50 bg-red-500/10 p-6 font-mono uppercase tracking-widest text-red-500">
        [ ERR: {pageError} ]
      </div>
    );
  }

  const showResults = isClosed || userVotedFor;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-12">
      <PollManifestViewer manifest={manifestData} />
      {isSponsored && account.toLowerCase() === sponsorAddress?.toLowerCase() && !isClosed && (
        <GasRefillStation 
          pollId={pollId} 
          votingHubAddress={votingHubAddress} 
          provider={provider} 
        />
      )}

      <div className="glass-panel p-6 md:p-8">

        {/* Dynamic Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-[#f0f0f0]/20 pb-4 md:flex-row md:items-end">
          <h3 className="font-display text-3xl font-black uppercase tracking-widest text-[#f0f0f0]">
            {showResults ? (isClosed ? "// FINAL_OUTPUT" : "// LIVE_TELEMETRY") : "// CAST_PAYLOAD"}
          </h3>

          <div className={`border px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest
            ${isClosed ? 'border-red-500 text-red-500' : 'border-[#ccff00] text-[#ccff00]'}`}
          >
            {isClosed ? "[ HALTED ]" : "[ TTL ]"} {timeLeftStr}
          </div>
        </div>

        {/* Poll Subject */}
        <div className="mb-10 w-full border-b border-[#f0f0f0]/10 pb-10">
          <label className="mb-3 block font-mono text-[9px] uppercase tracking-[0.4em] text-[#f0f0f0]/30">
            &gt; MANIFEST_SUBJECT:
          </label>

          <div className="relative">
            <h2 className={`break-words font-display leading-[1.1] uppercase tracking-tight text-[#f0f0f0] transition-all duration-300
              ${isExpanded ? 'text-2xl md:text-3xl font-black opacity-90' : 'text-3xl md:text-4xl font-black opacity-90'}`}
            >
              {displayQuestion}
            </h2>

            {needsTruncation && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#f0f0f0]/40 transition-colors hover:text-[#ccff00]"
              >
                <span className="text-[#ccff00]">{isExpanded ? "[-]" : "[+]"}</span>
                {isExpanded ? "COLLAPSE_METADATA" : "DECRYPT_FULL_SUBJECT"}
              </button>
            )}
          </div>

          {isSponsored && (
            <div className="mt-6 inline-flex items-center gap-2 border border-[#ccff00] px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ccff00]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ccff00] opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ccff00]"></span>
              </span>
              Sponsorship: ACTIVE // GASLESS_VOTING_ENABLED
            </div>
          )}
        </div>

        {/* Main Render Branching */}
        {showResults ? (
            <VoteTelemetry
            userVotedFor={userVotedFor}
            pollResults={pollResults}
            totalVotes={totalVotes}
          />
        ) : (
          <div className="animate-fade-in">
            {(!startPassportFlow || manifestData?.verificationMethod !== "zkpassport") && (
              <NodeSelector
                options={options}
                selectedOption={selectedOption}
                setSelectedOption={setSelectedOption}
              />
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