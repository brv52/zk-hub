import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { ZKPassport } from '@zkpassport/sdk';
import { QRCodeSVG } from "qrcode.react";
import abi from '../contracts/VotingHub.json';

export default function ZKPassportStation({ pollId, selectedOption, requirements, votingHubAddress, provider, onVoteSuccess }) {
    const [qrUrl, setQrUrl] = useState("");
    const [status, setStatus] = useState("> INIT_SDK_BRIDGE...");
    const [isError, setIsError] = useState(false);
    const isInitialized = useRef(false);

    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        const initZK = async () => {
            try {
                setStatus("> CONNECTING_TO_BRIDGE...");
                const hostname = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
                const zkPassport = new ZKPassport(hostname);

                const queryBuilder = await zkPassport.request({
                    name: "ZK_VOTING_HUB",
                    purpose: `SYS.VOTE_POLL_${pollId}`,
                    mode: "compressed-evm", 
                    devMode: true, 
                    scope: "voting-scope" 
                });

                queryBuilder.bind("custom_data", pollId.toString());

                let builder = queryBuilder;

                for (const [key, value] of Object.entries(requirements || {})) {
                  if (key === 'pollId') continue;

                  if (Array.isArray(value)) {
                    builder = builder.in(key, value);
                  }
                  else if (key.toLowerCase().startsWith('min')) {
                    const attr = key.replace('min', '').toLowerCase();
                    builder = builder.gte(attr, Number(value));
                  }
                  else if (key.toLowerCase().startsWith('max')) {
                    const attr = key.replace('max', '').toLowerCase();
                    builder = builder.lte(attr, Number(value));
                  }
                  else {
                    builder = builder.eq(key, value);
                  }
                }

                const request = builder.done();
                setQrUrl(request.url);
                setStatus("> AWAITING_OPTICAL_SCAN...");

                request.onProofGenerated(async (proof) => {
                    setStatus("> PROOF_RECEIVED. TRIGGERING_METAMASK...");
                    await sendVoteToBlockchain(zkPassport, proof);
                });

                // Оставляем onResult просто для логирования, мы больше не ждем его
                request.onResult((result) => {
                    console.log("Local browser verification finished (ignored):", result);
                });

                request.onError((error) => {
                    setIsError(true);
                    setStatus(`> SDK_ERR: ${error.message || error}`);
                });

            } catch (err) {
                setIsError(true);
                setStatus(`> INIT_ERR: ${err.message}`);
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

            // Используем new ethers.AbiCoder() для 100% совместимости с ethers v6
            const abiCoder = new ethers.AbiCoder();
            const encodedProofData = abiCoder.encode([paramsTuple], [formattedParams]);

            setStatus("> AWAITING_LEDGER_SIGNATURE...");
            const tx = await hubContract.vote(pollId, selectedOption, encodedProofData, { gasLimit: 2500000 });
            
            setStatus("> TX_SENT. AWAITING_CONFIRMATION...");
            await tx.wait();
            
            setStatus("> SUCCESS: ANONYMOUS_PAYLOAD_RECORDED.");
            
            // 2. ГЛАВНОЕ: Вызываем коллбэк для родителя (с небольшой задержкой для UX)
            if (onVoteSuccess) {
                setTimeout(() => {
                    onVoteSuccess();
                }, 1500); 
            }

        } catch (err) {
            setIsError(true);
            setStatus(`> TX_ERR: ${err.reason || err.message}`);
            console.error("Blockchain Error:", err);
        }
    };

    return (
        <div className="glass-panel p-8 border-[#ccff00]/50 text-center max-w-lg mx-auto shadow-[0_0_50px_rgba(204,255,0,0.05)]">
            <h3 className="font-display text-2xl font-black uppercase tracking-widest text-[#f0f0f0] mb-2">Biometric Gateway</h3>
            <p className="font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em] mb-8">VERIFY_IDENTITY_VIA_PASSPORT</p>

            <div className="flex flex-col items-center mb-8">
                <div className="bg-[#f0f0f0] p-4 border-4 border-[#0a0a0a] mb-6">
                    {qrUrl ? (
                        <QRCodeSVG value={qrUrl} size={220} level="H" includeMargin={false} />
                    ) : (
                        <div className="w-[220px] h-[220px] flex items-center justify-center bg-[#f0f0f0] text-[#0a0a0a] font-mono text-xs font-bold uppercase tracking-widest animate-pulse border-2 border-dashed border-[#0a0a0a]/20">
                            [ GENERATING... ]
                        </div>
                    )}
                </div>

                {qrUrl && (
                    <a 
                        href={qrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="brutal-btn !border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a] w-full max-w-[250px]"
                    >
                        &gt; EXECUTE_DEEP_LINK
                    </a>
                )}
            </div>

            <div className={`p-4 font-mono text-xs uppercase tracking-widest border transition-none
                ${isError ? "bg-red-500/10 text-red-500 border-red-500" 
                : status.includes("SUCCESS") ? "bg-[#ccff00]/10 text-[#ccff00] border-[#ccff00]" 
                : "bg-transparent text-[#f0f0f0] border-[#f0f0f0]/30 animate-pulse"}`}
            >
                {status}
            </div>
            
            {isError && (
                <button onClick={() => window.location.reload()} className="mt-6 font-mono text-[10px] text-red-500 uppercase tracking-[0.3em] hover:text-[#f0f0f0] transition-none border-b border-red-500 hover:border-[#f0f0f0] pb-1">
                    [ RESTART_SEQUENCE ]
                </button>
            )}
        </div>
    );
}