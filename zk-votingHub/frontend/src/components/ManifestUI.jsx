import React from "react";

export default function ManifestUI({ manifest, zkInputs, setZkInputs, isProving, onSubmit }) {
  const inputKeys = manifest?.inputOrder || Object.keys(manifest?.userInputs || {});

  if (inputKeys.length === 0) {
    return (
      <div className="py-4 border-t border-gray-100 mt-6">
        <p className="text-gray-500 text-sm mb-4">No specific cryptographic inputs required for this verification method.</p>
        <SubmitButton isProving={isProving} onSubmit={onSubmit} />
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6 border-t border-gray-100 pt-6">
      <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Cryptographic Proof Inputs</h4>
      {inputKeys.map((key) => {
        const type = manifest.userInputs?.[key] || "string";
        const isNumber = type === "number";

        return (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 capitalize mb-1">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </label>
            <input
              type={isNumber ? "number" : "text"}
              className="block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder={`Enter your ${key}`}
              value={zkInputs[key] || ""}
              onChange={(e) => setZkInputs((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          </div>
        );
      })}
      <div className="pt-2">
        <SubmitButton isProving={isProving} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

const SubmitButton = ({ isProving, onSubmit }) => (
  <button
    onClick={onSubmit}
    disabled={isProving}
    className={`w-full py-4 rounded-md text-white font-bold transition shadow-sm ${
      isProving ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
    }`}
  >
    {isProving ? "Processing Cryptography..." : "Generate Proof & Vote"}
  </button>
);