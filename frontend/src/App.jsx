import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TermIcon, Folder, Volume2, VolumeX, Trophy, Users, LogOut,
  Compass, Activity, Clock, Award, Shield, Network, ShieldAlert
} from 'lucide-react';
import { sound } from './utils/sound';
import AdminPortal from './components/AdminPortal';
import LoginScreen from './components/LoginScreen';
import LobbyScreen from './components/LobbyScreen';
import SquadPanel from './components/SquadPanel';
import FileExplorerPanel from './components/FileExplorerPanel';
import MissionProgressPanel from './components/MissionProgressPanel';
import TerminalPanel from './components/TerminalPanel';
import SuccessScreen from './components/SuccessScreen';
import { io } from 'socket.io-client';


// The backend can read this from the 'player-id' header to track sessions and about it.
let playerId = sessionStorage.getItem('player_id');
if (!playerId) {
  playerId = 'usr_' + Math.random().toString(36).substring(2, 11);
  sessionStorage.setItem('player_id', playerId);
}

export default function App() {
  // Navigation Screens: 'login' | 'lobby' | 'game'
  // Parse path routes: /login, /lobby, /game, /success, /admin to view all pages
  const path = window.location.pathname.toLowerCase();

  const [screen, setScreen] = useState(() => {
    if (path.includes('/lobby')) return 'lobby';
    if (path.includes('/game') || path.includes('/success')) return 'game';
    return 'login';
  });
  const [playerName, setPlayerName] = useState(() => {
    if (path.includes('/lobby') || path.includes('/game') || path.includes('/success')) return 'NeoCoder';
    return '';
  });
  const [teamName, setTeamName] = useState('');
  const [teamCodeInput, setTeamCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Game States
  const [team, setTeam] = useState(() => {
    if (path.includes('/game') || path.includes('/success')) {
      return {
        name: "ALPHA_SQUAD",
        code: "884920",
        members: [
          { id: playerId, name: "NeoCoder" },
          { id: "usr_2", name: "Operator_02" }
        ],
        isSolo: false
      };
    }
    return null;
  });
  const [levelData, setLevelData] = useState(() => {
    if (path.includes('/game') || path.includes('/success')) {
      return {
        level: 1,
        score: 0,
        completed: path.includes('/success'),
        startTime: Date.now() - 320000,
        finalTime: path.includes('/success') ? 320000 : null,
        levelName: "Level 1: The Breach",
        virtualFiles: {
          "README.txt": "Welcome Operative. Find the file containing the access key and read it using 'cat <filename>'.",
          "clue_1.sys": "ACCESS AUTH CODE: [CYBER_BREACH_2026]",
          "logs": {
            "auth.log": "TIMESTAMP: 1718090000 - Secure shell session opened for node USER_ADMIN."
          }
        }
      };
    }
    return null;
  });
  const [currentPath, setCurrentPath] = useState('/');
  
  // Terminal Logs
  const [terminalOutput, setTerminalOutput] = useState([
    { type: 'system', text: "CYBER_DECRYPT_MAIN v4.0.96 initialized." },
    { type: 'system', text: "Type 'help' to fetch system commands." }
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // UI Helpers
  const [soundMuted, setSoundMuted] = useState(false);
  const [showAdmin, setShowAdmin] = useState(() => path.includes('/admin'));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Mobile Tab State: 'squad' | 'files' | 'levels' | 'terminal'
  const [activeTab, setActiveTab] = useState('terminal');

  // Real-time solved animation splash
  const [solvedOverlay, setSolvedOverlay] = useState(null); // { level, solvedBy } or null
  const [completedState, setCompletedState] = useState(() => {
    if (path.includes('/success')) {
      return { finalTime: 320000, solvedBy: "NeoCoder" };
    }
    return null;
  });

  const terminalEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io({ autoConnect: false });

    socketRef.current.on('ref_init', (data) => {
      if(!localStorage.getItem('ref')) {localStorage.setItem('ref', data.ref);}
      socketRef.current.emit('ref_sync', { ref: data.ref });
    });

    socketRef.current.on('connect_error', (err) => {
      console.warn('Socket connection error:', err);
    });

    socketRef.current.connect();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // 1. Keep scrolling terminal to the bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalOutput]);

  // 2. Stopwatch Interval running in game
  useEffect(() => {
    if (!levelData || levelData.completed || completedState) return;

    const interval = setInterval(() => {
      const ms = Date.now() - levelData.startTime;
      setElapsedSeconds(Math.floor(ms / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [levelData, completedState]);

  // Helper: Reset session states on logout or server-requested reset
  const handleSessionReset = () => {
    sound.playError();
    setScreen('login');
    setTeam(null);
    setLevelData(null);
    setCompletedState(null);
    setSolvedOverlay(null);
    setTerminalOutput([
      { type: 'system', text: "SYS_ADMIN issued a hard reset or session expired." }
    ]);
  };

  // 3. Status Polling Sync Loop
  // Replaces the Socket.io real-time listeners for updates
  const pollStatus = async () => {
    if (path.includes('/lobby') || path.includes('/game') || path.includes('/success') || path.includes('/admin')) return;
    if (screen === 'login') return;

    try {
      const response = await fetch('/api/team/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': playerId
        }
      });

      if (response.status === 401 || response.status === 404) {
        handleSessionReset();
        alert("The game has been reset by the Admin or session expired.");
        return;
      }

      if (!response.ok) return;

      const data = await response.json();
      
      if (data.team) {
        setTeam(data.team);
      }

      if (data.levelData) {
        const currentLevel = levelData?.level;
        const newLevel = data.levelData.level;

        if (currentLevel && newLevel > currentLevel) {
          sound.playLevelUp();
          setSolvedOverlay({ level: currentLevel, solvedBy: data.levelData.solvedBy || "TEAM OPERATIVE" });
          setCurrentPath('/'); // reset path
          
          setLevelData({
            level: newLevel,
            score: data.levelData.score,
            virtualFiles: data.levelData.virtualFiles,
            levelName: data.levelData.levelName,
            startTime: data.levelData.startTime,
            completed: data.levelData.completed
          });

          setTerminalOutput(prev => [
            ...prev,
            { type: 'success', text: `========================================================` },
            { type: 'success', text: `[ALERT] LEVEL ${currentLevel} DECRYPTED SUCCESSFULLY BY ${(data.levelData.solvedBy || "TEAM").toUpperCase()}!` },
            { type: 'success', text: `UPLINK RE-ESTABLISHED. SYNCING NODE TO LEVEL ${newLevel}...` },
            { type: 'success', text: `========================================================` },
            { type: 'system', text: "Use 'ls' to scan files. Type 'hint' if you get stuck." }
          ]);

          setTimeout(() => {
            setSolvedOverlay(null);
          }, 4000);
        } else if (!currentLevel || levelData.score !== data.levelData.score || levelData.completed !== data.levelData.completed) {
          setLevelData(data.levelData);
        }
      }

      if (data.completed && !completedState) {
        sound.playSuccess();
        setCompletedState({ 
          finalTime: data.finalTime, 
          solvedBy: data.solvedBy || "SYSTEM RECOVERY" 
        });

        setLevelData(prev => ({
          ...prev,
          score: data.score || prev.score,
          completed: true,
          finalTime: data.finalTime
        }));

        setTerminalOutput(prev => [
          ...prev,
          { type: 'success', text: `========================================================` },
          { type: 'success', text: `[CRITICAL ALERT] SYSTEM DECRYPTED SUCCESSFULLY!` },
          { type: 'success', text: `MAINFRAME COMPLETELY CONTROLLED BY THE TEAM.` },
          { type: 'success', text: `SOLVED BY: ${(data.solvedBy || "SYSTEM").toUpperCase()}` },
          { type: 'success', text: `========================================================` }
        ]);
      }

      if (data.reset) {
        handleSessionReset();
        alert("The game has been reset by the Admin. You have been returned to the login screen.");
      }

    } catch (e) {
      console.warn("Uplink sync issue: ", e.message);
    }
  };

  useEffect(() => {
    if (screen === 'login') return;

    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [screen, levelData, completedState]);

  // Format seconds to stopwatch readable format
  const formatStopwatch = (totalSecs) => {
    if (!totalSecs || isNaN(totalSecs)) return "00:00";
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  };

  // Helper: Retrieve items at the current visual path
  const getContentsAtPath = () => {
    if (!levelData || !levelData.virtualFiles) return {};
    if (currentPath === '/' || currentPath === '') return levelData.virtualFiles;
    
    const parts = currentPath.split('/').filter(Boolean);
    let curr = levelData.virtualFiles;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = curr[part];
      } else {
        return {};
      }
    }
    return typeof curr === 'object' ? curr : {};
  };

  // Handle click on directory or file in visual browser
  const handleVisualClick = (name, isDir) => {
    sound.playClick();
    if (isDir) {
      const nextPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      setCurrentPath(nextPath);
      setTerminalOutput(prev => [
        ...prev,
        { type: 'input', text: `cd ${name}` }
      ]);
    } else {
      setTerminalOutput(prev => [
        ...prev,
        { type: 'input', text: `cat ${name}` }
      ]);
      const contents = getContentsAtPath();
      const fileText = contents[name];
      setTerminalOutput(prev => [
        ...prev,
        { type: 'output', text: fileText || "" }
      ]);
    }
  };

  const handleVisualBack = () => {
    sound.playClick();
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const nextPath = '/' + parts.join('/');
    setCurrentPath(nextPath);
    setTerminalOutput(prev => [
      ...prev,
      { type: 'input', text: `cd ..` }
    ]);
  };

  // Terminal Execution Parser
  const runTerminalCommand = (rawCmd) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    // Save in command history
    setHistory(prev => [cmd, ...prev.filter(c => c !== cmd)].slice(0, 50));
    setHistoryIdx(-1);

    // Add to terminal line
    setTerminalOutput(prev => [...prev, { type: 'input', text: cmd }]);

    const tokens = cmd.split(/\s+/);
    const baseCmd = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    switch (baseCmd) {
      case 'help':
        setTerminalOutput(prev => [
          ...prev,
          { type: 'output', text: "AVAILABLE UTILITIES:" },
          { type: 'output', text: "  ls [-a]         List directories and files in current folder" },
          { type: 'output', text: "  cd <dir>        Navigate to folder (e.g., 'cd system' or 'cd ..')" },
          { type: 'output', text: "  cat <file>      Read file content (e.g., 'cat README.txt')" },
          { type: 'output', text: "  decode <str>    Base64 decryption engine (e.g. level 4)" },
          { type: 'output', text: "  hint            Query decryption intelligence (uses 0 pts)" },
          { type: 'output', text: "  submit <key>    Submit passcode key (e.g., 'submit CORE_PASS')" },
          { type: 'output', text: "  clear           Purge command console history log" }
        ]);
        break;

      case 'clear':
        setTerminalOutput([]);
        break;

      case 'hint':
        fetch('/api/get_hint', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-player-id': playerId
          }
        })
        .then(res => res.json())
        .then(res => {
          if (res.success) {
            setTerminalOutput(prev => [
              ...prev,
              { type: 'system', text: `[INTELLIGENCE HINT]: ${res.hint}` }
            ]);
          } else {
            setTerminalOutput(prev => [
              ...prev,
              { type: 'error', text: `Hint query error: ${res.error}` }
            ]);
          }
        })
        .catch(err => {
          setTerminalOutput(prev => [
            ...prev,
            { type: 'error', text: `Network error: Cannot reach intelligence server.` }
          ]);
        });
        break;

      case 'ls': {
        const showAll = args.includes('-a');
        const contents = getContentsAtPath();
        const items = Object.keys(contents);
        
        if (items.length === 0) {
          setTerminalOutput(prev => [...prev, { type: 'output', text: '(directory empty)' }]);
        } else {
          // Format list
          const outputs = items
            .filter(name => showAll || !name.startsWith('.'))
            .map(name => {
              const isDir = typeof contents[name] === 'object';
              return isDir ? `[DIR]  /${name}` : `[FILE] ${name}`;
            });
          
          if (outputs.length === 0 && !showAll && items.some(n => n.startsWith('.'))) {
            setTerminalOutput(prev => [...prev, { type: 'output', text: 'This folder contains hidden elements. Use "ls -a".' }]);
          } else {
            outputs.forEach(txt => {
              setTerminalOutput(prev => [...prev, { type: 'output', text: txt }]);
            });
          }
        }
        break;
      }

      case 'cd': {
        const target = args[0];
        if (!target) {
          setCurrentPath('/');
          break;
        }

        if (target === '..') {
          if (currentPath === '/') {
            setTerminalOutput(prev => [...prev, { type: 'output', text: 'Already in root directory.' }]);
          } else {
            const parts = currentPath.split('/').filter(Boolean);
            parts.pop();
            setCurrentPath('/' + parts.join('/'));
          }
        } else if (target === '/' || target === '~') {
          setCurrentPath('/');
        } else {
          const contents = getContentsAtPath();
          if (target in contents) {
            if (typeof contents[target] === 'object') {
              const nextPath = currentPath === '/' ? `/${target}` : `${currentPath}/${target}`;
              setCurrentPath(nextPath);
            } else {
              setTerminalOutput(prev => [...prev, { type: 'error', text: `cd: not a directory: ${target}` }]);
            }
          } else {
            setTerminalOutput(prev => [...prev, { type: 'error', text: `cd: no such directory: ${target}` }]);
          }
        }
        break;
      }

      case 'cat': {
        const file = args[0];
        if (!file) {
          setTerminalOutput(prev => [...prev, { type: 'error', text: 'cat: missing filename. usage: cat <file>' }]);
          break;
        }

        const contents = getContentsAtPath();
        if (file in contents) {
          if (typeof contents[file] === 'object') {
            setTerminalOutput(prev => [...prev, { type: 'error', text: `cat: ${file}: Is a directory` }]);
          } else {
            setTerminalOutput(prev => [...prev, { type: 'output', text: contents[file] }]);
          }
        } else {
          setTerminalOutput(prev => [...prev, { type: 'error', text: `cat: ${file}: No such file` }]);
        }
        break;
      }

      case 'decode': {
        const b64 = args[0];
        if (!b64) {
          setTerminalOutput(prev => [...prev, { type: 'error', text: 'decode: missing string. usage: decode <base64_string>' }]);
          break;
        }
        try {
          const decoded = atob(b64.trim());
          setTerminalOutput(prev => [
            ...prev,
            { type: 'output', text: `[DECRYPTION MODULE SUCCESS]` },
            { type: 'output', text: `DECODED STRING: ${decoded}` }
          ]);
        } catch (e) {
          setTerminalOutput(prev => [...prev, { type: 'error', text: 'Decoder error: Invalid base64 characters.' }]);
        }
        break;
      }

      case 'submit': {
        const ans = args.join(' ');
        if (!ans) {
          setTerminalOutput(prev => [...prev, { type: 'error', text: 'submit: missing key. usage: submit <key_phrase>' }]);
          break;
        }
        submitDecryptionKey(ans);
        break;
      }

      case 'test_clear': {
        sound.playLevelUp();
        setSolvedOverlay({ level: levelData.level, solvedBy: playerName || "TESTER" });
        setCurrentPath('/');
        
        setLevelData(prev => {
          const nextLevel = prev.level < 5 ? prev.level + 1 : prev.level;
          return {
            ...prev,
            level: nextLevel,
            score: prev.score + 1
          };
        });

        setTerminalOutput(prev => [
          ...prev,
          { type: 'success', text: `========================================================` },
          { type: 'success', text: `[ALERT] LEVEL ${levelData.level} DECRYPTED SUCCESSFULLY BY ${playerName.toUpperCase()}!` },
          { type: 'success', text: `UPLINK RE-ESTABLISHED. SYNCING NODE TO LEVEL ${levelData.level + 1}...` },
          { type: 'success', text: `========================================================` },
          { type: 'system', text: "Use 'ls' to scan files. Type 'hint' if you get stuck." }
        ]);

        setTimeout(() => {
          setSolvedOverlay(null);
        }, 4000);
        break;
      }

      default:
        setTerminalOutput(prev => [
          ...prev,
          { type: 'error', text: `Command not recognized: '${baseCmd}'. Type 'help' for support.` }
        ]);
        break;
    }
  };

  // Submit Answer Action
  const submitDecryptionKey = (ans) => {
    fetch('/api/submit_answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-player-id': playerId
      },
      body: JSON.stringify({ answer: ans })
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        if (res.correct) {
          pollStatus(); // sync state immediately
        } else {
          sound.playError();
          setTerminalOutput(prev => [
            ...prev,
            { type: 'error', text: `[DECRYPTION DENIED]: ${res.error}` }
          ]);
        }
      } else {
        sound.playError();
        setTerminalOutput(prev => [
          ...prev,
          { type: 'error', text: `Server error: ${res.error}` }
        ]);
      }
    })
    .catch(err => {
      sound.playError();
      setTerminalOutput(prev => [
        ...prev,
        { type: 'error', text: `Network error: Cannot reach mainframe server.` }
      ]);
    });
  };

  // Key Down listeners for Command History (Up/Down arrows)
  const handleTerminalKeyDown = (e) => {
    if (e.key === 'Enter') {
      sound.playClick();
      runTerminalCommand(terminalInput);
      setTerminalInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIdx + 1;
        if (nextIdx < history.length) {
          setHistoryIdx(nextIdx);
          setTerminalInput(history[nextIdx]);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = historyIdx - 1;
      if (nextIdx >= 0) {
        setHistoryIdx(nextIdx);
        setTerminalInput(history[nextIdx]);
      } else {
        setHistoryIdx(-1);
        setTerminalInput('');
      }
    }
  };

  // Toggle Sounds
  const toggleMute = () => {
    const isMuted = sound.toggleMute();
    setSoundMuted(isMuted);
  };

  const startAudioEngine = () => {
    sound.init();
    sound.startAmbient();
  };

  // 1. Login Logic
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    startAudioEngine();
    sound.playClick();

    const socket = socketRef.current;
    if (!socket) {
      sound.playError();
      setErrorMsg('Socket connection is not initialized.');
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('name-set', {
      ref: localStorage.getItem('ref'),
      name: playerName,
    });

    setScreen('lobby');
    setErrorMsg('');
  };

  // 2. Create Team Lobby
  const handleCreateTeamSubmit = (e) => {
    e.preventDefault();
    sound.playClick();

    const socket = socketRef.current;
    if (!socket) {
      sound.playError();
      setErrorMsg('Socket connection is not initialized.');
      return;
    }

    socket.emit('create_team', { group: teamName, ref: localStorage.getItem('ref') }, (res) => {
      if (res?.success) {
        setTeam(res.team);
        initializeGame();
      } else {
        sound.playError();
        setErrorMsg(res?.error || 'Cannot establish team host.');
      }
    });
  };

  // 3. Join Team Lobby
  const handleJoinTeamSubmit = (e) => {
    e.preventDefault();
    sound.playClick();

    const socket = socketRef.current;
    if (!socket) {
      sound.playError();
      setErrorMsg('Socket connection is not initialized.');
      return;
    }

    socket.emit('join_team', { group: teamCodeInput, ref: localStorage.getItem('ref') }, (res) => {
      if (res?.success) {
        setTeam(res.team);
        initializeGame();
      } else {
        sound.playError();
        setErrorMsg(res?.error || 'Cannot join selected team.');
      }
    });
  };

  // 4. Solo Player Selection
  const handleContinueSolo = () => {
    sound.playClick();

    fetch('/api/continue_solo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-player-id': playerId
      }
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        setTeam(res.team);
        initializeGame();
      } else {
        sound.playError();
        setErrorMsg(res.error);
      }
    })
    .catch(err => {
      sound.playError();
      setErrorMsg('Solo configuration override failed.');
    });
  };

  const initializeGame = () => {
    fetch('/api/get_level_data', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-player-id': playerId
      }
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        setLevelData(res);
        setScreen('game');
        setErrorMsg('');
        
        if (res.completed) {
          setCompletedState({ finalTime: res.finalTime, solvedBy: "SYSTEM RECOVERY" });
        }
      }
    })
    .catch(err => {
      console.error("Game data load error: ", err);
    });
  };

  const handleDisconnect = () => {
    sound.playClick();
    
    fetch('/api/disconnect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-player-id': playerId
      }
    })
    .finally(() => {
      window.location.reload();
    });
  };

  return (
    <div className="flex-1 flex flex-col relative w-full h-full pb-20 lg:pb-0">
      {/* Sound & Admin Control Header */}
      <div className="absolute top-4 right-4 z-40 flex items-center space-x-2">
        <button
          onClick={toggleMute}
          className="p-2 border border-cyber-cyan/30 bg-cyber-card text-cyber-cyan hover:bg-cyber-cyan hover:text-black transition rounded shadow-neon-cyan"
          title="Toggle Synth Soundscape"
        >
          {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-pulse" />}
        </button>
        <button
          onClick={() => { sound.playClick(); setShowAdmin(true); }}
          className="px-3 py-1.5 border border-cyber-cyan/30 bg-cyber-card text-cyber-cyan hover:bg-cyber-cyan hover:text-black font-mono text-[10px] font-semibold tracking-wider transition rounded shadow-neon-cyan"
        >
          SYS_ADMIN
        </button>
      </div>

      {/* Admin Portal Overlay */}
      {showAdmin && (
        <AdminPortal
          playerId={playerId}
          onClose={() => { sound.playClick(); setShowAdmin(false); }}
        />
      )}

      {/* Level Solve Interstitial Screen Overlay */}
      {solvedOverlay && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center font-mono border-4 border-cyber-cyan/50 p-4 animate-pulse">
          <div className="matrix-bg absolute inset-0 opacity-10"></div>
          <div className="relative text-center space-y-6">
            <div className="inline-flex p-4 bg-cyber-cyan-dark border-2 border-cyber-cyan rounded-full shadow-neon-cyan-intense mb-2">
              <Award className="w-16 h-16 text-cyber-cyan" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-cyber-cyan tracking-widest uppercase drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]">
              LEVEL {solvedOverlay.level} SOLVED
            </h1>
            <p className="text-cyber-gray text-lg md:text-xl uppercase tracking-wider">
              Uplink unlocked by: <span className="text-white font-bold">{solvedOverlay.solvedBy}</span>
            </p>
            <div className="flex items-center justify-center space-x-2 text-cyber-cyan animate-bounce text-sm">
              <Compass className="w-5 h-5 animate-spin" />
              <span>SYNCING DECIPHER CODES FOR THE ENTIRE SQUAD...</span>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 1: LOGIN PAGE */}
      {screen === 'login' && (
        <LoginScreen
          playerName={playerName}
          setPlayerName={setPlayerName}
          errorMsg={errorMsg}
          handleLoginSubmit={handleLoginSubmit}
        />
      )}

      {/* SCREEN 2: TEAM LOBBY SELECT */}
      {screen === 'lobby' && (
        <LobbyScreen
          playerName={playerName}
          teamName={teamName}
          setTeamName={setTeamName}
          teamCodeInput={teamCodeInput}
          setTeamCodeInput={setTeamCodeInput}
          errorMsg={errorMsg}
          handleCreateTeamSubmit={handleCreateTeamSubmit}
          handleJoinTeamSubmit={handleJoinTeamSubmit}
          handleContinueSolo={handleContinueSolo}
          handleDisconnect={handleDisconnect}
        />
      )}

      {/* SCREEN 3: MAIN GAME DASHBOARD */}
      {screen === 'game' && levelData && team && (
        <div className="flex-1 flex flex-col p-3 md:p-6 space-y-4 max-w-7xl mx-auto w-full">
          {/* Main Top Stats Bar */}
          <div className="bg-cyber-card border border-cyber-cyan/25 rounded p-4 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 shadow-neon-cyan font-mono">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-cyber-cyan-dark border border-cyber-cyan/40 rounded">
                <Activity className="w-5 h-5 text-cyber-cyan animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-cyber-gray">COLLABORATIVE SERVER NODES</p>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-cyber-cyan">{team.name}</span>
                  {!team.isSolo && (
                    <span className="text-[10px] border border-cyber-cyan/30 px-1.5 py-0.5 rounded text-cyber-gray">
                      CODE: {team.code}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Level Description */}
            <div className="text-left md:text-center">
              <p className="text-[10px] text-cyber-gray uppercase">UPLINK SECTOR</p>
              <h2 className="text-md font-bold text-cyber-cyan">{levelData.levelName}</h2>
            </div>

            {/* Right side stats: Points & Stopwatch */}
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-[10px] text-cyber-gray flex items-center justify-end">
                  <Award className="w-3.5 h-3.5 mr-1 text-cyber-cyan" /> SCORE
                </p>
                <h3 className="text-xl font-bold text-cyber-cyan">{levelData.score} pts</h3>
              </div>

              <div className="text-right border-l border-cyber-cyan/20 pl-6">
                <p className="text-[10px] text-cyber-gray flex items-center justify-end">
                  <Clock className="w-3.5 h-3.5 mr-1 text-cyber-cyan" /> ELAPSED TIME
                </p>
                <h3 className="text-xl font-bold text-cyber-cyan">
                  {levelData.completed 
                    ? formatStopwatch(Math.floor(levelData.finalTime / 1000)) 
                    : formatStopwatch(elapsedSeconds)
                  }
                </h3>
              </div>

              <button
                onClick={handleDisconnect}
                className="p-2 bg-cyber-red-dark/35 hover:bg-cyber-red hover:text-black border border-cyber-red text-cyber-red hover:shadow-neon-red transition duration-150 rounded"
                title="Disconnect from Lobby"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="bg-cyber-card border border-cyber-cyan/20 rounded p-4 grid grid-cols-3 text-center text-[10px] font-mono shadow-neon-cyan select-none">
            <div className="flex flex-col items-center justify-center space-y-1">
              <Shield className="w-5 h-5 text-cyber-cyan animate-pulse" />
              <span className="text-cyber-gray uppercase tracking-wider">Connection</span>
              <span className="text-cyber-cyan font-bold">ENCRYPTED</span>
            </div>
            <div className="flex flex-col items-center justify-center space-y-1 border-x border-cyber-border">
              <Network className="w-5 h-5 text-cyber-cyan" />
              <span className="text-cyber-gray uppercase tracking-wider">Link Status</span>
              <span className="text-cyber-green font-bold">ACTIVE</span>
            </div>
            <div className="flex flex-col items-center justify-center space-y-1">
              <TermIcon className="w-5 h-5 text-cyber-cyan" />
              <span className="text-cyber-gray uppercase tracking-wider">Uplink</span>
              <span className="text-cyber-green font-bold">STABLE</span>
            </div>
          </div>

          {/* Core Game Dashboard Layout Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono">
            <SquadPanel
              team={team}
              playerId={playerId}
              activeTab={activeTab}
            />
            <FileExplorerPanel
              currentPath={currentPath}
              getContentsAtPath={getContentsAtPath}
              handleVisualBack={handleVisualBack}
              handleVisualClick={handleVisualClick}
              activeTab={activeTab}
            />
            <MissionProgressPanel
              levelData={levelData}
              activeTab={activeTab}
            />
            <TerminalPanel
              terminalOutput={terminalOutput}
              terminalInput={terminalInput}
              setTerminalInput={setTerminalInput}
              handleTerminalKeyDown={handleTerminalKeyDown}
              currentPath={currentPath}
              playerName={playerName}
              activeTab={activeTab}
              terminalEndRef={terminalEndRef}
            />
          </div>

          {/* Answer Submit Panel - Visible beneath panels for easy GUI entry */}
          <div className="bg-cyber-card border border-cyber-cyan/25 rounded p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-neon-cyan">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-cyber-amber animate-pulse" />
              <div className="font-mono text-xs">
                <p className="text-cyber-gray uppercase">CRYPTO OVERRIDE TRANSMITTER</p>
                <p className="text-cyber-cyan font-bold">TYPE 'hint' IN TERMINAL IF YOU ARE STUCK</p>
              </div>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sound.playClick();
                const codeElement = e.target.elements.decryptionCode;
                submitDecryptionKey(codeElement.value);
                codeElement.value = '';
              }}
              className="w-full md:w-auto flex items-center space-x-2 font-mono"
            >
              <input
                type="text"
                name="decryptionCode"
                placeholder="ENTER DECRYPTION KEY HERE..."
                className="bg-cyber-bg border border-cyber-cyan/50 focus:border-cyber-cyan p-2.5 text-xs outline-none text-cyber-cyan text-center placeholder-cyber-cyan/20 rounded w-full md:w-72 tracking-wider"
              />
              <button
                type="submit"
                className="bg-cyber-cyan text-black font-bold text-xs px-5 py-2.5 hover:bg-white rounded transition shadow-neon-cyan border border-cyber-cyan"
              >
                SUBMIT
              </button>
            </form>
          </div>

          {/* Full Screen Game Completed Success Screen */}
          {completedState && (
            <SuccessScreen
              completedState={completedState}
              team={team}
              levelData={levelData}
              formatStopwatch={formatStopwatch}
              handleDisconnect={handleDisconnect}
            />
          )}

          {/* MOBILE NAVIGATION BAR */}
          <div className="fixed bottom-0 left-0 w-full bg-cyber-card border-t border-cyber-border z-40 flex lg:hidden items-center justify-around h-16 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] font-mono text-[9px] uppercase tracking-wider">
            {/* Squad Tab */}
            <button
              onClick={() => { sound.playClick(); setActiveTab('squad'); }}
              className={`flex-1 flex flex-col items-center justify-center h-full transition duration-150 border-t-2 ${
                activeTab === 'squad'
                  ? 'border-cyber-green text-cyber-green bg-cyber-green/5'
                  : 'border-transparent text-cyber-gray hover:text-cyber-green'
              }`}
            >
              <Users className="w-5 h-5 mb-1" />
              <span>SQUAD</span>
            </button>

            {/* Files Tab */}
            <button
              onClick={() => { sound.playClick(); setActiveTab('files'); }}
              className={`flex-1 flex flex-col items-center justify-center h-full transition duration-150 border-t-2 ${
                activeTab === 'files'
                  ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5 animate-pulse'
                  : 'border-transparent text-cyber-gray hover:text-cyber-cyan'
              }`}
            >
              <Folder className="w-5 h-5 mb-1" />
              <span>FILES</span>
            </button>

            {/* Levels Tab */}
            <button
              onClick={() => { sound.playClick(); setActiveTab('levels'); }}
              className={`flex-1 flex flex-col items-center justify-center h-full transition duration-150 border-t-2 ${
                activeTab === 'levels'
                  ? 'border-cyber-magenta text-cyber-magenta bg-cyber-magenta/5'
                  : 'border-transparent text-cyber-gray hover:text-cyber-magenta'
              }`}
            >
              <Trophy className="w-5 h-5 mb-1" />
              <span>LEVELS</span>
            </button>

            {/* Terminal Tab */}
            <button
              onClick={() => { sound.playClick(); setActiveTab('terminal'); }}
              className={`flex-1 flex flex-col items-center justify-center h-full transition duration-150 border-t-2 ${
                activeTab === 'terminal'
                  ? 'border-cyber-red text-cyber-red bg-cyber-red/5'
                  : 'border-transparent text-cyber-gray hover:text-cyber-red'
              }`}
            >
              <TermIcon className="w-5 h-5 mb-1" />
              <span>TERMINAL</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
