import React, { useState, useEffect } from "react";
import { useGasManagement } from "../hooks/useGasManagement";

export default function GasRefillStation({ pollId, votingHubAddress, provider }) {
    const { currentBalance, topUp, isFunding, fetchBalance } = useGasManagement(pollId, votingHubAddress, provider);
    const [customAmount, setCustomAmount] = useState("0.0005");

    useEffect(() => { fetchBalance(); }, []);

    return (
        <div className="glass-panel border-[#ccff00]/30 bg-[#ccff00]/5 p-6 shadow-[0_0_20px_rgba(204,255,0,0.05)]">
            <div className="mb-4 flex items-center justify-between">
                <h4 className="font-display text-lg font-black uppercase tracking-tighter text-[#ccff00]">
                    // RESERVOIR_MGMT_CMD
                </h4>
                <button 
                    onClick={fetchBalance}
                    className="font-mono text-[9px] uppercase tracking-widest text-[#f0f0f0]/40 hover:text-[#ccff00]"
                >
                    [ REFRESH_SYNC ]
                </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 border-y border-[#f0f0f0]/10 py-4">
                <div>
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-[#f0f0f0]/40">Status:</span>
                    <span className="font-mono text-xs font-bold text-[#ccff00]">ONLINE // FUNDED</span>
                </div>
                <div className="text-right">
                    <span className="block font-mono text-[9px] uppercase tracking-widest text-[#f0f0f0]/40">Current_Balance:</span>
                    <span className="font-mono text-xl font-black text-[#f0f0f0]">{currentBalance} <span className="text-[10px] opacity-40">ETH</span></span>
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="relative">
                    <label className="mb-2 block font-mono text-[9px] uppercase tracking-widest text-[#f0f0f0]/30">Injection_Quantity (SEP_ETH):</label>
                    <input 
                        type="number"
                        step="0.0005"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-full border border-[#f0f0f0]/20 bg-transparent p-4 font-mono text-xs uppercase tracking-widest text-[#f0f0f0] outline-none transition-none focus:border-[#ccff00] focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                </div>

                <button 
                    onClick={() => topUp(customAmount)}
                    disabled={isFunding || !customAmount}
                    className={`brutal-btn w-full !py-4 !text-xs ${isFunding ? 'opacity-50' : '!border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-black'}`}
                >
                    {isFunding ? "[ INJECTING_FUEL... ]" : `TANK.EXECUTE_DEPOSIT(${customAmount})`}
                </button>
            </div>

            <p className="mt-4 font-mono text-[8px] leading-relaxed text-[#f0f0f0]/30">
                &gt; WARN: GAS_CREDITS ARE DEDUCTED PER ANONYMOUS VOTE. <br/>
                &gt; CURRENT_RATE: 0.0005 ETH / VALID_PAYLOAD.
            </p>
        </div>
    );
}