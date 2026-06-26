import React from 'react';
import { Users, CheckCircle, Server } from 'lucide-react';

export default function SquadPanel({ team, playerId, activeTab }) {
  return (
    <div className={`lg:col-span-3 bg-cyber-card border border-cyber-green/35 rounded p-4 flex flex-col shadow-neon-green h-[450px] lg:h-[550px] ${
      activeTab === 'squad' ? 'block' : 'hidden lg:flex'
    }`}>
      <div className="border-b border-cyber-green/20 pb-2 mb-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-cyber-green tracking-wider uppercase flex items-center">
            <Users className="w-4 h-4 mr-1.5 animate-pulse" /> Lobby Management
          </h3>
          <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping"></span>
        </div>
        <p className="text-[9px] text-cyber-gray mt-0.5 uppercase">Establishing secure collaborative session...</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        <p className="text-[10px] text-cyber-gray uppercase font-bold">Session Members ({team.members.length}/3)</p>
        
        {team.members.map((member, index) => (
          <div
            key={member.id}
            className={`flex items-center justify-between p-2.5 border rounded text-xs transition duration-150 ${
              member.id === playerId
                ? 'border-cyber-green bg-cyber-green-dark/20 text-cyber-green font-bold shadow-[0_0_8px_rgba(0,255,102,0.15)]'
                : 'border-cyber-green/20 bg-cyber-bg/20 text-cyber-gray'
            }`}
          >
            <div className="flex items-center space-x-2">
              <div className={`w-1.5 h-1.5 rounded-full ${member.id === playerId ? 'bg-cyber-green animate-ping' : 'bg-cyber-green/70'}`}></div>
              <span>{member.name}</span>
              {index === 0 && <span className="text-[8px] border border-cyber-green/40 px-1 py-0.2 rounded text-cyber-green">LEADER</span>}
            </div>
            <CheckCircle className="w-3.5 h-3.5 text-cyber-green" />
          </div>
        ))}

        {team.members.length < 3 && !team.isSolo && (
          <div className="border border-dashed border-cyber-green/20 p-4 rounded text-center text-cyber-gray text-[10px] flex flex-col items-center justify-center space-y-1.5 mt-4">
            <Server className="w-5 h-5 text-cyber-green/20 animate-pulse" />
            <span>WAITING FOR MEMBERS TO CONNECT</span>
            <span className="text-cyber-green font-bold text-xs">CODE: {team.code || team.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
