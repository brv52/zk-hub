import React from "react";

export default function ManifestUI({ manifest, zkInputs, setZkInputs, isProving, onSubmit }) {
  const inputKeys = manifest?.inputOrder || Object.keys(manifest?.userInputs || {});

  if (inputKeys.length === 0) {
    return (
      <div className="py-6 border-t border-[#f0f0f0]/20 mt-6">
        <p className="font-mono text-xs text-[#f0f0f0]/50 uppercase tracking-widest mb-6">
          &gt; NO_MANUAL_INPUTS_REQUIRED
        </p>
        <SubmitButton isProving={isProving} onSubmit={onSubmit} />
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-6 border-t border-[#f0f0f0]/20 pt-6">
      <h4 className="font-mono text-xs font-bold text-[#f0f0f0] uppercase tracking-widest border-l-2 border-[#ccff00] pl-3">
        // INJECT_PAYLOAD_DATA
      </h4>
      {inputKeys.map((key) => {
        const type = manifest.userInputs?.[key] || "string";
        const isNumber = type === "number";

        return (
          <div key={key}>
            <label className="block font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em] mb-2">
              &gt; {key.replace(/([A-Z])/g, "_$1").toUpperCase()}
            </label>
            <input
              type={isNumber ? "number" : "text"}
              className="w-full md:w-1/2 p-4 bg-transparent border border-[#f0f0f0]/20 text-[#f0f0f0] font-mono text-xs uppercase tracking-widest focus:border-[#ccff00] focus:ring-0 outline-none transition-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              placeholder={`[ ENTER_${key.toUpperCase()} ]`}
              value={zkInputs[key] || ""}
              onChange={(e) => setZkInputs((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          </div>
        );
      })}
      <div className="pt-4">
        <SubmitButton isProving={isProving} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

const SubmitButton = ({ isProving, onSubmit }) => (
  <button
    onClick={onSubmit}
    disabled={isProving}
    className={`w-full brutal-btn !py-4 ${
      isProving ? "!border-[#f0f0f0]/20 !text-[#f0f0f0]/20 pointer-events-none" : "!border-[#ccff00] !text-[#ccff00] hover:!bg-[#ccff00] hover:!text-[#0a0a0a]"
    }`}
  >
    {isProving ? (
        <span className="animate-glitch">[ OBFUSCATING_DATA... ]</span>
    ) : "GENERATE_ZK_PROOF && EXECUTE_VOTE"}
  </button>
);