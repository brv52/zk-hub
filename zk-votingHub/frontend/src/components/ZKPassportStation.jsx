import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { ZKPassport } from '@zkpassport/sdk';
import { QRCodeSVG } from "qrcode.react";
import abi from '../contracts/VotingHub.json';

export default function ZKPassportStation({ pollId, selectedOption, requirements, votingHubAddress, provider }) {
    const [qrUrl, setQrUrl] = useState("");
    const [status, setStatus] = useState("Initializing SDK Bridge...");
    const [isError, setIsError] = useState(false);
    const isInitialized = useRef(false);

    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        const initZK = async () => {
            try {
                setStatus("Connecting to ZKPassport Bridge...");
                const hostname = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
                const zkPassport = new ZKPassport(hostname);

                const queryBuilder = await zkPassport.request({
                    name: "ZK Voting Hub",
                    purpose: `Anonymous Vote for Poll #${pollId}`,
                    mode: "compressed-evm", 
                    devMode: true, 
                    scope: "voting-scope" 
                });

                queryBuilder.bind("custom_data", pollId.toString());

                if (requirements?.minAge) {
                    queryBuilder.gte("age", Number(requirements.minAge));
                }
                if (requirements?.nationality && requirements.nationality.length > 0) {
                    queryBuilder.in("nationality", requirements.nationality);
                }

                const request = queryBuilder.done();
                setQrUrl(request.url);
                setStatus("Scan QR or use the link below if you are on mobile.");

                let capturedProof = null;

                request.onProofGenerated((proof) => {
                    console.log("🧩 ZKPassport: Proof generated", proof);
                    capturedProof = proof;
                    setStatus("Proof received! Awaiting final bridge verification...");
                });

                request.onResult(async (result) => {
                    const isVerified = result === true || result?.verified === true;
                    if (!isVerified) {
                        setIsError(true);
                        setStatus("Error: Cryptographic verification failed.");
                        return;
                    }

                    if (capturedProof) {
                        setStatus("Proof valid! Please sign the Web3 transaction...");
                        await sendVoteToBlockchain(zkPassport, capturedProof);
                    }
                });

                request.onError((error) => {
                    setIsError(true);
                    setStatus(`SDK Bridge Error: ${error.message || error}`);
                });

            } catch (err) {
                setIsError(true);
                setStatus(`Initialization Error: ${err.message}`);
                isInitialized.current = false;
            }
        };

        initZK();
    }, [pollId, requirements]);

    const sendVoteToBlockchain = async (zk, proof) => {
        try {
            const signer = await provider.getSigner();
            const hubContract = new ethers.Contract(votingHubAddress, abi.abi, signer);

            const rawParams = zk.getSolidityVerifierParameters({
                proof: proof,
                devMode: true,
                scope: "voting-scope", 
            });

            const proofVerificationDataTuple = "tuple(bytes32 vkeyHash, bytes proof, bytes32[] publicInputs)";
            const serviceConfigTuple = "tuple(uint256 validityPeriodInSeconds, string domain, string scope, bool devMode)";
            const paramsTuple = `tuple(bytes32 version, ${proofVerificationDataTuple} proofVerificationData, bytes committedInputs, ${serviceConfigTuple} serviceConfig)`;

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

            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const encodedProofData = abiCoder.encode([paramsTuple], [formattedParams]);

            const tx = await hubContract.vote(pollId, selectedOption, encodedProofData, { gasLimit: 2500000 });
            await tx.wait();
            setStatus("✅ Success! Your anonymous vote has been recorded.");

        } catch (err) {
            setIsError(true);
            setStatus(`Transaction Error: ${err.reason || err.message}`);
        }
    };

    return (
        <div className="bg-white p-8 border-2 border-blue-500 rounded-xl text-center shadow-xl max-w-lg mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">ZKPassport Gateway</h3>
            <p className="text-gray-600 text-sm mb-6">Verify your identity to vote. Personal data stays on your device.</p>

            <div className="flex flex-col items-center mb-6">
                <div className="bg-white p-4 border border-gray-100 shadow-inner rounded-2xl mb-4">
                    {qrUrl ? (
                        <QRCodeSVG value={qrUrl} size={220} level="H" includeMargin={true} />
                    ) : (
                        <div className="w-56 h-56 flex items-center justify-center bg-gray-50 text-gray-400 rounded-lg animate-pulse">
                            Generating Session...
                        </div>
                    )}
                </div>

                {/* НОВАЯ КНОПКА ДЛЯ МОБИЛЬНЫХ ПОЛЬЗОВАТЕЛЕЙ */}
                {qrUrl && (
                    <a 
                        href={qrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-6 py-3 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-all active:scale-95"
                    >
                        <span className="mr-2"></span> Open in ZKPassport App
                    </a>
                )}
            </div>

            <div className={`p-4 rounded-lg text-sm font-bold border transition-colors
                ${isError ? "bg-red-50 text-red-800 border-red-200" 
                : status.includes("✅") ? "bg-green-50 text-green-800 border-green-200" 
                : "bg-blue-50 text-blue-800 border-blue-200"}`}
            >
                {status}
            </div>
            
            {isError && (
                <button onClick={() => window.location.reload()} className="mt-4 text-xs font-bold text-blue-600 hover:underline">
                    Restart Session
                </button>
            )}
        </div>
    );
}