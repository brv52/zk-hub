import React from 'react';

export default function PollManifestViewer({ manifest }) {
  if (!manifest) return null;

  const isZKPassport = manifest.verificationMethod === "zkpassport";

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
      <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{manifest.name || "Anonymous Poll"}</h3>
          <p className="mt-1 text-sm text-gray-500 font-mono text-xs">Method: {manifest.verificationMethod}</p>
        </div>
        {isZKPassport && (
           <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
             ZKPassport Biometric
           </span>
        )}
      </div>

      <div className="px-4 py-5 sm:p-6">
        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
            {isZKPassport ? "Required Identity Constraints" : "Required Cryptographic Inputs"}
        </h4>
        
        {isZKPassport ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {manifest.config?.minAge && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 shadow-sm">
                <dt className="text-sm font-bold text-gray-900">Minimum Age</dt>
                <dd className="mt-1 text-sm text-gray-600">Must be {manifest.config.minAge} years or older.</dd>
              </div>
            )}
            {manifest.config?.nationality && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 shadow-sm">
                <dt className="text-sm font-bold text-gray-900">Eligible Nationalities</dt>
                <dd className="mt-1 text-sm text-gray-600">{manifest.config.nationality.join(", ")}</dd>
              </div>
            )}
          </dl>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Object.keys(manifest.userInputs || {}).map((key) => (
              <div key={key} className="bg-gray-50 p-4 rounded-md border border-gray-200 shadow-sm">
                <dt className="text-sm font-bold text-gray-900 capitalize flex items-center gap-2">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-800 border border-green-200">Private</span>
                </dt>
                <dd className="mt-1 text-sm text-gray-600 font-mono">Type: {manifest.userInputs[key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}