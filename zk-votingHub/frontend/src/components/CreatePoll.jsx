import React, { useState, useRef, useEffect } from 'react';
import { useCreatePoll } from '../hooks/useCreatePoll';
import { StatusBanner, DurationConfig } from './CreatePollSubComponents';

const validateDatasetField = (field, value) => {
    if (value === undefined || value === null || value.toString().trim() === '') return 'REQUIRED_FIELD';
    const strVal = value.toString().trim();
    const nameLabel = field.name.toLowerCase();

    if (nameLabel.includes('address') && !/^0x[a-fA-F0-9]{40}$/.test(strVal)) return 'INVALID_ETH_ADDRESS';

    if (nameLabel.includes('secret') || nameLabel.includes('hash') || nameLabel.includes('commitment') || nameLabel.includes('key') || nameLabel.includes('nullifier')) {
        if (strVal.length < 16) return 'WEAK_ENTROPY_MIN_16_CHARS';
        if (strVal.startsWith('0x') && !/^0x[a-fA-F0-9]+$/.test(strVal)) return 'MALFORMED_HEX_STRING';
    }

    if (nameLabel.includes('slot')) {
        if (!/^\d+$/.test(strVal) && !/^0x[a-fA-F0-9]+$/.test(strVal)) {
            return 'SLOT_MUST_BE_NUMERIC_OR_HEX';
        }
        try {
            BigInt(strVal);
        } catch (e) {
            return 'INVALID_BIGINT_FORMAT';
        }
    }

    if (field.type === 'number' || nameLabel.includes('age') || nameLabel.includes('balance') || nameLabel.includes('amount') || nameLabel.includes('id')) {
        if (isNaN(Number(strVal)) || Number(strVal) < 0) return 'INVALID_NUMERIC_VALUE';
    }

    return null;
};


const ToggleElement = ({ options, active, onChange }) => (
    <div className="flex w-full border border-[#f0f0f0]/20 bg-black/40 font-mono text-[10px] uppercase tracking-widest backdrop-blur-sm">
        {options.map((opt, index) => (
            <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`flex-1 py-2.5 transition-colors border-r border-[#f0f0f0]/10 last:border-r-0
                    ${active === opt.value
                        ? 'bg-[#ccff00] text-[#0a0a0a] font-bold shadow-[inset_0_0_8px_rgba(0,0,0,0.3)]'
                        : 'text-[#f0f0f0]/50 hover:bg-[#f0f0f0]/10 hover:text-[#ccff00]'
                    }
                `}
            >
                {opt.label}
            </button>
        ))}
    </div>
);

