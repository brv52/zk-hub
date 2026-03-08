import React from 'react';
import { useCreatePoll } from '../hooks/useCreatePoll';
import { StatusBanner, NodeInputList, DurationConfig } from './CreatePollSubComponents'; 

export default function CreatePoll({ votingHubAddress, provider }) {
    const {
        formData, setFormData,
        durationValue, setDurationValue,
        durationUnit, setDurationUnit,
        options, isCreating, status,
        isSponsored, setIsSponsored,
        handleOptionChange, addOption, removeOption,
        applyPreset, getDurationInSeconds, handleSubmit
    } = useCreatePoll(votingHubAddress, provider);

    return (
        <div className="glass-panel relative mx-auto w-full max-w-3xl overflow-hidden border-[#f0f0f0]/30 p-8 shadow-[0_0_40px_rgba(255,255,255,0.05)]">
            <div className="pointer-events-none absolute right-4 top-4 select-none font-mono text-[10px] uppercase tracking-widest text-[#f0f0f0]/20">
                // SYS.DEPLOY_MODULE
            </div>
            
            <div className="mb-10">
                <h2 className="mb-2 font-display text-4xl font-black uppercase tracking-tighter md:text-5xl">Deploy<br/>Instance</h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f0f0f0]/50">Initialize Zero-Knowledge Consensus Parameters.</p>
            </div>
            
            <StatusBanner status={status} />

            <form onSubmit={handleSubmit} className="space-y-10">
                
                {/* 1. CORE DETAILS */}
                <div className="space-y-6">
                    <h3 className="flex justify-between border-b border-[#f0f0f0]/20 pb-2 font-display text-xl font-black uppercase">
                        <span>1. Core Variables</span>
                    </h3>
                    
                    <div>
                        <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
                            Query String // Proposal
                        </label>
                        <input 
                            required 
                            type="text" 
                            placeholder="INPUT_QUERY_HERE..."
                            value={formData.question} 
                            onChange={e => setFormData({...formData, question: e.target.value})} 
                            className="w-full border border-[#f0f0f0]/20 bg-transparent p-4 font-mono text-xs uppercase tracking-widest text-[#f0f0f0] shadow-none outline-none transition-none focus:border-[#ccff00] focus:ring-0" 
                        />
                    </div>

                    <NodeInputList 
                        options={options} 
                        handleOptionChange={handleOptionChange} 
                        addOption={addOption} 
                        removeOption={removeOption} 
                    />
                </div>

                {/* 2. SECURITY & TIMING */}
                <div className="space-y-6">
                    <h3 className="border-b border-[#f0f0f0]/20 pb-2 font-display text-xl font-black uppercase">
                        2. Network & Lifespan
                    </h3>

                    <div className="border border-[#f0f0f0]/20 p-4 transition-colors hover:border-[#f0f0f0]/40">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]">
                                    Gas Sponsorship // Meta-Tx
                                </label>
                                <p className="font-mono text-[9px] lowercase tracking-tighter text-[#f0f0f0]/40">
                                    {isSponsored 
                                        ? "Host will pre-fund user transactions (Gasless for voters)." 
                                        : "Voters pay their own network fees."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSponsored(!isSponsored)}
                                className={`h-8 w-16 border p-1 transition-all ${isSponsored ? 'border-[#ccff00]' : 'border-[#f0f0f0]/20'}`}
                            >
                                <div className={`h-full w-1/2 transition-all ${isSponsored ? 'translate-x-full bg-[#ccff00]' : 'translate-x-0 bg-[#f0f0f0]/20'}`} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
                                Verifier Interface (0x)
                            </label>
                            <input 
                                required 
                                type="text" 
                                placeholder="0X_ADDRESS..."
                                value={formData.verifierAddress} 
                                onChange={e => setFormData({...formData, verifierAddress: e.target.value})} 
                                className="w-full border border-[#f0f0f0]/20 bg-transparent p-4 font-mono text-xs uppercase tracking-widest text-[#f0f0f0] outline-none transition-none focus:border-[#ccff00] focus:ring-0" 
                            />
                        </div>

                        <div>
                            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
                                Manifest Target (URI)
                            </label>
                            <input 
                                required 
                                type="text" 
                                placeholder="IPFS://..."
                                value={formData.manifestURI} 
                                onChange={e => setFormData({...formData, manifestURI: e.target.value})} 
                                className="w-full border border-[#f0f0f0]/20 bg-transparent p-4 font-mono text-xs uppercase tracking-widest text-[#f0f0f0] outline-none transition-none focus:border-[#ccff00] focus:ring-0" 
                            />
                        </div>
                    </div>

                    <DurationConfig 
                        durationValue={durationValue} setDurationValue={setDurationValue}
                        durationUnit={durationUnit} setDurationUnit={setDurationUnit}
                        applyPreset={applyPreset} getDurationInSeconds={getDurationInSeconds}
                    />
                </div>

                <div className="border-t border-[#f0f0f0]/20 pt-6">
                    <button 
                        type="submit" 
                        disabled={isCreating} 
                        className={`brutal-btn w-full !py-6 !text-sm ${isCreating ? 'pointer-events-none !border-[#f0f0f0]/20 !text-[#f0f0f0]/20' : '!border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a]'}`}
                    >
                        {isCreating ? (
                            <span className="animate-glitch">[ COMPILING_PAYLOAD... ]</span>
                        ) : 'EXECUTE_DEPLOYMENT'}
                    </button>
                </div>
            </form>
        </div>
    );
}