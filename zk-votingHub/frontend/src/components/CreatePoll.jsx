import React, { useState } from 'react';
import { ethers } from 'ethers';
import abi from '../contracts/VotingHub.json';

export default function CreatePoll({ votingHubAddress, provider }) {
    const [formData, setFormData] = useState({
        question: '',
        verifierAddress: '',
        manifestURI: ''
    });
    
    const [durationValue, setDurationValue] = useState(1);
    const [durationUnit, setDurationUnit] = useState('d');
    
    // Стейт для нашего нового кастомного дропдауна
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const [options, setOptions] = useState(['', '']);
    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const timeUnits = [
        { value: 's', label: 'SECONDS' },
        { value: 'm', label: 'MINUTES' },
        { value: 'h', label: 'HOURS' },
        { value: 'd', label: 'DAYS' }
    ];

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };
    const addOption = () => setOptions([...options, '']);
    const removeOption = (index) => setOptions(options.filter((_, i) => i !== index));

    const applyPreset = (val, unit) => {
        setDurationValue(val);
        setDurationUnit(unit);
    };

    const getDurationInSeconds = () => {
        const val = parseFloat(durationValue);
        if (isNaN(val) || val <= 0) return 0;
        switch(durationUnit) {
            case 's': return Math.floor(val);
            case 'm': return Math.floor(val * 60);
            case 'h': return Math.floor(val * 3600);
            case 'd': return Math.floor(val * 86400);
            default: return Math.floor(val);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        const totalSeconds = getDurationInSeconds();
        if (totalSeconds <= 0) {
            return setStatus({ type: 'error', message: 'Duration must be > 0 seconds.' });
        }
        if (!ethers.isAddress(formData.verifierAddress)) {
            return setStatus({ type: 'error', message: 'Invalid 0x Contract Address.' });
        }
        const validOptions = options.map(o => o.trim()).filter(o => o !== '');
        if (validOptions.length < 2) {
            return setStatus({ type: 'error', message: 'Minimum 2 nodes required.' });
        }
        if (!formData.manifestURI.startsWith('ipfs://') && !formData.manifestURI.startsWith('https://')) {
            return setStatus({ type: 'error', message: 'Invalid Protocol (Requires IPFS/HTTPS)' });
        }

        setIsCreating(true);
        try {
            const signer = await provider.getSigner();
            const hubContract = new ethers.Contract(votingHubAddress, abi.abi, signer);

            const tx = await hubContract.createPoll(
                formData.verifierAddress,
                formData.question,
                validOptions,
                formData.manifestURI,
                totalSeconds 
            );

            setStatus({ type: 'info', message: 'AWAITING_NETWORK_CONFIRMATION...' });
            await tx.wait();
            
            setStatus({ type: 'success', message: 'INSTANCE_DEPLOYED_SUCCESSFULLY.' });
            
            setFormData({ question: '', verifierAddress: '', manifestURI: '' });
            setOptions(['', '']);
            applyPreset(1, 'd');
        } catch (error) {
            setStatus({ type: 'error', message: error.reason || error.message });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="glass-panel p-8 relative overflow-hidden w-full max-w-3xl mx-auto border-[#f0f0f0]/30 shadow-[0_0_40px_rgba(255,255,255,0.05)]">
            <div className="absolute top-4 right-4 text-[10px] text-[#f0f0f0]/20 font-mono tracking-widest uppercase select-none pointer-events-none">
                // SYS.DEPLOY_MODULE
            </div>
            
            <div className="mb-10">
                <h2 className="font-display text-4xl md:text-5xl font-black tracking-tighter uppercase mb-2">Deploy<br/>Instance</h2>
                <p className="font-mono text-[10px] text-[#f0f0f0]/50 tracking-[0.3em] uppercase">Initialize Zero-Knowledge Consensus Parameters.</p>
            </div>
            
            {status.message && (
                <div className={`p-4 mb-8 font-mono text-xs uppercase tracking-widest border flex items-start gap-3 ${
                    status.type === 'error' ? 'border-red-500 text-red-500 bg-red-500/10' : 
                    status.type === 'success' ? 'border-[#ccff00] text-[#ccff00] bg-[#ccff00]/10 shadow-[0_0_20px_rgba(204,255,0,0.1)]' : 
                    'border-[#f0f0f0]/50 text-[#f0f0f0] bg-[#f0f0f0]/10'
                }`}>
                    <span className="shrink-0">{status.type === 'error' ? '[ERR]' : status.type === 'success' ? '[OK]' : '[SYS]'}</span>
                    <span className="break-words">{status.message}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-10">
                
                {/* 1. CORE DETAILS */}
                <div className="space-y-6">
                    <h3 className="font-display text-xl uppercase font-black border-b border-[#f0f0f0]/20 pb-2 flex justify-between">
                        <span>1. Core Variables</span>
                    </h3>
                    
                    <div>
                        <label className="block font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em] mb-2">Query String // Proposal</label>
                        <input required type="text" 
                            className="w-full p-4 bg-transparent border border-[#f0f0f0]/20 text-[#f0f0f0] font-mono text-xs uppercase tracking-widest focus:border-[#ccff00] focus:ring-0 outline-none transition-none shadow-none" 
                            placeholder="INPUT_QUERY_HERE..."
                            value={formData.question} onChange={e => setFormData({...formData, question: e.target.value})} 
                        />
                    </div>

                    <div>
                        <label className="block font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em] mb-2">Available Nodes // Options</label>
                        <div className="space-y-3">
                            {options.map((opt, index) => (
                                <div key={index} className="flex gap-3 items-stretch group">
                                    <div className="flex-1 relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-[#ccff00] font-mono text-xs font-bold">{index}:</span>
                                        </div>
                                        <input required type="text" 
                                            className="w-full pl-10 p-4 bg-transparent border border-[#f0f0f0]/20 text-[#f0f0f0] font-mono text-xs uppercase tracking-widest focus:border-[#ccff00] focus:ring-0 outline-none transition-none" 
                                            placeholder="NODE_PAYLOAD..."
                                            value={opt} onChange={e => handleOptionChange(index, e.target.value)} 
                                        />
                                    </div>
                                    {options.length > 2 && (
                                        <button type="button" onClick={() => removeOption(index)} 
                                            className="brutal-btn !px-4 !py-0 flex items-center justify-center !text-red-500 !border-red-500/50 hover:!bg-red-500 hover:!text-[#0a0a0a]"
                                            title="KILL_NODE"
                                        >
                                            [X]
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addOption} className="mt-4 font-mono text-xs uppercase tracking-widest text-[#ccff00] hover:text-[#f0f0f0] transition-none flex items-center gap-2">
                            <span>+</span> APPEND_NODE
                        </button>
                    </div>
                </div>

                {/* 2. SECURITY & TIMING */}
                <div className="space-y-6">
                    <h3 className="font-display text-xl uppercase font-black border-b border-[#f0f0f0]/20 pb-2">2. Network & Lifespan</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em] mb-2">Verifier Interface (0x)</label>
                            <input required type="text" 
                                className="w-full p-4 bg-transparent border border-[#f0f0f0]/20 text-[#f0f0f0] font-mono text-xs uppercase tracking-widest focus:border-[#ccff00] focus:ring-0 outline-none transition-none" 
                                placeholder="0X_ADDRESS..."
                                value={formData.verifierAddress} onChange={e => setFormData({...formData, verifierAddress: e.target.value})} 
                            />
                        </div>

                        <div>
                            <label className="block font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em] mb-2">Manifest Target (URI)</label>
                            <input required type="text" 
                                className="w-full p-4 bg-transparent border border-[#f0f0f0]/20 text-[#f0f0f0] font-mono text-xs uppercase tracking-widest focus:border-[#ccff00] focus:ring-0 outline-none transition-none" 
                                placeholder="IPFS://..."
                                value={formData.manifestURI} onChange={e => setFormData({...formData, manifestURI: e.target.value})} 
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <label className="block font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em] mb-4">TTL (Time to Live) Config</label>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                            {[
                                { val: 1, unit: 'h', label: '1H' },
                                { val: 1, unit: 'd', label: '1D' },
                                { val: 3, unit: 'd', label: '3D' },
                                { val: 7, unit: 'd', label: '1W' },
                            ].map((preset, i) => (
                                <button key={i} type="button" onClick={() => applyPreset(preset.val, preset.unit)} 
                                    className={`brutal-tab !py-2 !px-4 text-[10px] ${durationValue == preset.val && durationUnit == preset.unit ? 'border-[#ccff00] bg-[#ccff00] text-[#0a0a0a]' : 'border-[#f0f0f0]/20 text-[#f0f0f0]/50'}`}>
                                    [{preset.label}]
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col md:flex-row gap-3 items-stretch relative">
                            {/* 1. Поле ввода цифр без стрелочек */}
                            <input type="number" min="1" step="any" required
                                className="w-full md:w-1/2 p-4 bg-transparent border border-[#f0f0f0]/20 text-[#f0f0f0] font-mono text-xs uppercase tracking-widest focus:border-[#ccff00] focus:ring-0 outline-none transition-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                value={durationValue} onChange={e => setDurationValue(e.target.value)}
                            />
                            
                            {/* 2. Кастомный выпадающий список */}
                            <div className="relative w-full md:w-1/2">
                                <button 
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className={`w-full h-full p-4 bg-transparent border text-[#ccff00] font-mono text-xs uppercase tracking-widest outline-none transition-none flex justify-between items-center text-left ${isDropdownOpen ? 'border-[#ccff00]' : 'border-[#f0f0f0]/20'}`}
                                >
                                    <span>{timeUnits.find(u => u.value === durationUnit)?.label}</span>
                                    <span className="text-[#ccff00] text-[10px]">{isDropdownOpen ? '▲' : '▼'}</span>
                                </button>
                                
                                {isDropdownOpen && (
                                    <>
                                        {/* Невидимый оверлей для закрытия дропдауна по клику вне его области */}
                                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                                        
                                        {/* Само меню дропдауна */}
                                        <div className="absolute top-full left-0 w-full mt-1 bg-[#0a0a0a] border border-[#ccff00] z-50 shadow-[0_10px_30px_rgba(204,255,0,0.1)]">
                                            {timeUnits.map(unit => (
                                                <div 
                                                    key={unit.value}
                                                    onClick={() => {
                                                        setDurationUnit(unit.value);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={`p-4 font-mono text-xs uppercase tracking-widest cursor-pointer hover:bg-[#ccff00] hover:text-[#0a0a0a] transition-none ${durationUnit === unit.value ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'text-[#f0f0f0]'}`}
                                                >
                                                    {unit.label}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <p className="mt-4 font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.3em]">
                            ABSOLUTE_TTL_SECONDS: <span className="text-[#ccff00] font-bold">{getDurationInSeconds()}</span>
                        </p>
                    </div>
                </div>

                <div className="pt-6 border-t border-[#f0f0f0]/20">
                    <button type="submit" disabled={isCreating} 
                        className={`w-full brutal-btn !py-6 !text-sm ${isCreating ? '!border-[#f0f0f0]/20 !text-[#f0f0f0]/20 pointer-events-none' : '!border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a]'}`}
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