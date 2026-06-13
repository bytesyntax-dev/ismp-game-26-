import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, Trophy, Users, Clock, Radio, X } from 'lucide-react';
import { sound } from '../utils/sound';

export default function AdminPortal({ playerId, onClose }) {
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ teams: [], totalPlayers: 0, activeTeams: 0 });
  const [isResetting, setIsResetting] = useState(false);

  // Load from session storage if refreshed
  useEffect(() => {
    const savedPass = sessionStorage.getItem('admin_pass');
    if (savedPass === 'cyberadmin123') {
      setIsAuthenticated(true);
      fetchAdminData('cyberadmin123');
    }
  }, []);

  // Poll for admin dashboard data updates in the background
  useEffect(() => {
    if (!isAuthenticated) return;

    const savedPass = sessionStorage.getItem('admin_pass') || passcode;
    
    // Initial fetch
    fetchAdminData(savedPass);

    // Poll every 3 seconds
    const interval = setInterval(() => {
      fetchAdminData(savedPass);
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const fetchAdminData = async (pass) => {
    try {
      const response = await fetch(`/api/admin/data?passcode=${pass}`);
      if (response.ok) {
        const data = await response.json();
        // Check if backend responds with standard telemetry counts or team lists
        const teamList = data.teams || [];
        setStats({
          teams: teamList,
          totalPlayers: data.totalPlayers ?? teamList.reduce((acc, t) => acc + (t.members?.length || 0), 0),
          activeTeams: data.activeTeams ?? teamList.length
        });
      } else {
        setError('Incorrect authorization hash.');
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin_pass');
      }
    } catch (e) {
      console.error(e);
      setError('Cannot establish uplink connection to server.');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    sound.playClick();
    if (passcode === 'cyberadmin123') {
      setIsAuthenticated(true);
      setError('');
      sessionStorage.setItem('admin_pass', passcode);
      fetchAdminData(passcode);
    } else {
      sound.playError();
      setError('ACCESS DENIED: Invalid Decryption Key.');
    }
  };

  const handleResetGame = () => {
    sound.playClick();
    const confirmReset = window.confirm("WARNING: Are you sure you want to hard reset the game? This will wipe all teams, active player sessions, progress, and scores!");
    if (!confirmReset) return;

    setIsResetting(true);

    fetch('/api/admin/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-player-id': playerId
      },
      body: JSON.stringify({ passcode: 'cyberadmin123' })
    })
    .then(res => res.json())
    .then(res => {
      setIsResetting(false);
      if (res.success) {
        sound.playSuccess();
        alert("Mainframe reset successfully. All logs purged.");
        fetchAdminData('cyberadmin123'); // Refresh data
      } else {
        sound.playError();
        alert(`Error resetting game: ${res.error}`);
      }
    })
    .catch(err => {
      setIsResetting(false);
      sound.playError();
      alert("Network error: Cannot reach admin server.");
    });
  };

  // Helper to format duration in MM:SS
  const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '00:00';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));

    const pad = (num) => String(num).padStart(2, '0');
    return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  };

  // Sort teams for leaderboard: Score (descending), then Elapsed Time (ascending)
  const sortedTeams = [...stats.teams].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.elapsed - b.elapsed;
  });

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 border border-cyber-cyan/30">
        <div className="relative w-full max-w-md bg-cyber-card p-8 rounded border border-cyber-cyan shadow-neon-cyan">
          <button onClick={onClose} className="absolute top-4 right-4 text-cyber-gray hover:text-cyber-cyan transition">
            <X className="w-6 h-6" />
          </button>
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-cyber-cyan-dark rounded-full border border-cyber-cyan mb-3">
              <Shield className="w-8 h-8 text-cyber-cyan animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold font-mono tracking-widest text-cyber-cyan">SYS_ADMIN UPLINK</h2>
            <p className="text-cyber-gray text-xs font-mono mt-1">RESTRICTED ACCESS AREA</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 font-mono">
            <div>
              <label className="block text-xs text-cyber-cyan mb-1 font-bold">ENTER AUTHORIZATION KEY</label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••••••••"
                className="w-full bg-cyber-bg text-cyber-cyan border border-cyber-cyan/50 focus:border-cyber-cyan p-3 outline-none text-center rounded placeholder-cyber-cyan/30 shadow-[inset_0_0_5px_rgba(0,240,255,0.1)]"
                autoFocus
              />
            </div>
            {error && (
              <div className="text-cyber-red text-center text-xs bg-cyber-red-dark/30 border border-cyber-red/30 p-2 rounded">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-cyber-cyan text-black font-bold p-3 hover:bg-white hover:text-black border border-cyber-cyan hover:shadow-neon-cyan-intense transition duration-200 rounded"
            >
              ESTABLISH DECRYPTED CONNECTION
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-cyber-bg/95 backdrop-blur-md flex flex-col z-50 overflow-y-auto p-4 md:p-8 font-mono">
      <div className="w-full max-w-7xl mx-auto space-y-6 flex-1 flex flex-col">
        {/* Admin Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-cyber-cyan/30 pb-4 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-cyber-cyan" />
            <div>
              <h1 className="text-2xl font-bold text-cyber-cyan tracking-widest">SYS_ADMIN OVERWATCH</h1>
              <p className="text-xs text-cyber-gray">SECURE DECRYPTED WEB CHANNEL</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleResetGame}
              disabled={isResetting}
              className="flex items-center space-x-2 bg-cyber-red-dark/30 border border-cyber-red text-cyber-red hover:bg-cyber-red hover:text-black transition px-4 py-2 rounded text-sm shadow-neon-red disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{isResetting ? 'PURGING LOGS...' : 'HARD RESET SYSTEM'}</span>
            </button>
            <button
              onClick={onClose}
              className="flex items-center space-x-2 bg-cyber-cyan-dark border border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan hover:text-black transition px-4 py-2 rounded text-sm shadow-neon-cyan"
            >
              <X className="w-4 h-4" />
              <span>CLOSE VIEW</span>
            </button>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-cyber-card border border-cyber-cyan/30 p-5 rounded relative overflow-hidden shadow-neon-cyan">
            <div className="absolute right-4 top-4 text-cyber-cyan/10">
              <Users className="w-16 h-16" />
            </div>
            <p className="text-xs text-cyber-gray uppercase">Total Active Operators</p>
            <h3 className="text-3xl font-bold text-cyber-cyan mt-1">{stats.totalPlayers}</h3>
            <p className="text-[10px] text-cyber-cyan/50 mt-1 flex items-center">
              <Radio className="w-3 h-3 mr-1 animate-pulse" /> Live connection feed
            </p>
          </div>

          <div className="bg-cyber-card border border-cyber-cyan/30 p-5 rounded relative overflow-hidden shadow-neon-cyan">
            <div className="absolute right-4 top-4 text-cyber-cyan/10">
              <Trophy className="w-16 h-16" />
            </div>
            <p className="text-xs text-cyber-gray uppercase">Active Teams</p>
            <h3 className="text-3xl font-bold text-cyber-cyan mt-1">{stats.activeTeams}</h3>
            <p className="text-[10px] text-cyber-gray mt-1">Max 3 Operators per team</p>
          </div>

          <div className="bg-cyber-card border border-cyber-cyan/30 p-5 rounded relative overflow-hidden shadow-neon-cyan">
            <div className="absolute right-4 top-4 text-cyber-cyan/10">
              <Clock className="w-16 h-16" />
            </div>
            <p className="text-xs text-cyber-gray uppercase">Solved rate</p>
            <h3 className="text-3xl font-bold text-cyber-cyan mt-1">
              {stats.teams.length > 0
                ? `${Math.round((stats.teams.filter(t => t.completed).length / stats.teams.length) * 100)}%`
                : '0%'
              }
            </h3>
            <p className="text-[10px] text-cyber-gray mt-1">
              Finished: {stats.teams.filter(t => t.completed).length} / Total: {stats.teams.length}
            </p>
          </div>
        </div>

        {/* Live Leaderboard */}
        <div className="bg-cyber-card border border-cyber-cyan/30 p-6 rounded flex-1 flex flex-col shadow-neon-cyan min-h-[400px]">
          <div className="flex items-center space-x-2 mb-4 border-b border-cyber-cyan/20 pb-2">
            <Trophy className="w-5 h-5 text-cyber-cyan" />
            <h2 className="text-lg font-bold text-cyber-cyan uppercase tracking-wider">Live System Leaderboard</h2>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cyber-cyan/30 text-cyber-cyan text-xs font-bold bg-cyber-cyan-dark/20 uppercase">
                  <th className="py-3 px-4 w-16">Rank</th>
                  <th className="py-3 px-4">Node Team Name</th>
                  <th className="py-3 px-4 w-28">Type</th>
                  <th className="py-3 px-4 w-24">Room Code</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4 w-24 text-center">Score</th>
                  <th className="py-3 px-4 w-28 text-center">Cur Level</th>
                  <th className="py-3 px-4 w-32 text-center">Elapsed Time</th>
                  <th className="py-3 px-4 w-28 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-cyan/10 text-sm">
                {sortedTeams.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-cyber-gray text-xs">
                      NO ACTIVE DECRYPTING SESSIONS FOUND.
                    </td>
                  </tr>
                ) : (
                  sortedTeams.map((team, idx) => (
                    <tr
                      key={team.code}
                      className={`hover:bg-cyber-cyan-dark/10 transition duration-150 ${
                        team.completed ? 'bg-cyber-cyan-dark/5 text-cyber-cyan' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-cyber-cyan">#{idx + 1}</td>
                      <td className="py-3 px-4 font-bold">{team.name}</td>
                      <td className="py-3 px-4 text-xs">
                        <span className={`px-2 py-0.5 rounded border text-[10px] ${
                          team.isSolo 
                            ? 'border-cyber-blue/50 text-cyber-blue bg-cyber-blue/10' 
                            : 'border-cyber-cyan/50 text-cyber-cyan bg-cyber-cyan/10'
                        }`}>
                          {team.isSolo ? 'SOLO' : 'TEAM'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-cyber-gray text-xs">{team.isSolo ? '-' : team.code}</td>
                      <td className="py-3 px-4 text-xs text-cyber-gray">
                        {team.members.length > 0 ? team.members.join(', ') : 'No operators'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-cyber-cyan">
                        {team.score} pts
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">
                        {team.completed ? 'COMPLETED' : `Level ${team.level}`}
                      </td>
                      <td className="py-3 px-4 text-center text-cyber-gray font-mono">
                        {formatTime(team.elapsed)}
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        {team.completed ? (
                          <span className="text-cyber-green border border-cyber-green px-2 py-0.5 bg-cyber-green/10 font-bold rounded animate-pulse">
                            SOLVED
                          </span>
                        ) : (
                          <span className="text-cyber-amber border border-cyber-amber px-2 py-0.5 bg-cyber-amber/10 rounded">
                            ACTIVE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
