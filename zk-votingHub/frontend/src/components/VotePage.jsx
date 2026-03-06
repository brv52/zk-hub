import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import PollManifestViewer from "./PollManifestViewer";
import ZKPassportStation from "./ZKPassportStation";
import { generateAndEncodeProof } from "../utils/prover";
import abi from "../contracts/VotingHub.json";
import { resolveSystemInputs } from "../utils/inputResolver/inputResolver";

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

const resolveGateway = (uri) => {
    if (!uri) return "";
    if (uri.startsWith("ipfs://")) return uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    if (uri.startsWith("http")) return uri;
    return `https://gateway.pinata.cloud/ipfs/${uri}`;
};

export default function VotePage({ pollId, votingHubAddress, provider }) {
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [manifestData, setManifestData] = useState(null);
  const [displayInputs, setDisplayInputs] = useState([]);
  const [zkInputs, setZkInputs] = useState({});
  const [isProving, setIsProving] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [pageError, setPageError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  const [startPassportFlow, setStartPassportFlow] = useState(false);

  const [endTime, setEndTime] = useState(0);
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [userVotedFor, setUserVotedFor] = useState(null);
  const [pollResults, setPollResults] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    const fetchPollData = async () => {
      if (!provider) return;
      try {
        setIsLoading(true);
        const contract = new ethers.Contract(votingHubAddress, abi.abi, provider);
        
        const pollData = await contract.polls(pollId);
        if (!pollData[6]) throw new Error("INSTANCE_NOT_FOUND");
        
        setEndTime(Number(pollData[5]));

        const fetchedOptions = await contract.getOptions(pollId);
        setOptions(fetchedOptions);
        
        const savedVotes = JSON.parse(localStorage.getItem("zkVotes") || "{}");
        if (savedVotes[pollId.toString()]) {
            setUserVotedFor(savedVotes[pollId.toString()]);
        }

        const manifestUrl = resolveGateway(pollData[4]);
        const res = await fetch(manifestUrl);
        if (!res.ok) throw new Error("ERR: IPFS_MANIFEST_UNREACHABLE");
        
        const manifest = await res.json();
        setManifestData(manifest);
        if (manifest?.verificationMethod !== "zkpassport") {
            const inputsToDisplay = manifest?.inputOrder 
              ? manifest.inputOrder.map(key => ({ id: key, label: key, type: manifest.userInputs?.[key] || 'text' }))
              : manifest?.frontendDisplay?.userInputs || [];
            setDisplayInputs(inputsToDisplay);
        }
      } catch (err) {
        setPageError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPollData();
  }, [pollId, votingHubAddress, provider]);

  useEffect(() => {
    if (!endTime) return;
    
    const updateTimer = () => {
        const now = Math.floor(Date.now() / 1000);
        if (now >= endTime) {
            setIsClosed(true);
            setTimeLeftStr("LIFESPAN_TERMINATED");
        } else {
            const diff = endTime - now;
            const d = Math.floor(diff / 86400);
            const h = Math.floor((diff % 86400) / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            setTimeLeftStr(`${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`);
        }
    };
    
    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [endTime]);

  useEffect(() => {
    const fetchResults = async () => {
      if ((isClosed || userVotedFor) && options.length > 0 && provider) {
          const contract = new ethers.Contract(votingHubAddress, abi.abi, provider);
          let tempTotal = 0;
          let tempResults = [];
          
          for (let i = 0; i < options.length; i++) {
              const count = Number(await contract.getVotes(pollId, i));
              tempResults.push({ name: options[i], count });
              tempTotal += count;
          }
          
          tempResults.sort((a, b) => b.count - a.count);
          setPollResults(tempResults);
          setTotalVotes(tempTotal);
      }
    };
    fetchResults();
  }, [isClosed, userVotedFor, options, provider, pollId, votingHubAddress]);

  // 1️⃣ НОВЫЙ ЕДИНЫЙ ОБРАБОТЧИК УСПЕХА
  const handleVoteSuccess = () => {
    const savedVotes = JSON.parse(localStorage.getItem("zkVotes") || "{}");
    savedVotes[pollId.toString()] = options[selectedOption];
    localStorage.setItem("zkVotes", JSON.stringify(savedVotes));
    
    setTxStatus("");
    setUserVotedFor(options[selectedOption]);
  };

  const submitLocalVote = async () => {
    if (selectedOption === null) return alert("ERR: NO_NODE_SELECTED");
    setIsProving(true);
    setTxStatus("> RESOLVING_LOCAL_INPUTS...");

    try {
        const hubContract = new ethers.Contract(votingHubAddress, abi.abi, provider);
        const pollData = await hubContract.polls(pollId);
        
        const inputState = { ...zkInputs, pollId: pollId.toString() };
        const fullInputs = await resolveSystemInputs(manifestData, inputState, pollData[1], provider);

        setTxStatus("> GENERATING_UNIVERSAL_PAYLOAD...");
        const encodedProofData = await generateAndEncodeProof(manifestData, fullInputs);

        setTxStatus("> AWAITING_LEDGER_SIGNATURE...");
        const signer = await provider.getSigner();
        const hubWithSigner = new ethers.Contract(votingHubAddress, abi.abi, signer);

        const tx = await hubWithSigner.vote(pollId, selectedOption, encodedProofData, { gasLimit: 2500000 });

        setTxStatus("> VERIFYING_BLOCK_INCLUSION...");
        await tx.wait();
        
        // Передаем эстафету единому обработчику
        handleVoteSuccess();
        
    } catch (err) {
        setTxStatus(`> FATAL: ${err.reason || err.message}`);
    } finally {
        setIsProving(false);
    }
  };

  // 2️⃣ ИЗОЛЯЦИЯ ЛОГИКИ РЕНДЕРА ИНТЕРФЕЙСА ПРУВЕРА (Меньше if/else)
  const renderProvingEngine = () => {
    const method = manifestData?.verificationMethod;

    // ВЕТВЬ 1: Внешние SDK (ZKPassport)
    if (method === "zkpassport") {
      if (startPassportFlow) {
        return (
          <div className="space-y-6">
            <button onClick={() => setStartPassportFlow(false)} className="font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.3em] hover:text-[#f0f0f0] transition-none flex items-center gap-2">
              &lt; TERM.KILL_PASSPORT_AUTH()
            </button>
            <ZKPassportStation
              pollId={pollId} 
              selectedOption={selectedOption} 
              requirements={manifestData.config} 
              votingHubAddress={votingHubAddress} 
              provider={provider} 
              onVoteSuccess={handleVoteSuccess} // Прокидываем коллбэк!
            />
          </div>
        );
      }
      return (
        <div className="border-t border-[#f0f0f0]/20 pt-8">
          <button 
            onClick={() => selectedOption !== null ? setStartPassportFlow(true) : alert("ERR: NO_NODE_SELECTED")} 
            className="w-full brutal-btn !border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a] !py-5"
          >
            [ AUTHENTICATE_VIA_ZK_PASSPORT ]
          </button>
        </div>
      );
    }

    // ВЕТВЬ 2: Локальная генерация (Merkle Tree, Storage Proof, etc.)
    return (
      <div className="space-y-6 mb-6 border-t border-[#f0f0f0]/20 pt-6">
        <h4 className="font-mono text-xs font-bold text-[#f0f0f0] uppercase tracking-widest border-l-2 border-[#ccff00] pl-3 mb-4">
          // INJECT_LOCAL_VARIABLES
        </h4>
        {displayInputs.map((input) => (
          <div key={input.id}>
            <label className="block font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em] mb-2">&gt; {input.label.toUpperCase()}</label>
            <input
              type={input.type === "number" ? "number" : "text"}
              className="w-full p-4 bg-transparent border border-[#f0f0f0]/20 text-[#f0f0f0] font-mono text-xs uppercase tracking-widest focus:border-[#ccff00] focus:ring-0 outline-none transition-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder={`[ ENTER_${input.label.toUpperCase()} ]`}
              onChange={(e) => setZkInputs((prev) => ({ ...prev, [input.id]: e.target.value }))}
            />
          </div>
        ))}
        <button onClick={submitLocalVote} disabled={isProving} className={`w-full brutal-btn !py-5 mt-4 ${isProving ? '!border-[#f0f0f0]/20 !text-[#f0f0f0]/20' : '!border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a]'}`}>
          {isProving ? <span className="animate-glitch">[ PROVING_CIRCUIT... ]</span> : "GENERATE_PROOF && EXECUTE_VOTE"}
        </button>
        {txStatus && <div className="mt-6 p-4 border border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00] font-mono text-xs uppercase tracking-widest">{txStatus}</div>}
      </div>
    );
  };

  if (isLoading) return <div className="glass-panel p-12 text-center text-[#ccff00] font-mono tracking-widest uppercase animate-pulse w-full max-w-4xl mx-auto">[ SYNCING_LEDGER_STATE... ]</div>;
  if (pageError) return <div className="glass-panel p-6 text-red-500 border-red-500/50 bg-red-500/10 font-mono tracking-widest uppercase w-full max-w-4xl mx-auto">[ ERR: {pageError} ]</div>;

  const showResults = isClosed || userVotedFor;

  return (
    <div className="space-y-8 pb-12 w-full max-w-4xl mx-auto">
      <PollManifestViewer manifest={manifestData} />
      
      <div className="glass-panel p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-[#f0f0f0]/20 pb-4 gap-4">
              <h3 className="font-display text-3xl font-black uppercase tracking-widest text-[#f0f0f0]">
                  {showResults ? (isClosed ? "// FINAL_OUTPUT" : "// LIVE_TELEMETRY") : "// CAST_PAYLOAD"}
              </h3>
              
              <div className={`px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest border
                  ${isClosed ? 'border-red-500 text-red-500' : 'border-[#ccff00] text-[#ccff00]'}`}
              >
                  {isClosed ? "[ HALTED ]" : "[ TTL ]"} {timeLeftStr}
              </div>
          </div>
          
          {showResults ? (
              <div className="space-y-8 animate-fade-in">
                  {userVotedFor && (
                      <div className="p-4 bg-[#ccff00]/10 border border-[#ccff00] text-[#ccff00] font-mono text-xs uppercase tracking-widest">
                          &gt; PAYLOAD_DELIVERED. LOCAL_HASH: {userVotedFor}
                      </div>
                  )}
                  
                  <div className="space-y-6">
                    {pollResults.map((result, idx) => {
                        const percentage = totalVotes === 0 ? 0 : Math.round((result.count / totalVotes) * 100);
                        return (
                            <div key={idx} className="relative group">
                                {/* Text Data */}
                                <div className="flex mb-2 items-end justify-between font-mono text-xs uppercase tracking-widest">
                                    <span className="text-[#f0f0f0] font-bold flex items-center gap-2">
                                        <span className="text-[#ccff00] opacity-50">&gt;</span> 
                                        {result.name}
                                    </span>
                                    <span className="text-[#ccff00] font-black text-sm">
                                        {percentage}% <span className="text-[#f0f0f0]/30 font-normal text-[10px]">[{result.count} OP]</span>
                                    </span>
                                </div>
                                
                                {/* Cyberpunk Segmented Bar */}
                                <div className="h-[2px] bg-[#f0f0f0]/10 w-full overflow-hidden flex relative">
                                    <div 
                                        style={{ width: `${percentage}%` }} 
                                        className="h-full bg-[#ccff00] shadow-[0_0_10px_#ccff00] transition-all duration-1000 ease-out"
                                    ></div>
                                    <div 
                                        style={{ left: `calc(${percentage}% - 4px)` }}
                                        className="absolute top-0 w-2 h-full bg-[#f0f0f0]"
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                  </div>
                  
                  <div className="text-center font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.3em] mt-8 pt-6 border-t border-[#f0f0f0]/20">
                      TOTAL_VERIFIED_NODES: <span className="text-[#ccff00] font-bold">{totalVotes}</span>
                  </div>
              </div>
          ) : (
            // 3️⃣ ИДЕАЛЬНО ЧИСТЫЙ РЕНДЕР
            <div className="animate-fade-in">
              {(!startPassportFlow || manifestData?.verificationMethod !== "zkpassport") && (
                <div className="space-y-4 mb-8">
                  {options.map((opt, idx) => (
                    <label 
                      key={idx} 
                      onClick={() => setSelectedOption(idx)}
                      className={`flex items-center p-4 border cursor-pointer transition-none group
                        ${selectedOption === idx ? 'bg-[#ccff00] border-[#ccff00] text-[#0a0a0a] shadow-[4px_4px_0px_0px_#f0f0f0]' : 'border-[#f0f0f0]/20 text-[#f0f0f0] hover:bg-[#f0f0f0] hover:text-[#0a0a0a]'}`}
                    >
                      <div className={`w-4 h-4 border mr-4 flex-shrink-0 transition-none flex items-center justify-center
                        ${selectedOption === idx ? 'border-[#0a0a0a] bg-[#0a0a0a]' : 'border-[#f0f0f0]/50 group-hover:border-[#0a0a0a]'}`}>
                        {selectedOption === idx && <div className="w-2 h-2 bg-[#ccff00]"></div>}
                      </div>
                      <span className="font-mono text-xs uppercase tracking-widest font-bold">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Вызов Router Function для рендера нужного движка */}
              {renderProvingEngine()}
            </div>
          )}
      </div>
    </div>
  );
}