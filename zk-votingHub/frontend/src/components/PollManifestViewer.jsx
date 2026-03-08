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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="border border-[#f0f0f0]/20 bg-[#0a0a0a]/50 p-4">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
            {formatLabel(key)}
          </span>
          <span className="font-mono text-xs font-bold text-[#ccff00]">
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {keys.map((key) => (
        <div key={key} className="flex flex-col border border-[#f0f0f0]/20 bg-[#0a0a0a]/50 p-4">
          <div className="mb-2 flex items-start justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
              {formatLabel(key)}
            </span>
            <span className="bg-[#ccff00] px-1 text-[8px] font-bold tracking-widest text-[#0a0a0a]">
              PRIVATE
            </span>
          </div>
          <span className="font-mono text-xs uppercase text-[#f0f0f0]">
            TYPE: {userInputs[key]}
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
    <div className="glass-panel relative mb-8 border-[#f0f0f0]/30 p-6">
      
      {/* Security Level Badge */}
      <div className="absolute right-0 top-0 border-b border-l border-[#f0f0f0]/20 bg-[#0a0a0a]/80 p-2">
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.3em] text-[#ccff00]">
          {isZKPassport ? "SEC_LEVEL: BIO" : "SEC_LEVEL: CRYPTO"}
        </span>
      </div>

      {/* Header Info */}
      <div className="mb-6 border-b border-[#f0f0f0]/20 pb-4">
        <h3 className="mb-1 font-display text-2xl font-black uppercase tracking-widest text-[#f0f0f0]">
          {manifest.name || "UNNAMED_INSTANCE"}
        </h3>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#f0f0f0]/50">
          VERIFICATION_MODULE: {manifest.verificationMethod}
        </p>
      </div>

      {/* Dynamic Matrix View */}
      <div>
        <h4 className="mb-4 border-l-2 border-[#ccff00] pl-3 font-mono text-xs font-bold uppercase tracking-widest text-[#f0f0f0]">
          {isZKPassport ? "// IDENTITY_CONSTRAINTS" : "// CRYPTO_INPUT_MATRIX"}
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