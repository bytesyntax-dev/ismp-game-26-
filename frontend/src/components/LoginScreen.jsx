import React from 'react';
import { Terminal as TermIcon, ArrowRight } from 'lucide-react';

export default function LoginScreen({ playerName, setPlayerName, errorMsg, handleLoginSubmit }) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center p-4 min-h-[500px]">
      <div className="w-full max-w-md bg-cyber-card border border-cyber-cyan/55 p-8 rounded shadow-neon-cyan space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-cyber-cyan shadow-neon-cyan"></div>
        
        <div className="text-center">
          <div className="inline-flex p-3 bg-cyber-cyan-dark/30 border border-cyber-cyan/50 rounded-full mb-3">
            <TermIcon className="w-8 h-8 text-cyber-cyan animate-pulse" />
          </div>
          <h1 className="text-3xl font-mono font-bold text-cyber-cyan tracking-wider uppercase">CYBER_TERMINAL</h1>
          <p className="text-xs text-cyber-gray font-mono mt-1">SECURE COLLABORATIVE DECRYPTION INTERFACE</p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4 font-mono">
          <div>
            <label className="block text-xs text-cyber-cyan mb-1 font-bold">REGISTER OPERATOR HANDLE</label>
            <input
              type="text"
              required
              placeholder="e.g. NeoCoder_01"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={14}
              className="w-full bg-cyber-bg text-cyber-cyan border border-cyber-cyan/40 focus:border-cyber-cyan p-3 outline-none rounded text-center font-bold tracking-widest placeholder-cyber-cyan/30 shadow-[inset_0_0_5px_rgba(0,240,255,0.05)]"
            />
          </div>

          {errorMsg && (
            <div className="text-cyber-red text-center text-xs bg-cyber-red-dark/30 border border-cyber-red/30 p-2 rounded font-bold">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-cyber-cyan text-black font-bold p-3 hover:bg-white hover:text-black border border-cyber-cyan hover:shadow-neon-cyan-intense transition duration-200 rounded flex items-center justify-center space-x-2 text-sm"
          >
            <span>ESTABLISH UPLINK LINK</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
