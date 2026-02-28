import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ZKPassport } from "@zkpassport/sdk";
import { ethers } from "ethers";
import abi from "../contracts/VotingHub.json";

const ZKPassportStation = ({ pollId, selectedOption, requirements, votingHubAddress, provider }) => {
  const [qrUrl, setQrUrl] = useState("");
  const [txStatus, setTxStatus] = useState("Initializing SDK Bridge...");
  const [isError, setIsError] = useState(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initZK = async () => {
      try {
        setTxStatus("Connecting to ZKPassport Bridge...");
        const zkPassport = new ZKPassport("localhost"); 

        const queryBuilder = await zkPassport.request({
          name: "zkVote Decentralized Polling",
          purpose: `Anonymous Vote for Poll #${pollId}`,
          mode: "compressed-evm", 
          devMode: true, 
          scope: "voting-scope" 
        });

        queryBuilder.bind("custom_data", pollId.toString());

        if (requirements?.minAge) {
          queryBuilder.gte("age", requirements.minAge);
        }

        // 3. Ask the mobile app to prove citizenship
        if (requirements?.nationality && requirements.nationality.length > 0) {
          queryBuilder.in("nationality", requirements.nationality);
        }

        const request = queryBuilder.done();
        
        setQrUrl(request.url);
        setTxStatus("QR Ready. Scan with your ZKPassport mobile app.");

        let capturedProof = null;
        request.onProofGenerated((proof) => {
          console.log("✅ Identity Proof mathematically validated on device.");
          capturedProof = proof;
          setTxStatus("Proof received! Awaiting final bridge verification...");
        });

        request.onResult(async ({ verified, uniqueIdentifier }) => {
          if (!verified) {
            setIsError(true);
            setTxStatus("Error: Cryptographic verification failed.");
            return;
          }

          if (capturedProof) {
            setTxStatus("Proof valid! Please sign the Web3 transaction to cast your vote...");
            await sendVoteToBlockchain(zkPassport, capturedProof);
          }
        });

        request.onError((error) => {
          setIsError(true);
          setTxStatus(`SDK Bridge Error: ${error}`);
        });

      } catch (err) {
        setIsError(true);
        setTxStatus(`Initialization Error: ${err.message}`);
        isInitialized.current = false;
      }
    };

    initZK();
  }, [pollId, requirements]);

  const sendVoteToBlockchain = async (zk, proof) => {
    try {
      const signer = await provider.getSigner();
      const votingHub = new ethers.Contract(votingHubAddress, abi.abi, signer);

      // Get the raw parameters from the ZKPassport SDK
      const rawParams = zk.getSolidityVerifierParameters({
        proof: proof,
        devMode: true,
        scope: "voting-scope", // 3. MUST ALSO MATCH HERE
      });

      // 1. Define the exact struct tuple expected by the ZKPassport Contract
      const proofVerificationDataTuple = "tuple(bytes32 vkeyHash, bytes proof, bytes32[] publicInputs)";
      const serviceConfigTuple = "tuple(uint256 validityPeriodInSeconds, string domain, string scope, bool devMode)";
      const paramsTuple = `tuple(bytes32 version, ${proofVerificationDataTuple} proofVerificationData, bytes committedInputs, ${serviceConfigTuple} serviceConfig)`;

      // 2. Format the object cleanly for ethers.js encoding
      const formattedParams = {
        version: rawParams.version,
        proofVerificationData: {
          vkeyHash: rawParams.proofVerificationData.vkeyHash,
          proof: rawParams.proofVerificationData.proof,
          publicInputs: rawParams.proofVerificationData.publicInputs
        },
        committedInputs: rawParams.committedInputs,
        serviceConfig: {
          validityPeriodInSeconds: rawParams.serviceConfig.validityPeriodInSeconds,
          domain: rawParams.serviceConfig.domain,
          scope: rawParams.serviceConfig.scope,
          devMode: rawParams.serviceConfig.devMode
        }
      };

      // 3. Encode the entire struct into a single 'bytes' hex string
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const encodedProofData = abiCoder.encode([paramsTuple], [formattedParams]);

      // 4. Send to the UNIVERSAL Hub interface
      const tx = await votingHub.vote(
        pollId,
        selectedOption,
        encodedProofData,
        { gasLimit: 3000000 } // ZK proofs are heavy, allocate safe gas
      );

      setTxStatus("Transaction pending on-chain. Please wait...");
      await tx.wait();
      setTxStatus("✅ Success! Your anonymous passport vote has been recorded.");

    } catch (err) {
      setIsError(true);
      const reason = err.reason || err.message;
      setTxStatus(`Transaction Error: ${reason}`);
    }
  };

  return (
    <div className="bg-white p-6 shadow sm:rounded-lg border border-gray-200 text-center animate-fade-in">
      <h3 className="text-xl font-bold text-gray-900 mb-2">Secure Voting Gateway</h3>
      <p className="text-sm text-gray-500 mb-6">Authenticate anonymously via your government-issued ID.</p>
      
      <div className="flex justify-center mb-6">
        <div className="bg-white p-4 border border-gray-200 shadow-sm rounded-xl inline-block">
          {qrUrl ? (
            <QRCodeSVG value={qrUrl} size={256} level="H" includeMargin={true} />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-gray-50 text-gray-400 rounded-lg animate-pulse">
              Loading QR...
            </div>
          )}
        </div>
      </div>

      <div className={`mt-4 p-4 rounded-md text-sm font-bold max-w-md mx-auto
        ${isError ? "bg-red-50 text-red-800 border border-red-200" 
        : txStatus.includes("✅") ? "bg-green-50 text-green-800 border border-green-200" 
        : "bg-blue-50 text-blue-800 border border-blue-200"}`}
      >
        {txStatus}
      </div>
    </div>
  );
};

export default ZKPassportStation;