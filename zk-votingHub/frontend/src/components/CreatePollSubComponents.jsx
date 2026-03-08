import React, { useState } from 'react';

// --- SUB-COMPONENT: Status Banner ---
const StatusBanner = ({ status }) => {
    if (!status.message) return null;

    const baseClasses = "mb-8 flex items-start gap-3 border p-4 font-mono text-xs uppercase tracking-widest break-words";
    const statusStyles = {
        error: "border-red-500 bg-red-500/10 text-red-500",
        success: "border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00] shadow-[0_0_20px_rgba(204,255,0,0.1)]",
        default: "border-[#f0f0f0]/50 bg-[#f0f0f0]/10 text-[#f0f0f0]"
    };

    const styleClass = statusStyles[status.type] || statusStyles.default;
    const prefix = status.type === 'error' ? '[ERR]' : status.type === 'success' ? '[OK]' : '[SYS]';

    return (
        <div className={`${baseClasses} ${styleClass}`}>
            <span className="shrink-0">{prefix}</span>
            <span>{status.message}</span>
        </div>
    );
};

// --- SUB-COMPONENT: Dynamic Node Input List ---
const NodeInputList = ({ options, handleOptionChange, addOption, removeOption }) => (
    <div>
        <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
            Available Nodes // Options
        </label>
        <div className="space-y-3">
            {options.map((opt, index) => (
                <div key={index} className="group flex items-stretch gap-3">
                    <div className="relative flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                            <span className="font-mono text-xs font-bold text-[#ccff00]">{index}:</span>
                        </div>
                        <input 
                            required 
                            type="text" 
                            placeholder="NODE_PAYLOAD..."
                            value={opt} 
                            onChange={e => handleOptionChange(index, e.target.value)} 
                            className="w-full border border-[#f0f0f0]/20 bg-transparent p-4 pl-10 font-mono text-xs uppercase tracking-widest text-[#f0f0f0] outline-none transition-none focus:border-[#ccff00] focus:ring-0" 
                        />
                    </div>
                    {options.length > 2 && (
                        <button 
                            type="button" 
                            onClick={() => removeOption(index)} 
                            title="KILL_NODE"
                            className="brutal-btn flex items-center justify-center !border-red-500/50 !px-4 !py-0 !text-red-500 hover:!bg-red-500 hover:!text-[#0a0a0a]"
                        >
                            [X]
                        </button>
                    )}
                </div>
            ))}
        </div>
        <button 
            type="button" 
            onClick={addOption} 
            className="mt-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#ccff00] transition-none hover:text-[#f0f0f0]"
        >
            <span>+</span> APPEND_NODE
        </button>
    </div>
);

// --- SUB-COMPONENT: Duration & TTL Configuration ---
const DurationConfig = ({ 
    durationValue, setDurationValue, 
    durationUnit, setDurationUnit, 
    applyPreset, getDurationInSeconds 
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const timeUnits = [
        { value: 's', label: 'SECONDS' },
        { value: 'm', label: 'MINUTES' },
        { value: 'h', label: 'HOURS' },
        { value: 'd', label: 'DAYS' }
    ];

    const presets = [
        { val: 1, unit: 'h', label: '1H' },
        { val: 1, unit: 'd', label: '1D' },
        { val: 3, unit: 'd', label: '3D' },
        { val: 7, unit: 'd', label: '1W' },
    ];

    return (
        <div className="pt-2">
            <label className="mb-4 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
                TTL (Time to Live) Config
            </label>
            
            <div className="mb-4 flex flex-wrap gap-2">
                {presets.map((preset, i) => (
                    <button 
                        key={i} 
                        type="button" 
                        onClick={() => applyPreset(preset.val, preset.unit)} 
                        className={`brutal-tab !px-4 !py-2 text-[10px] ${durationValue === preset.val && durationUnit === preset.unit ? 'border-[#ccff00] bg-[#ccff00] text-[#0a0a0a]' : 'border-[#f0f0f0]/20 text-[#f0f0f0]/50'}`}
                    >
                        [{preset.label}]
                    </button>
                ))}
            </div>

            <div className="relative flex flex-col items-stretch gap-3 md:flex-row">
                <input 
                    type="number" min="1" step="any" required
                    value={durationValue} 
                    onChange={e => setDurationValue(e.target.value)}
                    className="w-full border border-[#f0f0f0]/20 bg-transparent p-4 font-mono text-xs uppercase tracking-widest text-[#f0f0f0] outline-none transition-none focus:border-[#ccff00] focus:ring-0 md:w-1/2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" 
                />
                
                <div className="relative w-full md:w-1/2">
                    <button 
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`flex h-full w-full items-center justify-between border bg-transparent p-4 text-left font-mono text-xs uppercase tracking-widest text-[#ccff00] outline-none transition-none ${isDropdownOpen ? 'border-[#ccff00]' : 'border-[#f0f0f0]/20'}`}
                    >
                        <span>{timeUnits.find(u => u.value === durationUnit)?.label}</span>
                        <span className="text-[10px] text-[#ccff00]">{isDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    
                    {isDropdownOpen && (
                        <>
                            {/* Click-away Overlay */}
                            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                            
                            {/* Dropdown Menu */}
                            <div className="absolute left-0 top-full z-50 mt-1 w-full border border-[#ccff00] bg-[#0a0a0a] shadow-[0_10px_30px_rgba(204,255,0,0.1)]">
                                {timeUnits.map(unit => (
                                    <div 
                                        key={unit.value}
                                        onClick={() => {
                                            setDurationUnit(unit.value);
                                            setIsDropdownOpen(false);
                                        }}
                                        className={`cursor-pointer p-4 font-mono text-xs uppercase tracking-widest transition-none hover:bg-[#ccff00] hover:text-[#0a0a0a] ${durationUnit === unit.value ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'text-[#f0f0f0]'}`}
                                    >
                                        {unit.label}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-[#f0f0f0]/50">
                ABSOLUTE_TTL_SECONDS: <span className="font-bold text-[#ccff00]">{getDurationInSeconds()}</span>
            </p>
        </div>
    );
};

export { StatusBanner, NodeInputList, DurationConfig };