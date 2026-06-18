import React from 'react';
import { Compass, Folder, File } from 'lucide-react';

export default function FileExplorerPanel({
  currentPath,
  getContentsAtPath,
  handleVisualBack,
  handleVisualClick,
  activeTab
}) {
  return (
    <div className={`lg:col-span-3 bg-cyber-card border border-cyber-cyan/35 rounded p-4 flex flex-col shadow-neon-cyan h-[450px] lg:h-[550px] ${
      activeTab === 'files' ? 'block' : 'hidden lg:flex'
    }`}>
      <div className="border-b border-cyber-cyan/20 pb-2 mb-3">
        <h3 className="text-xs font-bold text-cyber-cyan tracking-wider uppercase flex items-center">
          <Compass className="w-4 h-4 mr-1.5" /> File System Explorer
        </h3>
        <p className="text-[9px] text-cyber-cyan mt-0.5 uppercase font-bold">ROOT &gt; {currentPath.substring(1) || 'SYSTEM'}</p>
      </div>

      <div className="flex-1 flex flex-col space-y-3">
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
          {currentPath !== '/' && (
            <div
              key=".."
              onClick={() => handleVisualBack()}
              className="flex items-center justify-between p-2.5 border rounded text-cyber-gray select-none transition duration-150 border-cyber-cyan/15 bg-cyber-bg/40 cursor-pointer hover:border-cyber-cyan hover:bg-cyber-cyan/10"
            >
              <div className="flex items-center space-x-2">
                <Folder className="w-4 h-4 text-cyber-cyan" />
                <span className="font-semibold text-cyber-cyan">..</span>
              </div>
              <span className="text-[8px] uppercase text-cyber-cyan/30">parent dir</span>
            </div>
          )}
          {Object.entries(getContentsAtPath()).map(([name, val]) => {
            const isDir = val.type==='dir';
            const isHidden = name.startsWith('.')|| val.hidden || ["author","creation","type","hidden","password"].includes(name);
            
            const isReadme = name.toLowerCase().startsWith('readme');
            
            if (isHidden) return null; // Hide dot files in visual list to match terminal rules

            return (
              <div
                key={name}
                onClick={() => {
                    handleVisualClick(name, isDir);
                }}
                className={`flex items-center justify-between p-2.5 border rounded text-cyber-gray select-none transition duration-150 ${
                  isReadme
                    ? 'border-cyber-cyan/40 bg-cyber-cyan-dark/20 hover:border-cyber-cyan hover:bg-cyber-cyan/10 cursor-pointer text-white shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                    : 'border-cyber-cyan/15 bg-cyber-bg/40'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {isDir ? (
                    <Folder className="w-4 h-4 text-cyber-cyan" />
                  ) : (
                    <File className={`w-4 h-4 ${isReadme ? 'text-cyber-cyan' : 'text-cyber-gray'}`} />
                  )}
                  <span className={isDir ? 'font-semibold text-cyber-cyan' : isReadme ? 'font-bold text-cyber-cyan' : ''}>{name}</span>
                </div>
                <span className="text-[8px] uppercase">
                  {isReadme ? (
                    <span className="text-cyber-cyan font-bold animate-pulse">Touch to Open</span>
                  ) : isDir ? (
                    <span className="text-cyber-cyan/30">directory</span>
                  ) : (
                    <span className="text-cyber-gray/30">system file</span>
                  )}
                </span>
              </div>
            );
          })}

        </div>

        <div className="text-[9px] text-cyber-gray border-t border-cyber-cyan/15 pt-2 flex items-center justify-between">
          <span>CAPACITY: STABLE</span>
          <span className="text-cyber-cyan animate-pulse">&#9679; LINK ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
