import React from 'react';

export default function LandingScreen({ connectWallet }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center p-[12.5vh] text-center">
      <h1 className="font-display mb-6 py-2 text-5xl font-black uppercase leading-[0.9] tracking-tighter mix-blend-difference md:text-7xl">
        Zero Knowledge <br/>
        <span className="border-text text-transparent" style={{ WebkitTextStroke: '1px #f0f0f0' }}>
          Consensus Protocol
        </span>
      </h1>
      <p className="mb-12 text-xs uppercase tracking-[0.3em] text-[#f0f0f0]/60">
        Cryptographically secure. Universally verifiable. Identity obliterated.
      </p>
      <button onClick={connectWallet} className="brutal-btn px-12 py-5 text-sm">
        EXECUTE_HANDSHAKE
      </button>
    </div>
  );
}