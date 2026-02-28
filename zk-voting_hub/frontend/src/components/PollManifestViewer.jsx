import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import abi from "../contracts/VotingHub.json"
import { parseZKPassportConfig } from '../utils/inputResolver';

const isValidCID = (cid) => /^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|baf[0-9A-Za-z]{50,})$/i.test(cid);

export default function PollManifestViewer({ pollId, votingHubAddress, provider }) {
  const [manifest, setManifest] = useState(null);
  const [displayInputs, setDisplayInputs] = useState([]);
  const [zkPassportReqs, setZkPassportReqs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchManifest = async () => {
      try {
        setLoading(true);
        const contract = new ethers.Contract(votingHubAddress, abi.abi, provider);
        
        const pollData = await contract.polls(pollId);
        if (!pollData[5]) throw new Error("Poll does not exist."); 

        const cid = pollData[4]; 
        if (!cid || !isValidCID(cid)) throw new Error("Invalid or missing IPFS CID.");

        const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, { signal: abortController.signal });
        if (!response.ok) throw new Error("Failed to fetch manifest from IPFS.");

        const data = await response.json();

        // Interpret ZKPassport vs Local Circuit Proofing
        if (data.verificationMethod === "zkpassport") {
            setZkPassportReqs(parseZKPassportConfig(data));
        } else {
            const inputsToDisplay = data?.frontendDisplay?.userInputs || data?.frontendDisplay?.customInputs;
            if (!inputsToDisplay || !Array.isArray(inputsToDisplay)) {
              throw new Error("Invalid Manifest Schema: Missing input array definitions.");
            }
            setDisplayInputs(inputsToDisplay); 
        }

        setManifest(data);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || "An error occurred fetching the IPFS manifest.");
      } finally {
        setLoading(false);
      }
    };

    if (provider && votingHubAddress) fetchManifest();
    return () => abortController.abort();
  }, [pollId, votingHubAddress, provider]);

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading poll verification requirements from IPFS...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium">Error: {error}</div>;
  if (!manifest) return null;

  const isZKPassport = manifest.verificationMethod === "zkpassport";

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
      <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{manifest.metadata?.name || "Anonymous Poll"}</h3>
          <p className="mt-1 text-sm text-gray-500">{manifest.metadata?.description}</p>
        </div>
        {isZKPassport && (
           <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
             ZKPassport Biometric
           </span>
        )}
      </div>

      <div className="px-4 py-5 sm:p-6">
        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
            {isZKPassport ? "Required Identity Constraints" : "Required Cryptographic Inputs"}
        </h4>
        
        {isZKPassport ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {zkPassportReqs?.minAge && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 shadow-sm">
                <dt className="text-sm font-bold text-gray-900">Minimum Age</dt>
                <dd className="mt-1 text-sm text-gray-600">Must be {zkPassportReqs.minAge} years or older.</dd>
              </div>
            )}
            {zkPassportReqs?.nationality && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 shadow-sm">
                <dt className="text-sm font-bold text-gray-900">Eligible Nationalities</dt>
                <dd className="mt-1 text-sm text-gray-600">{zkPassportReqs.nationality.join(", ")}</dd>
              </div>
            )}
          </dl>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {displayInputs.map((input) => (
              <div key={input.id} className="bg-gray-50 p-4 rounded-md border border-gray-200 shadow-sm">
                <dt className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  {input.label}
                  {input.isPrivate && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-800 border border-green-200">Private</span>}
                </dt>
                <dd className="mt-1 text-sm text-gray-600">{input.description}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}