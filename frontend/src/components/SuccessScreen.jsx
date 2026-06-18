import React from 'react';
import { Award } from 'lucide-react';

export default function SuccessScreen({
  completedState,
  team,
  levelData,
  formatStopwatch,
  handleDisconnect,
  onGoToLeaderboard
}) {
  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center font-mono border-4 border-cyber-cyan p-6">
      <div className="matrix-bg absolute inset-0 opacity-15"></div>
      <div className="relative text-center max-w-xl space-y-6">
        <div className="inline-flex p-4 bg-cyber-cyan-dark border-2 border-cyber-cyan rounded-full shadow-neon-cyan-intense animate-bounce mb-2">
          <Award className="w-20 h-20 text-cyber-cyan" />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-cyber-cyan tracking-wider uppercase drop-shadow-[0_0_12px_rgba(0,240,255,0.9)] animate-pulse">
          ACCESS GRANTED
        </h1>
        <h2 className="text-xl md:text-2xl text-white font-bold tracking-widest uppercase">
          MAINFRAME OVERRIDDEN
        </h2>
        <div className="bg-cyber-card border border-cyber-cyan/40 p-4 rounded text-left space-y-2 text-sm shadow-neon-cyan">
          <p className="text-cyber-cyan">----------------------------------------</p>
          <p className="text-white">NODE OPERATORS: <span className="font-bold">{team.members.map(m => m.name).join(', ')}</span></p>
          <p className="text-white">TOTAL LEVELS CRACKED: <span className="font-bold text-cyber-cyan">{(levelData.solvedLevels?.length || 0)} / 5</span></p>
          <p className="text-white">TOTAL POINTS SECURED: <span className="font-bold text-cyber-cyan">{levelData.score} PTS</span></p>
          <p className="text-white">DECRYPTION LAPSE TIME: <span className="font-bold text-cyber-cyan">{formatStopwatch(Math.floor(completedState.finalTime / 1000))}</span></p>
          <p className="text-white">FINAL NODE KEY CRACKER: <span className="font-bold">{completedState.solvedBy}</span></p>
          <p className="text-cyber-cyan">----------------------------------------</p>
        </div>
        <div className="pt-4 space-y-4">
          <p className="text-cyber-gray text-xs">The cyber-security system has been compromised. All credentials purged.</p>
          <div className="flex justify-center">
            <button
              onClick={onGoToLeaderboard}
              className="px-8 py-3.5 bg-cyber-cyan text-black font-bold hover:bg-white border border-cyber-cyan rounded hover:shadow-neon-cyan-intense transition duration-200 uppercase text-sm"
            >
              Go to Leaderboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
