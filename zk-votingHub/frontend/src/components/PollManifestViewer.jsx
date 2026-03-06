import React from 'react';

export default function PollManifestViewer({ manifest }) {
  if (!manifest) return null;

  const isZKPassport = manifest.verificationMethod === "zkpassport";

  return (
    <div className="glass-panel p-6 border-[#f0f0f0]/30 mb-8 relative">
      <div className="absolute top-0 right-0 p-2 border-l border-b border-[#f0f0f0]/20 bg-[#0a0a0a]/80">
        <span className="font-mono text-[8px] text-[#ccff00] uppercase tracking-[0.3em] font-bold">
          {isZKPassport ? "SEC_LEVEL: BIO" : "SEC_LEVEL: CRYPTO"}
        </span>
      </div>

      <div className="border-b border-[#f0f0f0]/20 pb-4 mb-6">
        <h3 className="font-display text-2xl font-black uppercase text-[#f0f0f0] tracking-widest mb-1">
          {manifest.name || "UNNAMED_INSTANCE"}
        </h3>
        <p className="font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.3em]">
          VERIFICATION_MODULE: {manifest.verificationMethod}
        </p>
      </div>

      <div>
        <h4 className="font-mono text-xs font-bold text-[#f0f0f0] uppercase tracking-widest mb-4 border-l-2 border-[#ccff00] pl-3">
            {isZKPassport ? "// IDENTITY_CONSTRAINTS" : "// CRYPTO_INPUT_MATRIX"}
        </h4>
        
        {isZKPassport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(manifest.config || {}).map(([key, value]) => {
              // Пропускаем технические поля, если они вдруг оказались в конфиге
              if (key === 'pollId' || key === 'storageURI' || key === 'depth') return null;

              // Превращаем camelCase ключи в киберпанк-формат (minAge -> MIN_AGE)
              const displayKey = key.replace(/([A-Z])/g, "_$1").toUpperCase();

              // Умное форматирование значения
              let displayValue = value;
              if (Array.isArray(value)) {
                displayValue = value.join(", ");
              } else if (typeof value === "boolean") {
                displayValue = value ? "TRUE" : "FALSE";
              } else if (key.toLowerCase().startsWith("min")) {
                displayValue = `>= ${value}`;
              } else if (key.toLowerCase().startsWith("max")) {
                displayValue = `<= ${value}`;
              }

              return (
                <div key={key} className="border border-[#f0f0f0]/20 p-4 bg-[#0a0a0a]/50">
                  <span className="block font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em] mb-1">
                    {displayKey}
                  </span>
                  <span className="font-mono text-xs text-[#ccff00] font-bold">
                    {displayValue}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(manifest.userInputs || {}).map((key) => (
              <div key={key} className="border border-[#f0f0f0]/20 p-4 bg-[#0a0a0a]/50 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-[10px] text-[#f0f0f0]/50 uppercase tracking-[0.2em]">
                    {key.replace(/([A-Z])/g, "_$1").toUpperCase()}
                  </span>
                  <span className="text-[8px] bg-[#ccff00] text-[#0a0a0a] px-1 font-bold tracking-widest">PRIVATE</span>
                </div>
                <span className="font-mono text-xs text-[#f0f0f0] uppercase">TYPE: {manifest.userInputs[key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}