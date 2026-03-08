import React from 'react';

export default function TopNav({ account, connectWallet, resetView }) {
  return (
    <header className="absolute top-0 left-0 z-50 flex w-full items-start justify-between p-4 md:p-6 pointer-events-none">
      <button 
        onClick={resetView} 
        className="group flex flex-col items-start pointer-events-auto cursor-pointer mix-blend-difference"
      >
        <span className="font-display text-3xl font-black leading-none tracking-tighter transition-none group-hover:text-[#ccff00]">ZK//</span>
        <span className="font-display text-3xl font-black leading-none tracking-tighter transition-none group-hover:text-[#ccff00]">HUB_</span>
      </button>

      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {account ? (
          <div className="glass-panel flex items-center gap-3 border-[#ccff00]/50 px-4 py-2">
            <div className="h-2 w-2 animate-pulse rounded-none bg-[#ccff00]"></div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#ccff00]">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          </div>
        ) : (
          <button onClick={connectWallet} className="brutal-btn">
            [ INIT_CONNECTION ]
          </button>
        )}
      </div>
    </header>
  );
}