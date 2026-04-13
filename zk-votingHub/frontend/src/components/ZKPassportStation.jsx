import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { ZKPassport } from '@zkpassport/sdk';
import { QRCodeSVG } from "qrcode.react";

function resolveRuntimeDomain(requirements) {
    if (requirements?.domain) return requirements.domain;

    const envDomain = import.meta.env.VITE_ZKPASSPORT_DOMAIN;
    if (envDomain) return envDomain;

    if (typeof window !== "undefined" && window.location?.hostname) {
        return window.location.hostname;
    }
    return "localhost";
}

function resolveRuntimeDevMode(domain) {
    const envFlag = import.meta.env.VITE_ZKPASSPORT_DEV_MODE;
    if (typeof envFlag === "string") {
        return envFlag.toLowerCase() === "true";
    }

    return domain === "localhost" || domain === "127.0.0.1";
}

function useZKPassportAuth({ pollId, selectedOption, requirements, executeBlockchainTx, onVoteSuccess }) {
    const [qrUrl, setQrUrl] = useState("");
    const [status, setStatus] = useState("> INIT_SDK_BRIDGE...");
    const [isError, setIsError] = useState(false);
    const executeTxRef = useRef(executeBlockchainTx);
    const onVoteSuccessRef = useRef(onVoteSuccess);

    const runtimeDomain = useMemo(() => resolveRuntimeDomain(requirements), [requirements]);
    const runtimeHost = useMemo(
        () => import.meta.env.VITE_ZKPASSPORT_HOST || runtimeDomain,
        [runtimeDomain]
    );
    const runtimeScope = useMemo(
        () => import.meta.env.VITE_ZKPASSPORT_SCOPE || "voting-scope",
        []
    );
    const runtimeDevMode = useMemo(
        () => resolveRuntimeDevMode(runtimeDomain),
        [runtimeDomain]
    );

    useEffect(() => {
        executeTxRef.current = executeBlockchainTx;
    }, [executeBlockchainTx]);

    useEffect(() => {
        onVoteSuccessRef.current = onVoteSuccess;
    }, [onVoteSuccess]);

    const sendVoteToBlockchain = useCallback(async (zk, proof) => {
        try {
            setStatus("> PROOF_RECEIVED. PREPARING_TRANSACTION...");

            const rawParams = zk.getSolidityVerifierParameters({
                proof: proof,
                devMode: runtimeDevMode,
                scope: runtimeScope,
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

            const abiCoder = new ethers.AbiCoder();
            const encodedProofData = abiCoder.encode([paramsTuple], [formattedParams]);

            await executeTxRef.current(encodedProofData);

            setStatus("> SUCCESS: ANONYMOUS_PAYLOAD_RECORDED.");

            if (onVoteSuccessRef.current) {
                setTimeout(() => {
                    onVoteSuccessRef.current();
                }, 1500);
            }
        } catch (err) {
            setIsError(true);
            setStatus(`> TX_ERR: ${err.reason || err.message}`);
        }
    }, [runtimeDevMode, runtimeScope]);

    useEffect(() => {
        if (selectedOption === null) {
            setQrUrl("");
            setStatus("> SELECT_OPTION_BEFORE_AUTH");
            return;
        }

        let isCancelled = false;

        const initZK = async () => {
            try {
                setIsError(false);
                setQrUrl("");
                setStatus("> CONNECTING_TO_BRIDGE...");
                const zkPassport = new ZKPassport(runtimeHost);

                let builder = await zkPassport.request({
                    name: "ZK_VOTING_HUB",
                    purpose: `SYS.VOTE_POLL_${pollId}`,
                    mode: "compressed-evm",
                    devMode: runtimeDevMode,
                    scope: runtimeScope,
                });

                builder.bind("custom_data", `${pollId}_${selectedOption}`);

                if (requirements) {
                    for (const [key, value] of Object.entries(requirements)) {
                        if (key === 'pollId' || key === 'domain') continue;

                        if (key.startsWith('min')) {
                            const attr = key.replace('min', '').toLowerCase();
                            builder = builder.gte(attr, Number(value));
                        }
                        else if (key.startsWith('max')) {
                            const attr = key.replace('max', '').toLowerCase();
                            builder = builder.lte(attr, Number(value));
                        }
                        else if (key.startsWith('in')) {
                            const attr = key.replace('in', '').toLowerCase();
                            builder = builder.in(attr, Array.isArray(value) ? value : [value]);
                        }
                        else if (key.startsWith('eq')) {
                            const attr = key.replace('eq', '').toLowerCase();
                            builder = builder.eq(attr, value);
                        }
                    }
                }

                const request = builder.done();
                if (isCancelled) return;
                setQrUrl(request.url);
                setStatus("> AWAITING_OPTICAL_SCAN...");

                request.onProofGenerated(async (proof) => {
                    if (isCancelled) return;
                    setStatus("> PROOF_RECEIVED. TRIGGERING_METAMASK...");
                    await sendVoteToBlockchain(zkPassport, proof);
                });

                request.onResult(() => {
                    if (isCancelled) return;
                    setStatus("> VERIFICATION_FINISHED");
                });

                request.onError((error) => {
                    if (isCancelled) return;
                    setIsError(true);
                    setStatus(`> SDK_ERR: ${error.message || error}`);
                });

            } catch (err) {
                if (isCancelled) return;
                setIsError(true);
                setStatus(`> INIT_ERR: ${err.message}`);
            }
        };

        initZK();
        return () => {
            isCancelled = true;
        };
    }, [pollId, selectedOption, requirements, runtimeHost, runtimeDevMode, runtimeScope, sendVoteToBlockchain]);

    return { qrUrl, status, isError };
}

const QRCodeDisplay = ({ qrUrl }) => (
    <div className="mb-8 flex flex-col items-center">
        <div className="mb-6 border-4 border-[#0a0a0a] bg-[#f0f0f0] p-4">
            {qrUrl ? (
                <QRCodeSVG value={qrUrl} size={220} level="H" includeMargin={false} />
            ) : (
                <div className="flex h-[220px] w-[220px] animate-pulse items-center justify-center border-2 border-dashed border-[#0a0a0a]/20 bg-[#f0f0f0] font-mono text-xs font-bold uppercase tracking-widest text-[#0a0a0a]">
                    [ GENERATING... ]
                </div>
            )}
        </div>

        {qrUrl && (
            <a
                href={qrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="brutal-btn w-full max-w-[250px] !border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a]"
            >
                &gt; EXECUTE_DEEP_LINK
            </a>
        )}
    </div>
);

const SystemStatusLog = ({ status, isError }) => {
    const baseClasses = "p-4 font-mono text-xs uppercase tracking-widest border transition-none";
    let statusClasses = "bg-transparent text-[#f0f0f0] border-[#f0f0f0]/30 animate-pulse";

    if (isError) {
        statusClasses = "bg-red-500/10 text-red-500 border-red-500";
    } else if (status.includes("SUCCESS")) {
        statusClasses = "bg-[#ccff00]/10 text-[#ccff00] border-[#ccff00]";
    }

    return (
        <>
            <div className={`${baseClasses} ${statusClasses}`}>
                {status}
            </div>

            {isError && (
                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 border-b border-red-500 pb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-red-500 transition-none hover:border-[#f0f0f0] hover:text-[#f0f0f0]"
                >
                    [ RESTART_SEQUENCE ]
                </button>
            )}
        </>
    );
};

export default function ZKPassportStation(props) {
    const { qrUrl, status, isError } = useZKPassportAuth(props);

    return (
        <div className="glass-panel mx-auto max-w-lg border-[#ccff00]/50 p-8 text-center shadow-[0_0_50px_rgba(204,255,0,0.05)]">
            <h3 className="mb-2 font-display text-2xl font-black uppercase tracking-widest text-[#f0f0f0]">
                Biometric Gateway
            </h3>
            <p className="mb-8 font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
                VERIFY_IDENTITY_VIA_PASSPORT
            </p>

            <QRCodeDisplay qrUrl={qrUrl} />
            <SystemStatusLog status={status} isError={isError} />
        </div>
    );
}