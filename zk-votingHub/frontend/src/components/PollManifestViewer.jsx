import React from 'react';

// --- HELPERS & CONSTANTS ---
const IGNORED_CONFIG_KEYS = new Set(['pollId', 'storageURI', 'depth']);

const formatLabel = (key) => key.replace(/([A-Z])/g, "_$1").toUpperCase();

const formatConfigValue = (key, value) => {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  
  const lowerKey = key.toLowerCase();
  if (lowerKey.startsWith("min")) return `>= ${value}`;
  if (lowerKey.startsWith("max")) return `<= ${value}`;
  
  return value;
};

// --- SUB-COMPONENT: ZK Passport Constraints Viewer ---
const ZKPassportConfigViewer = ({ config }) => {
  const entries = Object.entries(config || {}).filter(
    ([key]) => !IGNORED_CONFIG_KEYS.has(key)
  );

  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div 
          key={key} 
          className="group relative overflow-hidden border border-[#f0f0f0]/10 bg-black/40 p-4 transition-colors duration-300 hover:border-[#ccff00]/40 hover:bg-[#ccff00]/5"
        >
          {/* Декоративный уголок */}
          <div className="absolute right-0 top-0 h-2 w-2 border-r border-t border-[#ccff00]/50 opacity-0 transition-opacity group-hover:opacity-100" />
          
          <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.3em] text-[#f0f0f0]/40 group-hover:text-[#f0f0f0]/70 transition-colors">
            &gt; {formatLabel(key)}
          </span>
          <span className="font-mono text-sm font-bold text-[#ccff00] drop-shadow-[0_0_8px_rgba(204,255,0,0.2)]">
            {formatConfigValue(key, value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// --- SUB-COMPONENT: Crypto Input Matrix Viewer ---
const CryptoInputMatrixViewer = ({ userInputs }) => {
  const keys = Object.keys(userInputs || {});

  if (keys.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {keys.map((key) => (
        <div 
          key={key} 
          className="group relative flex flex-col border border-[#f0f0f0]/10 bg-black/40 p-4 transition-colors duration-300 hover:border-[#ccff00]/40 hover:bg-[#ccff00]/5"
        >
          <div className="absolute left-0 top-0 h-full w-[2px] bg-[#ccff00] opacity-0 transition-opacity group-hover:opacity-100" />
          
          <div className="mb-3 flex items-start justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#f0f0f0]/40 group-hover:text-[#f0f0f0]/70 transition-colors">
              &gt; {formatLabel(key)}
            </span>
            <span className="border border-[#ccff00]/30 bg-[#ccff00]/10 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-widest text-[#ccff00]">
              PRIVATE
            </span>
          </div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#f0f0f0]">
            TYPE: <span className="text-[#f0f0f0]/60">{userInputs[key]}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function PollManifestViewer({ manifest }) {
  if (!manifest) return null;

  const isZKPassport = manifest.verificationMethod === "zkpassport";

  return (
    <div className="glass-panel relative mb-8 overflow-hidden border border-[#f0f0f0]/10 bg-[#0a0a0a]/80 p-6 md:p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      
      {/* Декоративное фоновое свечение */}
      <div className="absolute left-[-50px] top-[-50px] h-[150px] w-[150px] rounded-full bg-[#ccff00]/5 blur-[80px] pointer-events-none" />

      {/* Header Info - Теперь на флексах, как в VotePage */}
      <div className="mb-8 flex flex-col items-start justify-between gap-3 border-b border-[#f0f0f0]/10 pb-5 md:flex-row md:items-end relative z-10">
        <div>
          <h3 className="mb-3 break-words font-display text-xl font-black uppercase leading-[1.1] tracking-widest text-[#f0f0f0] drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] md:text-2xl">
            {manifest.name || "UNNAMED_INSTANCE"}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#f0f0f0]/40">
              VERIFICATION_MODULE:
            </span>
            <span className="border border-[#f0f0f0]/20 bg-black/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#f0f0f0]/70">
              {manifest.verificationMethod}
            </span>
          </div>
        </div>

        {/* Security Level Badge - Интегрирован в поток документа */}
        <div className="flex items-center self-start space-x-2 border px-2 py-1 font-mono text-[9px] uppercase tracking-widest bg-black/40 backdrop-blur-sm border-[#ccff00]/30 text-[#ccff00]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ccff00] opacity-50"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ccff00]"></span>
          </span>
          <span>{isZKPassport ? "SEC_LEVEL: BIO" : "SEC_LEVEL: CRYPTO"}</span>
        </div>
      </div>

      {/* Dynamic Matrix View */}
      <div className="relative z-0">
        <h4 className="mb-5 flex items-center gap-3 font-mono text-xs font-bold uppercase tracking-widest text-[#f0f0f0]">
          <span className="text-[#ccff00] opacity-50">//</span> 
          {isZKPassport ? "IDENTITY_CONSTRAINTS" : "CRYPTO_INPUT_MATRIX"}
        </h4>
        
        {isZKPassport ? (
          <ZKPassportConfigViewer config={manifest.config} />
        ) : (
          <CryptoInputMatrixViewer userInputs={manifest.userInputs} />
        )}
      </div>
      
    </div>
  );
}