import React from 'react';

export default function PollCard({ poll, myVoteStatus, onGoToVote }) {
  return (
    <div className="glass-panel group relative flex min-h-[220px] flex-col justify-between p-6">
      <div className="pointer-events-none absolute right-2 top-0 select-none font-display text-7xl font-black text-[#f0f0f0]/5 transition-none group-hover:text-[#ccff00]/10">
        {poll.id.toString().padStart(3, '0')}
      </div>

      <div className="relative z-10 mb-6">
        <div className="mb-4 flex items-start justify-between">
          <span className="bg-[#f0f0f0] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#0a0a0a]">
            ID:{poll.id}
          </span>
          {myVoteStatus && (
            <span className="border border-[#ccff00] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#ccff00]">
              [ SIGNED ]
            </span>
          )}
        </div>
        <h3 className="break-words line-clamp-1 font-display text-xl font-bold uppercase leading-tight transition-none group-hover:text-[#ccff00] md:text-2xl">
          {poll.question}
        </h3>
      </div>

      <div className="relative z-10 mt-auto">
        {myVoteStatus ? (
          <div className="mb-4 border-l-2 border-[#ccff00] pl-3">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-[#f0f0f0]/50">LOCAL_HASH_COMMIT:</p>
            <p className="text-sm font-bold text-[#ccff00]">{myVoteStatus}</p>
          </div>
        ) : (
          <p className="mb-4 truncate text-[10px] uppercase tracking-widest text-[#f0f0f0]/50">
            AUTHOR: {poll.creator}
          </p>
        )}

        <button 
          onClick={() => onGoToVote(poll.id)}
          className="brutal-btn w-full text-center"
        >
          {myVoteStatus ? 'DECRYPT_RESULTS' : 'INITIATE_ZK_PROOF'}
        </button>
      </div>
    </div>
  );
}