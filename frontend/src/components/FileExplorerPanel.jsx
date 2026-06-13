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
        {/* Back button if not in root */}
        {currentPath !== '/' && (
          <button
            onClick={handleVisualBack}
            className="flex items-center space-x-2 p-1.5 border border-cyber-cyan/40 hover:bg-cyber-cyan/15 text-cyber-cyan text-xs font-bold rounded transition w-fit"
          >
            <span>&larr; BACK</span>
          </button>
        )}

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
          {Object.entries(getContentsAtPath()).map(([name, val]) => {
            const isDir = typeof val === 'object';
            const isHidden = name.startsWith('.');
            
            if (isHidden) return null; // Hide dot files in visual list to match terminal rules

            return (
              <div
                key={name}
                onClick={() => handleVisualClick(name, isDir)}
                className="flex items-center justify-between p-2.5 border border-cyber-cyan/15 bg-cyber-bg/40 hover:bg-cyber-cyan/15 rounded cursor-pointer transition text-cyber-gray hover:text-cyber-cyan group"
              >
                <div className="flex items-center space-x-2">
                  {isDir ? (
                    <Folder className="w-4 h-4 text-cyber-cyan group-hover:scale-115 transition duration-150" />
                  ) : (
                    <File className="w-4 h-4 text-cyber-gray group-hover:text-cyber-cyan transition" />
                  )}
                  <span className={isDir ? 'font-semibold text-cyber-cyan' : ''}>{name}</span>
                </div>
                <span className="text-[8px] text-cyber-cyan/30 uppercase">
                  {isDir ? 'directory' : 'system file'}
                </span>
              </div>
            );
          })}

          {Object.keys(getContentsAtPath()).filter(n => !n.startsWith('.')).length === 0 && (
            <div className="text-center text-cyber-gray text-xs py-8">
              No visual files in this sector.
            </div>
          )}
        </div>

        <div className="text-[9px] text-cyber-gray border-t border-cyber-cyan/15 pt-2 flex items-center justify-between">
          <span>CAPACITY: STABLE</span>
          <span className="text-cyber-cyan animate-pulse">&#9679; LINK ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
