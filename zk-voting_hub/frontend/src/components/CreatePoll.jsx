import React, { useState } from "react";
import { ethers } from "ethers";

// Renamed to VotingHubArtifact to clarify it's the whole compiled JSON file
import VotingHubArtifact from "../contracts/VotingHub.json";

export default function CreatePoll({ votingHubAddress, provider }) {
  const [formData, setFormData] = useState({ verifier: "", question: "", options: "", metadataURI: "" });
  const [status, setStatus] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    setStatus("Validating inputs...");
    
    try {
      // Strictly validate the Ethereum address before calling the contract
      const trimmedAddress = formData.verifier.trim();
      if (!ethers.isAddress(trimmedAddress)) {
        throw new Error("Invalid verifier address. It must be exactly 42 characters starting with '0x'.");
      }

      setStatus("Requesting signature...");
      const signer = await provider.getSigner();
      
      // Use VotingHubArtifact.abi here ✅
      const contract = new ethers.Contract(votingHubAddress, VotingHubArtifact.abi, signer);

      const optionsArray = formData.options.split(",").map((opt) => opt.trim()).filter(opt => opt !== "");
      if (optionsArray.length < 2) throw new Error("At least 2 valid options are required.");

      // Ensure metadata URI doesn't have accidental spaces either
      const trimmedMetadata = formData.metadataURI.trim();

      const tx = await contract.createPoll(
        trimmedAddress, 
        formData.question, 
        optionsArray, 
        trimmedMetadata
      );
      
      setStatus("Transaction pending on-chain...");
      await tx.wait();
      
      setStatus("✅ Poll successfully created!");
      // Reset form after success
      setFormData({ verifier: "", question: "", options: "", metadataURI: "" });
    } catch (err) {
      console.error(err);
      setStatus(`❌ Error: ${err.reason || err.message}`);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow sm:rounded-lg border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Deploy New Poll</h2>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Custom Verifier Contract Address</label>
          <input 
            required 
            className="mt-1 block w-full rounded-md border-gray-300 p-2 border focus:ring-blue-500 focus:border-blue-500 font-mono text-sm" 
            placeholder="0x..." 
            value={formData.verifier} 
            onChange={(e) => setFormData({ ...formData, verifier: e.target.value })} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Poll Question</label>
          <input 
            required 
            className="mt-1 block w-full rounded-md border-gray-300 p-2 border focus:ring-blue-500 focus:border-blue-500" 
            placeholder="e.g., Upgrade Protocol?" 
            value={formData.question} 
            onChange={(e) => setFormData({ ...formData, question: e.target.value })} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Options (Comma separated)</label>
          <input 
            required 
            className="mt-1 block w-full rounded-md border-gray-300 p-2 border focus:ring-blue-500 focus:border-blue-500" 
            placeholder="Yes, No, Abstain" 
            value={formData.options} 
            onChange={(e) => setFormData({ ...formData, options: e.target.value })} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Manifest IPFS CID (Base32)</label>
          <input 
            required 
            className="mt-1 block w-full rounded-md border-gray-300 p-2 border focus:ring-blue-500 focus:border-blue-500 font-mono text-sm" 
            placeholder="bafybe..." 
            value={formData.metadataURI} 
            onChange={(e) => setFormData({ ...formData, metadataURI: e.target.value })} 
          />
        </div>
        <button 
          type="submit" 
          className="w-full py-3 px-4 rounded-md shadow-sm text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
        >
          Deploy Poll
        </button>
      </form>
      
      {status && (
        <div className={`mt-4 p-3 rounded-md text-sm font-bold ${status.includes("Error") ? "bg-red-50 text-red-800 border border-red-200" : status.includes("✅") ? "bg-green-50 text-green-800 border border-green-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}>
          {status}
        </div>
      )}
    </div>
  );
}