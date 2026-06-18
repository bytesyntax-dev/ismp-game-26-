import React from 'react';
import { Terminal as TermIcon } from 'lucide-react';

export default function TerminalPanel({
  terminalOutput,
  terminalInput,
  setTerminalInput,
  handleTerminalKeyDown,
  currentPath,
  playerName,
  activeTab,
  terminalEndRef
}) {
  return (
    <div className={`lg:col-span-3 bg-cyber-card border border-cyber-red/35 rounded p-4 flex flex-col shadow-neon-red h-[450px] lg:h-[550px] ${
      activeTab === 'terminal' ? 'block' : 'hidden lg:flex'
    }`}>
      <div className="border-b border-cyber-red/20 pb-2 mb-2">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-cyber-red tracking-wider uppercase flex items-center">
            <TermIcon className="w-4 h-4 mr-1.5 animate-pulse" /> Terminal Console
          </h3>
          <div className="flex items-center space-x-1 text-[8px] text-cyber-green">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-ping"></span>
            <span>ONLINE</span>
          </div>
        </div>
        <p className="text-[9px] text-cyber-gray mt-0.5 uppercase">Encrypted Shell // User@{playerName.toLowerCase()}</p>
      </div>

      {/* Terminal Logs scroll viewport to make easily readable*/}
      <div className="flex-1 bg-cyber-bg/90 border border-cyber-border p-3 rounded font-mono text-xs overflow-y-auto space-y-1.5 select-text scrollbar-thin">
        {terminalOutput.map((log, index) => {
          let textClass = "text-white";
          if (log.type === 'input') {
            return (
              <div key={index} className="text-cyber-cyan">
                <span className="text-cyber-cyan/50">user@mainframe:{currentPath}$</span> {log.text}
              </div>
            );
          }
          if (log.type === 'error') textClass = "text-cyber-red font-semibold";
          if (log.type === 'success') textClass = "text-cyber-green font-bold";
          if (log.type === 'system') textClass = "text-cyber-amber";
          if (log.type === 'output') textClass = "text-cyber-gray/90";

          return (
            <div key={index} className={`${textClass} whitespace-pre-wrap leading-relaxed`}>
              {log.text}
            </div>
          );
        })}
        <div ref={terminalEndRef} />
      </div>

      {/* Console Input Bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs border border-cyber-red/35 bg-cyber-bg rounded p-2 focus-within:border-cyber-red transition">
        <span className="text-cyber-cyan break-all">user:{currentPath}$</span>
        <input
          type="text"
          value={terminalInput}
          onChange={(e) => setTerminalInput(e.target.value)}
          onKeyDown={handleTerminalKeyDown}
          placeholder="Type 'help' to begin..."
          className="flex-grow min-w-[150px] bg-transparent text-white outline-none border-none caret-cyber-red"
          autoFocus
        />
      </div>

      <div className="mt-1 flex items-center justify-between text-[9px] text-cyber-gray">
        <span>PRESS UP/DOWN FOR HISTORY</span>
        <span>DECRYPT LINK ACTIVE</span>
      </div>
    </div>
  );
}
