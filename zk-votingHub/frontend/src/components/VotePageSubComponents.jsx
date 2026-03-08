import React from 'react';
import ZKPassportStation from "./ZKPassportStation";

export const VoteTelemetry = ({ userVotedFor, pollResults, totalVotes }) => (
  <div className="animate-fade-in space-y-8">
    {userVotedFor && (
      <div className="border border-[#ccff00] bg-[#ccff00]/10 p-4 font-mono text-xs uppercase tracking-widest text-[#ccff00]">
        &gt; PAYLOAD_DELIVERED. LOCAL_HASH: {userVotedFor}
      </div>
    )}
    
    <div className="space-y-6">
      {pollResults.map((result, idx) => {
        const percentage = totalVotes === 0 ? 0 : Math.round((result.count / totalVotes) * 100);
        return (
          <div key={idx} className="group relative">
            <div className="mb-2 flex items-end justify-between font-mono text-xs uppercase tracking-widest">
              <span className="flex items-center gap-2 font-bold text-[#f0f0f0]">
                <span className="opacity-50 text-[#ccff00]">&gt;</span> 
                {result.name}
              </span>
              <span className="text-sm font-black text-[#ccff00]">
                {percentage}% <span className="text-[10px] font-normal text-[#f0f0f0]/30">[{result.count} OP]</span>
              </span>
            </div>
            
            <div className="relative flex w-full overflow-hidden bg-[#f0f0f0]/10 h-[2px]">
              <div 
                style={{ width: `${percentage}%` }} 
                className="h-full bg-[#ccff00] shadow-[0_0_10px_#ccff00] transition-all duration-1000 ease-out"
              />
              <div 
                style={{ left: `calc(${percentage}% - 4px)` }}
                className="absolute top-0 h-full w-2 bg-[#f0f0f0]"
              />
            </div>
          </div>
        );
      })}
    </div>
    
    <div className="mt-8 border-t border-[#f0f0f0]/20 pt-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[#f0f0f0]/50">
      TOTAL_VERIFIED_NODES: <span className="font-bold text-[#ccff00]">{totalVotes}</span>
    </div>
  </div>
);

export const NodeSelector = ({ options, selectedOption, setSelectedOption }) => (
  <div className="mb-8 space-y-4">
    {options.map((opt, idx) => (
      <label 
        key={idx} 
        onClick={() => setSelectedOption(idx)}
        className={`group flex cursor-pointer items-center border p-4 transition-none
          ${selectedOption === idx 
            ? 'border-[#ccff00] bg-[#ccff00] text-[#0a0a0a] shadow-[4px_4px_0px_0px_#f0f0f0]' 
            : 'border-[#f0f0f0]/20 text-[#f0f0f0] hover:bg-[#f0f0f0] hover:text-[#0a0a0a]'}`}
      >
        <div className={`mr-4 flex h-4 w-4 flex-shrink-0 items-center justify-center border transition-none
          ${selectedOption === idx ? 'border-[#0a0a0a] bg-[#0a0a0a]' : 'border-[#f0f0f0]/50 group-hover:border-[#0a0a0a]'}`}>
          {selectedOption === idx && <div className="h-2 w-2 bg-[#ccff00]" />}
        </div>
        <span className="font-mono text-xs font-bold uppercase tracking-widest">{opt}</span>
      </label>
    ))}
  </div>
);

export const ProvingEngineRouter = (props) => {
  const {
    method, startPassportFlow, setStartPassportFlow, pollId, selectedOption, 
    manifestData, votingHubAddress, provider, handleVoteSuccess, displayInputs, 
    setZkInputs, submitLocalVote, isProving, txStatus, executeBlockchainTx
  } = props;

  // BRANCH 1: ZK Passport Flow
  if (method === "zkpassport") {
    if (startPassportFlow) {
      return (
        <div className="space-y-6">
          <button 
            onClick={() => setStartPassportFlow(false)} 
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#f0f0f0]/50 transition-none hover:text-[#f0f0f0]"
          >
            &lt; TERM.KILL_PASSPORT_AUTH()
          </button>
          <ZKPassportStation
            pollId={pollId} 
            selectedOption={selectedOption} 
            requirements={manifestData.config} 
            votingHubAddress={votingHubAddress} 
            provider={provider} 
            onVoteSuccess={handleVoteSuccess}
            executeBlockchainTx={executeBlockchainTx}
          />
        </div>
      );
    }
    return (
      <div className="border-t border-[#f0f0f0]/20 pt-8">
        <button 
          onClick={() => selectedOption !== null ? setStartPassportFlow(true) : alert("ERR: NO_NODE_SELECTED")} 
          className="brutal-btn w-full !border-[#ccff00] !py-5 !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a]"
        >
          [ AUTHENTICATE_VIA_ZK_PASSPORT ]
        </button>
      </div>
    );
  }

  // BRANCH 2: Local Generation Flow
  return (
    <div className="mb-6 space-y-6 border-t border-[#f0f0f0]/20 pt-6">
      <h4 className="mb-4 border-l-2 border-[#ccff00] pl-3 font-mono text-xs font-bold uppercase tracking-widest text-[#f0f0f0]">
        // INJECT_LOCAL_VARIABLES
      </h4>
      {displayInputs.map((input) => (
        <div key={input.id}>
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
            &gt; {input.label.toUpperCase()}
          </label>
          <input
            type={input.type === "number" ? "number" : "text"}
            placeholder={`[ ENTER_${input.label.toUpperCase()} ]`}
            onChange={(e) => setZkInputs((prev) => ({ ...prev, [input.id]: e.target.value }))}
            className="w-full border border-[#f0f0f0]/20 bg-transparent p-4 font-mono text-xs uppercase tracking-widest text-[#f0f0f0] outline-none transition-none focus:border-[#ccff00] focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      ))}
      <button 
        onClick={submitLocalVote} 
        disabled={isProving} 
        className={`brutal-btn mt-4 w-full !py-5 ${isProving ? 'pointer-events-none !border-[#f0f0f0]/20 !text-[#f0f0f0]/20' : '!border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a]'}`}
      >
        {isProving ? <span className="animate-glitch">[ PROVING_CIRCUIT... ]</span> : "GENERATE_PROOF && EXECUTE_VOTE"}
      </button>
      
      {txStatus && (
        <div className="mt-6 border border-[#ccff00] bg-[#ccff00]/10 p-4 font-mono text-xs uppercase tracking-widest text-[#ccff00]">
          {txStatus}
        </div>
      )}
    </div>
  );
};