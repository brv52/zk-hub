import React from "react";

// --- HELPERS ---
// Extracts camelCase keys into SNAKE_CASE for the brutalist UI
const formatLabel = (key) => key.replace(/([A-Z])/g, "_$1").toUpperCase();

// --- SUB-COMPONENT: Individual Input Field ---
const ManifestInput = ({ inputKey, type, value, onChange }) => {
  const isNumber = type === "number";

  return (
    <div>
      <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#f0f0f0]/50">
        &gt; {formatLabel(inputKey)}
      </label>
      <input
        type={isNumber ? "number" : "text"}
        placeholder={`[ ENTER_${inputKey.toUpperCase()} ]`}
        value={value || ""}
        onChange={(e) => onChange(inputKey, e.target.value)}
        className="w-full md:w-1/2 p-4 border border-[#f0f0f0]/20 bg-transparent font-mono text-xs uppercase tracking-widest text-[#f0f0f0] outline-none transition-none focus:border-[#ccff00] focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
};

// --- SUB-COMPONENT: Submit Action ---
const SubmitButton = ({ isProving, onSubmit }) => (
  <button
    onClick={onSubmit}
    disabled={isProving}
    className={`brutal-btn w-full !py-4 ${
      isProving
        ? "pointer-events-none !border-[#f0f0f0]/20 !text-[#f0f0f0]/20"
        : "!border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a]"
    }`}
  >
    {isProving ? (
      <span className="animate-glitch">[ OBFUSCATING_DATA... ]</span>
    ) : (
      "GENERATE_ZK_PROOF && EXECUTE_VOTE"
    )}
  </button>
);

// --- MAIN COMPONENT ---
export default function ManifestUI({ manifest, zkInputs, setZkInputs, isProving, onSubmit }) {
  const inputKeys = manifest?.inputOrder || Object.keys(manifest?.userInputs || {});

  const handleInputChange = (key, value) => {
    setZkInputs((prev) => ({ ...prev, [key]: value }));
  };

  if (inputKeys.length === 0) {
    return (
      <div className="mt-6 border-t border-[#f0f0f0]/20 py-6">
        <p className="mb-6 font-mono text-xs uppercase tracking-widest text-[#f0f0f0]/50">
          &gt; NO_MANUAL_INPUTS_REQUIRED
        </p>
        <SubmitButton isProving={isProving} onSubmit={onSubmit} />
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-6 border-t border-[#f0f0f0]/20 pt-6">
      <h4 className="border-l-2 border-[#ccff00] pl-3 font-mono text-xs font-bold uppercase tracking-widest text-[#f0f0f0]">
        // INJECT_PAYLOAD_DATA
      </h4>
      
      <div className="space-y-4">
        {inputKeys.map((key) => (
          <ManifestInput
            key={key}
            inputKey={key}
            type={manifest.userInputs?.[key] || "string"}
            value={zkInputs[key]}
            onChange={handleInputChange}
          />
        ))}
      </div>

      <div className="pt-4">
        <SubmitButton isProving={isProving} onSubmit={onSubmit} />
      </div>
    </div>
  );
}