const TerminalSelect = ({ value, onChange, options, defaultLabel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const selectedOption = options.find(o => o.id === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative group w-full" ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full border bg-black/60 p-3 font-mono text-[11px] uppercase tracking-widest outline-none transition-colors cursor-pointer flex justify-between items-center backdrop-blur-sm
                    ${isOpen ? 'border-[#ccff00] text-[#ccff00]' : 'border-[#f0f0f0]/20 text-[#f0f0f0]/50 hover:border-[#ccff00]/50'}
                `}
            >
                <span className={`truncate pr-4 ${selectedOption ? "text-[#ccff00]" : ""}`}>
                    {selectedOption ? selectedOption.name : defaultLabel}
                </span>
                <span className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 border border-[#ccff00]/30 bg-[#0a0a0a]/95 backdrop-blur-xl z-[100] flex flex-col shadow-[0_15px_40px_rgba(0,0,0,0.9)] max-h-60 overflow-y-auto custom-scrollbar">
                    {options.map(opt => (
                        <div
                            key={opt.id}
                            onClick={() => { onChange(opt.id); setIsOpen(false); }}
                            className={`p-3 font-mono text-[10px] uppercase tracking-widest cursor-pointer border-b border-[#f0f0f0]/10 last:border-0 transition-colors
                                ${value === opt.id
                                    ? 'bg-[#ccff00]/20 text-[#ccff00] font-bold border-l-2 border-l-[#ccff00]'
                                    : 'text-[#f0f0f0]/70 hover:bg-[#ccff00]/10 hover:text-[#ccff00] hover:border-l-2 hover:border-l-[#ccff00]'
                                }
                            `}
                        >
                            {opt.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function CreatePoll({ votingHubAddress, provider }) {
    const {
        formData, setFormData,
        durationValue, setDurationValue,
        durationUnit, setDurationUnit,
        options, setOptions,
        isCreating, status,
        isSponsored, setIsSponsored,
        verifierMode, setVerifierMode,
        dbMode, setDbMode,
        manifest, isManifestLoading,
        csvFile, setCsvFile,
        manualRows, handleManualRowChange, addManualRow, removeManualRow,
        handlePresetSelect, PRESET_VERIFIERS,
        getDurationInSeconds, handleSubmit,
        isPreHashed, setIsPreHashed
    } = useCreatePoll(votingHubAddress, provider);

    const selectedPresetId = PRESET_VERIFIERS.find((preset) => preset.address === formData.verifierAddress)?.id || "";

    const applyPreset = (val, unit) => {
        setDurationValue(val);
        setDurationUnit(unit);
    };

    const isManualDataValid = () => {
        if (!manifest || !manifest.registrySchema) return true;
        for (let i = 0; i < manualRows.length; i++) {
            for (const field of manifest.registrySchema) {
                if (validateDatasetField(field, manualRows[i][field.name])) return false;
            }
        }
        return true;
    };

    const requiresDB = manifest && manifest.registrySchema && manifest.registrySchema.length > 0;

    const canSubmit = manifest && (!requiresDB || (dbMode === 'file' ? !!csvFile : isManualDataValid()));

    return (
        <div className="mx-auto w-full max-w-3xl space-y-6 pb-12">

            <div className="mb-6 flex flex-col items-start justify-between gap-3 border-b border-[#f0f0f0]/20 pb-4 md:flex-row md:items-end">
                <div>
                    <h2 className="font-display text-3xl font-black uppercase tracking-widest text-[#ccff00] drop-shadow-[0_0_10px_rgba(204,255,0,0.2)]">
                        Deploy Instance
                    </h2>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-[#f0f0f0]/50">
                        Initialize Zero-Knowledge Parameters
                    </p>
                </div>
                <div className="border border-[#ccff00]/30 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#ccff00]/50 bg-[#ccff00]/5">
                    SYS.DEPLOY_MODULE_V2
                </div>
            </div>

            <StatusBanner status={status} />

            <form onSubmit={handleSubmit} className="space-y-6">

                <div className="glass-panel relative z-40 p-5 md:p-6 !overflow-visible">
                    <h3 className="mb-6 font-display text-xl font-black uppercase tracking-widest text-[#f0f0f0] flex items-center gap-2">
                        <span className="text-[#ccff00] opacity-50">&gt;</span> CORE_METADATA
                    </h3>

                    <div className="space-y-5">
                        <div>
                            <label className="mb-2 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#f0f0f0]/40">
                                [ QUERY_STRING ]
                            </label>
                            <input
                                required type="text" placeholder="ENTER_VOTING_QUESTION..."
                                value={formData.question} onChange={e => setFormData({ ...formData, question: e.target.value })}
                                className="w-full border border-[#f0f0f0]/20 bg-black/40 p-3 font-mono text-[11px] uppercase tracking-widest text-[#f0f0f0] outline-none transition-colors focus:border-[#ccff00] focus:bg-[#ccff00]/5"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#f0f0f0]/40">
                                [ OPTIONS_ARRAY ]
                            </label>
                            <div className="space-y-2">
                                {options.map((opt, i) => (
                                    <div key={i} className="flex group">
                                        <div className="flex w-16 items-center justify-center border border-r-0 border-[#f0f0f0]/20 bg-black/60 font-mono text-[9px] text-[#f0f0f0]/40 group-focus-within:border-[#ccff00] group-focus-within:text-[#ccff00] transition-colors">
                                            OPT_{i.toString().padStart(2, '0')}
                                        </div>
                                        <input
                                            required type="text" placeholder={`OPTION_VALUE...`}
                                            value={opt} onChange={(e) => { const newOpts = [...options]; newOpts[i] = e.target.value; setOptions(newOpts); }}
                                            className="w-full border border-[#f0f0f0]/20 bg-black/40 p-3 font-mono text-[11px] uppercase tracking-widest text-[#f0f0f0] outline-none transition-colors focus:border-[#ccff00] focus:bg-[#ccff00]/5"
                                        />
                                        {options.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => { const newOpts = options.filter((_, idx) => idx !== i); setOptions(newOpts); }}
                                                className="ml-2 flex w-10 items-center justify-center border border-red-500/30 text-red-500/50 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                                title="Remove Option"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button" onClick={() => setOptions([...options, ''])}
                                className="mt-3 font-mono text-[9px] uppercase tracking-widest text-[#ccff00]/70 hover:text-[#ccff00] transition-colors flex items-center gap-1"
                            >
                                <span className="text-lg leading-none">+</span> <span>ADD_OPTION</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="glass-panel relative z-50 p-5 md:p-6 !overflow-visible">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="font-display text-xl font-black uppercase tracking-widest text-[#f0f0f0] flex items-center gap-2">
                            <span className="text-[#ccff00] opacity-50">&gt;</span> ZK_VERIFIER_MATRIX
                        </h3>
                        {isManifestLoading && (
                            <span className="font-mono text-[8px] uppercase tracking-widest text-[#ccff00] animate-pulse border border-[#ccff00]/30 px-2 py-0.5">
                                FETCHING...
                            </span>
                        )}
                    </div>

                    <div className="space-y-5">
                        <ToggleElement
                            options={[{ label: 'Preset Library', value: 'preset' }, { label: 'Custom Protocol', value: 'custom' }]}
                            active={verifierMode} onChange={setVerifierMode}
                        />

                        <div>
                            {verifierMode === 'preset' ? (
                                PRESET_VERIFIERS.length > 0 ? (
                                    <TerminalSelect
                                        value={selectedPresetId}
                                        onChange={(val) => handlePresetSelect(val)}
                                        options={PRESET_VERIFIERS}
                                        defaultLabel="-- SELECT_VERIFIER_MODULE --"
                                    />
                                ) : (
                                    <div className="border border-yellow-500/30 bg-yellow-500/10 p-3 font-mono text-[9px] uppercase tracking-widest text-yellow-400">
                                        PRESET_LIBRARY_UNAVAILABLE // RUN_VERIFIER_DEPLOYMENT_TO_GENERATE_PRESETS
                                    </div>
                                )
                            ) : (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <input
                                        required type="text" placeholder="[ CONTRACT_ADDRESS: 0x... ]"
                                        value={formData.verifierAddress} onChange={e => setFormData({ ...formData, verifierAddress: e.target.value })}
                                        className="w-full border border-[#f0f0f0]/20 bg-black/40 p-3 font-mono text-[11px] uppercase tracking-widest text-[#f0f0f0] outline-none transition-colors focus:border-[#ccff00] focus:bg-[#ccff00]/5"
                                    />
                                    <input
                                        required type="text" placeholder="[ MANIFEST_URI: ipfs://... ]"
                                        value={formData.manifestURI} onChange={e => setFormData({ ...formData, manifestURI: e.target.value })}
                                        className="w-full border border-[#f0f0f0]/20 bg-black/40 p-3 font-mono text-[11px] uppercase tracking-widest text-[#f0f0f0] outline-none transition-colors focus:border-[#ccff00] focus:bg-[#ccff00]/5"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {manifest && manifest.registrySchema && manifest.registrySchema.length > 0 && (
                    <div className="glass-panel relative z-30 p-5 md:p-6 animate-fade-in !overflow-visible">
                        <div className="absolute right-0 top-0 border-b border-l border-[#ccff00]/30 bg-[#ccff00]/10 px-2 py-1 font-mono text-[8px] font-bold text-[#ccff00] tracking-widest">
                            SCHEMA_LOCK: ACTIVE
                        </div>

                        <h3 className="mb-2 font-display text-xl font-black uppercase tracking-widest text-[#f0f0f0] flex items-center gap-2">
                            <span className="text-[#ccff00] opacity-50">&gt;</span> DATABASE_INJECTION
                        </h3>
                        <p className="mb-6 font-mono text-[8px] uppercase tracking-[0.2em] text-[#f0f0f0]/40">
                            DATA HASHED LOCALLY VIA {manifest.config.hashAlgorithm || 'POSEIDON'}. PLAINTEXT SECURED.
                        </p>

                        <div className="space-y-5">
                            <ToggleElement
                                options={[{ label: 'Upload CSV Dataset', value: 'file' }, { label: 'Manual Entry', value: 'manual' }]}
                                active={dbMode} onChange={setDbMode}
                            />

                            <div className={`border p-4 transition-colors duration-300 ${isPreHashed ? 'border-[#ccff00] bg-[#ccff00]/5' : 'border-[#f0f0f0]/20 bg-black/40'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.2em] text-[#f0f0f0]">
                                            IDENTITY COMMITMENTS // WEB3 MODE
                                        </label>
                                        <p className="font-mono text-[8px] uppercase tracking-widest text-[#f0f0f0]/40 mt-1 leading-relaxed">
                                            {isPreHashed
                                                ? `DATA IS PRE-HASHED VIA [ ${manifest.config.hashAlgorithm?.toUpperCase() || 'POSEIDON'} ]. SKIPPING LOCAL ENCRYPTION.`
                                                : "RAW DATA PROVIDED. WILL BE HASHED LOCALLY BEFORE UPLOAD."}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setIsPreHashed(!isPreHashed)}
                                        className={`h-6 w-12 border p-1 transition-colors duration-300 flex-shrink-0 ${isPreHashed ? 'border-[#ccff00]' : 'border-[#f0f0f0]/30'}`}
                                    >
                                        <div className={`h-full w-1/2 transition-transform duration-300 ease-out ${isPreHashed ? 'translate-x-full bg-[#ccff00]' : 'translate-x-0 bg-[#f0f0f0]/30'}`} />
                                    </button>
                                </div>
                            </div>

                            {dbMode === 'file' ? (
                                <div className="relative">
                                    <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" id="csvUpload" />
                                    <div className={`border border-dashed p-8 flex flex-col items-center justify-center transition-colors duration-300
                                        ${csvFile ? 'border-[#ccff00] bg-[#ccff00]/5' : 'border-[#f0f0f0]/20 bg-black/40 hover:border-[#ccff00]/50 hover:bg-[#ccff00]/5'}
                                    `}>
                                        <span className={`font-mono text-[11px] tracking-widest mb-2 ${csvFile ? 'text-[#ccff00] font-bold' : 'text-[#f0f0f0]/50'}`}>
                                            {csvFile ? `[ ${csvFile.name} ]` : '[ DROP_CSV_DATASET_HERE ]'}
                                        </span>
                                        <span className="font-mono text-[8px] text-[#f0f0f0]/30 uppercase tracking-widest mt-1">
                                            SCHEMA: {manifest.registrySchema.map(s => s.name).join(', ')}
                                        </span>
                                        <span className="font-mono text-[8px] text-[#ccff00]/50 uppercase tracking-widest mt-4 border border-[#ccff00]/20 px-2 py-1">
                                            * CSV WILL BE VALIDATED DURING DEPLOYMENT
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="overflow-x-auto border border-[#f0f0f0]/20 custom-scrollbar">
                                        <table className="w-full text-left font-mono text-[9px] uppercase tracking-wider">
                                            <thead className="bg-[#f0f0f0]/5 border-b border-[#f0f0f0]/20">
                                                <tr>
                                                    <th className="py-2 px-3 w-8 text-center text-[#f0f0f0]/50">#</th>
                                                    {manifest.registrySchema.map(field => (
                                                        <th key={field.name} className="py-2 px-3 text-[#ccff00] border-l border-[#f0f0f0]/10">{field.label}</th>
                                                    ))}
                                                    <th className="py-2 px-3 w-8 border-l border-[#f0f0f0]/10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#f0f0f0]/10 bg-black/40">
                                                {manualRows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-[#f0f0f0]/5 transition-colors">
                                                        <td className="py-1 px-3 text-center text-[#f0f0f0]/30 border-r border-[#f0f0f0]/10">{idx + 1}</td>
                                                        {manifest.registrySchema.map(field => {
                                                            const value = row[field.name] || '';
                                                            const errorMsg = validateDatasetField(field, value);
                                                            const hasError = errorMsg !== null && value !== '';

                                                            return (
                                                                <td key={field.name} className="p-0 border-l border-[#f0f0f0]/10 relative group/cell">
                                                                    <input
                                                                        type={field.type === 'number' ? 'number' : 'text'}
                                                                        value={value}
                                                                        onChange={(e) => handleManualRowChange(idx, field.name, e.target.value)}
                                                                        className={`w-full bg-transparent px-3 py-2.5 outline-none transition-colors placeholder:text-[#f0f0f0]/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                                                                            ${hasError
                                                                                ? 'text-red-400 focus:bg-red-500/10 border-b border-red-500/50'
                                                                                : 'focus:bg-[#ccff00]/10 focus:text-[#ccff00] text-[#f0f0f0]'
                                                                            }
                                                                        `}
                                                                        placeholder={`[ ${field.name} ]`}
                                                                    />
                                                                    {hasError && (
                                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 cursor-help font-bold" title={errorMsg}>
                                                                            !
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="p-0 border-l border-[#f0f0f0]/10 text-center align-middle">
                                                            {manualRows.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeManualRow && removeManualRow(idx)}
                                                                    className="h-full w-full py-2.5 text-red-500/50 hover:bg-red-500/20 hover:text-red-500 transition-colors font-bold text-xs"
                                                                    title="Remove row"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addManualRow}
                                        className="font-mono text-[9px] uppercase tracking-widest text-[#ccff00]/70 hover:text-[#ccff00] transition-colors flex items-center gap-1"
                                    >
                                        <span className="text-lg leading-none">+</span> <span>ADD_RECORD</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="glass-panel relative z-20 p-5 md:p-6 !overflow-visible">
                    <h3 className="mb-6 font-display text-xl font-black uppercase tracking-widest text-[#f0f0f0] flex items-center gap-2">
                        <span className="text-[#ccff00] opacity-50">&gt;</span> NETWORK_LIFESPAN
                    </h3>

                    <div className="space-y-6">
                        <div className={`border p-4 transition-colors duration-300 ${isSponsored ? 'border-[#ccff00] bg-[#ccff00]/5 shadow-[inset_0_0_15px_rgba(204,255,0,0.05)]' : 'border-[#f0f0f0]/20 bg-black/40'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.2em] text-[#f0f0f0]">
                                        GAS_SPONSORSHIP // ERC-4337
                                    </label>
                                    <p className="font-mono text-[8px] uppercase tracking-widest text-[#f0f0f0]/40">
                                        {isSponsored
                                            ? "HOST PRE-FUNDS PAYMASTER. VOTERS EXECUTE GASLESS."
                                            : "STANDARD EXECUTION. VOTERS PAY NETWORK FEES."}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsSponsored(!isSponsored)}
                                    className={`h-6 w-12 border p-1 transition-colors duration-300 flex-shrink-0 ${isSponsored ? 'border-[#ccff00]' : 'border-[#f0f0f0]/30'}`}
                                >
                                    <div className={`h-full w-1/2 transition-transform duration-300 ease-out ${isSponsored ? 'translate-x-full bg-[#ccff00]' : 'translate-x-0 bg-[#f0f0f0]/30'}`} />
                                </button>
                            </div>
                        </div>

                        <DurationConfig
                            durationValue={durationValue} setDurationValue={setDurationValue}
                            durationUnit={durationUnit} setDurationUnit={setDurationUnit}
                            applyPreset={applyPreset} getDurationInSeconds={getDurationInSeconds}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isCreating || !canSubmit}
                    className={`brutal-btn w-full !py-4 !text-xs uppercase tracking-[0.3em] transition-all duration-300 relative z-10
                        ${isCreating || !canSubmit
                            ? 'pointer-events-none !border-[#f0f0f0]/10 !text-[#f0f0f0]/20 bg-black/20'
                            : '!border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-black hover:shadow-[0_0_20px_rgba(204,255,0,0.4)]'
                        }
                    `}
                >
                    {isCreating ? (
                        <span className="animate-pulse">[ EXECUTING_DEPLOYMENT... ]</span>
                    ) : (
                        "[ INITIALIZE_INSTANCE ]"
                    )}
                </button>

                {!manifest && !isManifestLoading && formData.manifestURI && (
                    <div className="text-center font-mono text-[8px] uppercase tracking-widest text-red-500/70 animate-pulse">
                        &gt; AWAITING_VALID_VERIFIER_CONFIGURATION
                    </div>
                )}

                {manifest && dbMode === 'manual' && !isManualDataValid() && (
                    <div className="text-center font-mono text-[8px] uppercase tracking-widest text-red-500/70 animate-pulse">
                        &gt; FIX_DATASET_ERRORS_TO_PROCEED
                    </div>
                )}

            </form>
        </div>
    );
}