import React from 'react';
import { Trophy, CheckCircle, Lock, Unlock } from 'lucide-react';

export default function MissionProgressPanel({ levelData, activeLevel, activeTab, onSelectLevel, getLevelName }) {
  return (
    <div className={`lg:col-span-3 bg-cyber-card border border-cyber-purple/35 rounded p-4 flex flex-col shadow-neon-purple h-[450px] lg:h-[550px] ${
      activeTab === 'levels' ? 'block' : 'hidden lg:flex'
    }`}>
      <div className="border-b border-cyber-purple/20 pb-2 mb-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-cyber-magenta tracking-wider uppercase flex items-center">
            <Trophy className="w-4 h-4 mr-1.5" /> Mission Progress
          </h3>
          <span className="text-xs font-bold text-cyber-magenta font-sans">{(levelData.solvedLevels?.length || 0)} / 5 Cracked</span>
        </div>
        <p className="text-[9px] text-cyber-gray mt-0.5 uppercase">Select active decryption point</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {[1, 2, 3, 4, 5].map((lvl) => {
          const isSolved = levelData.solvedLevels?.includes(lvl);
          const isActive = activeLevel === lvl && !levelData.completed;
          const isLocked = false;

          const levelTitle = getLevelName ? getLevelName(lvl) : `Level ${lvl}`;

          return (
            <div
              key={lvl}
              onClick={() => onSelectLevel(lvl)}
              className={`p-3.5 border rounded text-xs transition duration-150 flex flex-col space-y-2.5 cursor-pointer hover:border-cyber-cyan/60 ${
                isActive
                  ? 'border-cyber-amber bg-cyber-amber-dark/15 text-cyber-amber font-bold shadow-neon-amber'
                  : isSolved
                  ? 'border-cyber-green bg-cyber-green-dark/10 text-cyber-green opacity-60'
                  : 'border-cyber-border bg-cyber-bg/10 text-cyber-gray/60 hover:text-cyber-cyan'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold tracking-wide">{levelTitle}</span>
                {isSolved ? (
                  <div className="flex items-center space-x-1 text-cyber-green">
                    <span className="text-[10px] font-bold">CRACKED</span>
                    <CheckCircle className="w-4 h-4 fill-cyber-green/15 text-cyber-green" />
                  </div>
                ) : isLocked ? (
                  <Lock className="w-4 h-4 text-cyber-gray/50" />
                ) : (
                  <Unlock className="w-4 h-4 text-cyber-amber" />
                )}
              </div>

              <div className="flex justify-between items-center text-[9px]">
                <span className="uppercase">
                  {isSolved ? 'STATUS: SOLVED (+1pt)' : isActive ? 'STATUS: IN PROGRESS' : 'STATUS: SECURED'}
                </span>
                
                {isActive && (
                  <span className="px-2.5 py-0.5 border border-cyber-amber text-cyber-amber font-bold animate-pulse uppercase rounded-[2px] text-[8px] bg-cyber-amber-dark/20">
                    ACTIVE
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
