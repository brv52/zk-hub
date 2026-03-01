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

  useEffect(() => {
    const fetchPollData = async () => {
      if (!provider) return;
      try {
        setIsLoading(true);
        const contract = new ethers.Contract(votingHubAddress, abi.abi, provider);
        
        const pollData = await contract.polls(pollId);
        if (!pollData[5]) throw new Error("Poll not found.");
        
        const fetchedOptions = await contract.getOptions(pollId);
        setOptions(fetchedOptions);
        
        const manifestUrl = resolveGateway(pollData[4]);
        const res = await fetch(manifestUrl);
        
        if (!res.ok) throw new Error("Failed to load manifest from IPFS.");
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

  const submitLocalVote = async () => {
    if (selectedOption === null) return alert("Please select an option first.");
    setIsProving(true);
    setTxStatus("Step 1/3: Resolving local inputs...");

    try {
        const hubContract = new ethers.Contract(votingHubAddress, abi.abi, provider);
        const pollData = await hubContract.polls(pollId);
        
        const inputState = { ...zkInputs, pollId: pollId.toString() };
        const fullInputs = await resolveSystemInputs(manifestData, inputState, pollData[1], provider);

        setTxStatus("Step 2/3: Generating and Encoding Universal Payload...");
        
        const encodedProofData = await generateAndEncodeProof(manifestData, fullInputs);

        setTxStatus("Step 3/3: Requesting transaction signature...");
        const signer = await provider.getSigner();
        const hubWithSigner = new ethers.Contract(votingHubAddress, abi.abi, signer);

        const tx = await hubWithSigner.vote(
            pollId, 
            selectedOption, 
            encodedProofData, 
            { gasLimit: 1200000 }
        );

        setTxStatus("Waiting for network confirmation...");
        await tx.wait();
        setTxStatus("✅ Success! Your anonymous vote was recorded.");
    } catch (err) {
        setTxStatus(`❌ Error: ${err.reason || err.message}`);
    } finally {
        setIsProving(false);
    }
  };

  if (isLoading) return <div className="p-12 text-center text-gray-500 animate-pulse">Loading blockchain state...</div>;
  if (pageError) return <div className="p-6 text-red-800 bg-red-50 text-center">{pageError}</div>;

  const isZKPassport = manifestData?.verificationMethod === "zkpassport";
  const zkPassportReqs = isZKPassport ? manifestData.config : null;;

  return (
    <div className="space-y-8 pb-12">
      <PollManifestViewer pollId={pollId} votingHubAddress={votingHubAddress} provider={provider} />
      
      {!startPassportFlow ? (
        <div className="bg-white shadow rounded-lg border p-6">
          <h3 className="text-xl font-bold mb-4">Cast Your Vote</h3>
          
          <div className="space-y-3 mb-6">
            {options.map((opt, idx) => (
              <label key={idx} className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${selectedOption === idx ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-gray-50'}`}>
                <input type="radio" name="voteOption" onChange={() => setSelectedOption(idx)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                <span className="ml-3 font-medium text-gray-900">{opt}</span>
              </label>
            ))}
          </div>

          {!isZKPassport ? (
            <div className="space-y-4 mb-6 border-t pt-4">
              {displayInputs.map((input) => (
                <div key={input.id}>
                  <label className="block text-sm font-medium text-gray-700 capitalize">{input.label}</label>
                  <input
                    type={input.type === "number" ? "number" : "text"}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
                    placeholder={input.description || `Enter ${input.label}`}
                    onChange={(e) => setZkInputs((prev) => ({ ...prev, [input.id]: e.target.value }))}
                  />
                </div>
              ))}
              <button onClick={submitLocalVote} disabled={isProving} className={`w-full py-4 rounded-md text-white font-bold transition ${isProving ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-sm"}`}>
                {isProving ? "Processing Cryptography..." : "Generate Proof & Vote"}
              </button>
            </div>
          ) : (
            <div className="border-t pt-6">
              <button 
                onClick={() => selectedOption !== null ? setStartPassportFlow(true) : alert("Please select an option before proceeding.")} 
                className="w-full py-4 rounded-md text-white font-bold bg-gray-900 hover:bg-black shadow-sm transition"
              >
                Authenticate with ZKPassport & Vote
              </button>
            </div>
          )}
          
          {txStatus && !isZKPassport && <div className="mt-4 p-4 rounded-md text-sm font-bold bg-blue-50 border border-blue-200 text-blue-800">{txStatus}</div>}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setStartPassportFlow(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900 flex items-center gap-2">
            &larr; Change Selection
          </button>
          <ZKPassportStation 
            pollId={pollId} 
            selectedOption={selectedOption} 
            requirements={zkPassportReqs} 
            votingHubAddress={votingHubAddress} 
            provider={provider} 
          />
        </div>
      )}
    </div>
  );
}