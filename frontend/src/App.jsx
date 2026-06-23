import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TermIcon, Folder, Volume2, VolumeX, Trophy, Users, LogOut,
  Compass, Activity, Clock, Award, Shield, Network, ShieldAlert
} from 'lucide-react';
import { sound } from './utils/sound';
// AdminPortal removed
import LoginScreen from './components/LoginScreen';
import LobbyScreen from './components/LobbyScreen';
import SquadPanel from './components/SquadPanel';
import FileExplorerPanel from './components/FileExplorerPanel';
import MissionProgressPanel from './components/MissionProgressPanel';
import TerminalPanel from './components/TerminalPanel';
import SuccessScreen from './components/SuccessScreen';
import Leaderboard from './components/Leaderboard';
import { io } from 'socket.io-client';


// The backend can read this from the 'player-id' header to track sessions and about it.
let playerId = sessionStorage.getItem('player_id');
if (!playerId) {
  playerId = 'usr_' + Math.random().toString(36).substring(2, 11);
  sessionStorage.setItem('player_id', playerId);
}

const getLevelKey = (lvl) => {
  if (typeof lvl === 'string' && ["A", "B", "C", "D", "E"].includes(lvl.toUpperCase())) {
    return lvl.toUpperCase();
  }
  const num = parseInt(String(lvl).replace(/\D/g, '')) || 1;
  const keys = ["A", "B", "C", "D", "E"];
  return keys[num - 1] || "A";
};

export default function App() {
  // Navigation Screens: 'login' | 'lobby' | 'game'
  // Parse path routes: /login, /lobby, /game, /success, /admin to view all pages
  const path = window.location.pathname.toLowerCase();

  const [screen, setScreen] = useState(() => {
    if (path.includes('/leaderboard')) return 'leaderboard';
    if (path.includes('/lobby')) return 'lobby';
    if (path.includes('/game') || path.includes('/success')) return 'game';
    return 'login';
  });
  const [playerName, setPlayerName] = useState(() => {
    if (path.includes('/lobby') || path.includes('/game') || path.includes('/success')) return 'NeoCoder';
    return '';
  });
  const [teamName, setTeamName] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');
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
  const [activeLevel, setActiveLevel] = useState(1);
  const activeLevelRef = useRef(1);
  const updateActiveLevel = (lvl) => {
    setActiveLevel(lvl);
    activeLevelRef.current = lvl;
  };
  const getLevelName = (lvl) => {
    const defaultNames = {
      1: "Level 1: The Breach",
      2: "Level 2: Hidden Channels",
      3: "Level 3: Logic Void",
      4: "Level 4: Decoder Protocol",
      5: "Level 5: Mainframe Override"
    };
    return levelData?.levelNames?.[lvl] || defaultNames[lvl] || `Level ${lvl}`;
  };
  
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
  // showAdmin state removed
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
    socketRef.current = io(import.meta.env.VITE_API_URL || '', { autoConnect: false });

    socketRef.current.on('ref_init', (data) => {
      if(!localStorage.getItem('ref')) {localStorage.setItem('ref', data.ref);}
      socketRef.current.emit('ref_sync', { ref: data.ref });  
    });

    socketRef.current.on('state_sync', (data) => {
      if (data.team) {
        setTeam(data.team);
        setScreen('game');
      }
      
      if (data.levelData) {
        setLevelData(prev => {
          if (!prev) {
            // Default activeLevel to first unsolved level
            const firstUnsolved = [1, 2, 3, 4, 5].find(l => !data.levelData.solvedLevels?.includes(l)) || 1;
            updateActiveLevel(firstUnsolved);
            return data.levelData;
          }
          
          const prevSolved = prev.solvedLevels || [];
          const newSolved = data.levelData.solvedLevels || [];
          const newlySolved = newSolved.filter(x => !prevSolved.includes(x));
          
          if (newlySolved.length > 0) {
            sound.playLevelUp();
            setSolvedOverlay({ 
              level: newlySolved[0], 
              solvedBy: data.team?.name || "THE TEAM" 
            });
            setTimeout(() => setSolvedOverlay(null), 4000);
            
            setTerminalOutput(old => [
              ...old,
              { type: 'success', text: `========================================================` },
              { type: 'success', text: `[ALERT] LEVEL ${newlySolved[0]} CRACKED SUCCESSFULLY BY A TEAMMATE!` },
              { type: 'success', text: `========================================================` }
            ]);

            // Auto-advance player terminal to next unsolved level if their current active level is solved
            if (newlySolved.includes(activeLevelRef.current)) {
              const nextUnsolved = [1, 2, 3, 4, 5].find(l => !newSolved.includes(l));
              if (nextUnsolved) {
                updateActiveLevel(nextUnsolved);
                setCurrentPath('/');
                const nextName = getLevelName(nextUnsolved);
                setTerminalOutput(old => [
                  ...old,
                  { type: 'system', text: `AUTO-SYNCING TERMINAL TO NEXT SECURED UPLINK: LEVEL ${nextUnsolved}: ${nextName}` }
                ]);
              }
            }
          }
          
          return { ...prev, ...data.levelData };
        });
      }

      const isCompletedGame = data.completed || (data.levelData?.solvedLevels?.length === 5);
      if (isCompletedGame) {
        setCompletedState(prev => {
          if (!prev) {
            sound.playSuccess();
            setTerminalOutput(old => [
              ...old,
              { type: 'success', text: `========================================================` },
              { type: 'success', text: `[CRITICAL ALERT] DECRYPTION COMPLETE! MAINFRAME OVERRIDDEN.` },
              { type: 'success', text: `========================================================` }
            ]);
          }
          return {
            finalTime: data.finalTime || (data.levelData?.startTime ? (Date.now() - data.levelData.startTime) : 0),
            solvedBy: data.team?.name || "THE TEAM"
          };
        });
      } else {
        setCompletedState(null);
      }
    });

    socketRef.current.on('session_reset', () => {
      handleSessionReset();
      alert("The game has been reset by the Admin. You have been returned to the login screen.");
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



  // 2.5. Fetch directory structure when activeLevel changes
  useEffect(() => {
    if (!team) return;

    // Fetch directory
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/directory?level=${activeLevel}`)
      .then(res => {
        if (!res.ok) throw new Error('Directory fetch failed');
        return res.json();
      })
      .then(dirData => {
        setLevelData(prev => {
          if (!prev) return prev;
          const updatedFiles = { ...(prev.virtualFiles || {}) };
          updatedFiles[activeLevel] = dirData;
          return {
            ...prev,
            virtualFiles: updatedFiles
          };
        });
      })
      .catch(err => console.error("Error loading level directory:", err));
  }, [activeLevel, team?.name]);

  // 2.6. Bulk fetch level details for all levels on startup/team name change to sync names
  useEffect(() => {
    if (!team) return;

    [1, 2, 3, 4, 5].forEach(lvl => {
      const lvlKey = getLevelKey(lvl);
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/level_details?level=${lvlKey}&group=${team.name || ''}`)
        .then(res => {
          if (!res.ok) throw new Error('Level details fetch failed');
          return res.json();
        })
        .then(detailsData => {
          setLevelData(prev => {
            if (!prev) return prev;
            const updatedNames = { ...(prev.levelNames || {}) };
            updatedNames[lvl] = detailsData.levelName;
            return {
              ...prev,
              levelNames: updatedNames
            };
          });
        })
        .catch(err => console.error(`Error loading level ${lvl} details:`, err));
    });
  }, [team?.name]);

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

  // Removed status polling loop and associated useEffect since Socket.io handles all state synchronization.

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
    const filesForLevel = levelData.virtualFiles[activeLevel] || levelData.virtualFiles;
    if (!filesForLevel) return {};
    
    if (currentPath === '/' || currentPath === '') return filesForLevel;
    
    const parts = currentPath.split('/').filter(Boolean);
    let curr = filesForLevel;
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
      const val = contents[name];
      const fileText = typeof val === 'string' ? val : (val?.content || "");
      setTerminalOutput(prev => [
        ...prev,
        { type: 'output', text: fileText }
      ]);
      if (name.toLowerCase().endsWith('.txt')) {
        setActiveTab('terminal');
      }
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

    // Helper to tokenize command string respecting single/double quotes
    const parseCommandTokens = (cmdStr) => {
      const tokens = [];
      const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^\s"']+)/g;
      let match;
      while ((match = regex.exec(cmdStr)) !== null) {
        if (match[1] !== undefined) {
          tokens.push(match[1].replace(/\\"/g, '"'));
        } else if (match[2] !== undefined) {
          tokens.push(match[2].replace(/\\'/g, "'"));
        } else if (match[3] !== undefined) {
          tokens.push(match[3]);
        }
      }
      return tokens;
    };

    const tokens = parseCommandTokens(cmd);
    if (tokens.length === 0) return;
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
          { type: 'output', text: "  grep <pattern> <file> Search text in a file (e.g. 'grep key info.txt')" },
          { type: 'output', text: "  grep -r <pattern>     Recursively search files in all folders" },
          { type: 'output', text: "  decode <str>    Base64 decryption engine (e.g. level 4)" },
          { type: 'output', text: "  submit <key>    Submit passcode key (e.g., 'submit CORE_PASS')" },
          { type: 'output', text: "  clear           Purge command console history log" }
        ]);
        break;

      case 'clear':
        setTerminalOutput([]);
        break;

      case 'grep': {
        // Syntax: grep <pattern> <filename> | grep <pattern> * | grep -r <pattern>
        let pattern = "";
        let target = "";
        let isRecursive = false;

        if (args[0] === '-r') {
          isRecursive = true;
          pattern = args[1];
        } else {
          pattern = args[0];
          target = args[1];
        }

        if (!pattern) {
          setTerminalOutput(prev => [
            ...prev,
            { type: 'error', text: 'Usage: grep <pattern> <file>  OR  grep <pattern> *  OR  grep -r <pattern>' }
          ]);
          break;
        }

        const contents = getContentsAtPath();

        // Helper to recursively search through directory nodes
        const searchNode = (node, pathStr, searchPattern) => {
          let results = [];
          if (!node || typeof node !== 'object') return results;

          for (const [name, child] of Object.entries(node)) {
            // Skip metadata keys
            if (["type", "hidden", "author", "creation", "password"].includes(name)) continue;

            if (child && typeof child === 'object') {
              if (child.type === 'dir' || !child.type) {
                // If it is a directory, search subfolders recursively
                const subResults = searchNode(child, pathStr === '/' ? `/${name}` : `${pathStr}/${name}`, searchPattern);
                results = [...results, ...subResults];
              } else {
                // If it is a file, search inside its content
                const fileContent = child.content || "";
                if (fileContent.toLowerCase().includes(searchPattern.toLowerCase())) {
                  results.push(`[${pathStr === '/' ? '' : pathStr}/${name}]: ${fileContent}`);
                }
              }
            } else if (typeof child === 'string') {
              // Text nodes
              if (child.toLowerCase().includes(searchPattern.toLowerCase())) {
                results.push(`[${pathStr === '/' ? '' : pathStr}/${name}]: ${child}`);
              }
            }
          }
          return results;
        };

        let matches = [];

        if (isRecursive) {
          matches = searchNode(contents, currentPath, pattern);
        } else if (target === '*') {
          // Search all files in current folder
          for (const [name, val] of Object.entries(contents)) {
            if (["type", "hidden", "author", "creation", "password"].includes(name)) continue;
            if (typeof val === 'string') {
              if (val.toLowerCase().includes(pattern.toLowerCase())) {
                matches.push(`[${name}]: ${val}`);
              }
            } else if (val && typeof val === 'object' && val.type !== 'dir') {
              const fileContent = val.content || "";
              if (fileContent.toLowerCase().includes(pattern.toLowerCase())) {
                matches.push(`[${name}]: ${fileContent}`);
              }
            }
          }
        } else if (target) {
          // Search in a specific file
          if (target in contents) {
            const val = contents[target];
            if (typeof val === 'string') {
              if (val.toLowerCase().includes(pattern.toLowerCase())) {
                matches.push(`[${target}]: ${val}`);
              }
            } else if (val && typeof val === 'object' && val.type !== 'dir') {
              const fileContent = val.content || "";
              if (fileContent.toLowerCase().includes(pattern.toLowerCase())) {
                matches.push(`[${target}]: ${fileContent}`);
              }
            } else {
              setTerminalOutput(prev => [...prev, { type: 'error', text: `grep: ${target}: Is a directory` }]);
              break;
            }
          } else {
            setTerminalOutput(prev => [...prev, { type: 'error', text: `grep: ${target}: No such file` }]);
            break;
          }
        } else {
          setTerminalOutput(prev => [
            ...prev,
            { type: 'error', text: 'Usage: grep <pattern> <file>  OR  grep <pattern> *  OR  grep -r <pattern>' }
          ]);
          break;
        }

        if (matches.length === 0) {
          setTerminalOutput(prev => [...prev, { type: 'output', text: 'No matches found.' }]);
        } else {
          matches.forEach(matchText => {
            setTerminalOutput(prev => [...prev, { type: 'output', text: matchText }]);
          });
        }
        break;
      }



      case 'ls': {
        const showAll = args.includes('-a');

        /** @todo : To fetch 1 level deep directory items */
        const contents = getContentsAtPath();
        const items = Object.keys(contents);


        
        if (items.length === 0) {
          setTerminalOutput(prev => [...prev, { type: 'output', text: '(directory empty)' }]);
        } else {
          // Format list
          const outputs = items
            .filter(name =>{ 
              if(["author","creation","type","hidden","password"].includes(name)) return false;
              if (showAll || !name.startsWith('.') || !items[name].hidden) return true;
            })
            .map(name => {
              const isDir = contents[name] && contents[name].type === 'dir';
              return isDir ? `[DIR]  /${name}` : `[FILE] ${name}`;
            });
          
          if (outputs.length === 0 && !showAll && items.some(n => n.startsWith('.')||items[n].hidden)) {
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
            if (contents[target] && contents[target].type === 'dir') {
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
          if (contents[file] && contents[file].type === 'dir') {
            setTerminalOutput(prev => [...prev, { type: 'error', text: `cat: ${file}: Is a directory` }]);
          }
          else if(contents[file] && contents[file].type==='Protected File') {
            if( !args[1] || !args[1].startsWith("--pwd=") )setTerminalOutput(prev=>[...prev,{type:'error', text:`Enter a valid password`}]);
            else {
              const pwd=args[1].substring(6);
              const path =currentPath.endsWith('/')?currentPath+args[0]:currentPath+'/'+args[0];
              fetch(`${import.meta.env.VITE_API_URL || ''}/api/file?level=${activeLevel}&path=root${path}&password=${pwd}`).then(async res=>{
                res=await res.json()
                console.table(res)
                if(res.error) setTerminalOutput(prev => [...prev, { type: 'error', text: `cat: ${file}: ${res.error}` }]);
                else{

                  setTerminalOutput(prev => [...prev, { type: 'output', text: res?.content || "" }]);
                  setTerminalOutput(prev => [...prev, { type: 'output', text: `\n-> Author : ${res.author}\n-> Creation-Date : ${res.creation}` }]);
                }
              }).catch(err=>{
                setTerminalOutput(prev => [...prev, { type: 'error', text: `cat: ${file}: ${err}` }])
              })
            }
          }
          else {
            const val = contents[file];
            if (typeof val === 'string') {
              setTerminalOutput(prev => [...prev, { type: 'output', text: val }]);
            } else {
              setTerminalOutput(prev => [...prev, { type: 'output', text: val?.content || "" }]);
              if (val?.author || val?.creation) {
                setTerminalOutput(prev => [...prev, { type: 'output', text: `\n-> Author : ${val.author || "Unknown"}\n-> Creation-Date : ${val.creation || "Unknown"}` }]);
              }
            }
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
          { type: 'system', text: "Use 'ls' to scan files." }
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
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      sound.playError();
      setTerminalOutput(prev => [
        ...prev,
        { type: 'error', text: `Socket is not connected. Please reconnect and try again.` }
      ]);
      return;
    }

    socket.emit('submit_answer', {questionId: activeLevel,answer: ans,group: team?.name,}, (res) => {
      if (!res) {
        sound.playError();
        setTerminalOutput(prev => [
          ...prev,
          { type: 'error', text: `No response from server.` }
        ]);
        return;
      }

      if (res.success) {
        sound.playSuccess();
        setTerminalOutput(prev => [
          ...prev,
          { type: 'success', text: `[DECRYPTION ACCEPTED]: ${res.message}` }
        ]);
      } else {
        sound.playError();
        setTerminalOutput(prev => [
          ...prev,
          { type: 'error', text: `[DECRYPTION DENIED]: ${res.message}` }
        ]);
      }
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

    socket.emit('join_team', { group: joinTeamName, ref: localStorage.getItem('ref') }, (res) => {
      if (res?.success) {
        setTeam(res.team);
      } else {
        sound.playError();
        setErrorMsg(res?.error || 'Cannot join selected team.');
      }
    });
  };

  // 4. Select Level Action
  const handleSelectLevel = (lvl) => {
    sound.playClick();
    updateActiveLevel(lvl);
    setCurrentPath('/');
    
    const name = getLevelName(lvl);
    setTerminalOutput(old => [
      [],
      { type: 'system', text: `SWITCHED TERMINAL TO LEVEL ${lvl}: ${name}` }
    ]);
  };

  //UNDER REVIEW PLEASE LOOK INTO IT
  const handleDisconnect = () => {
    sound.playClick();
    
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/disconnect`, {
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
      {/* Sound Control Header */}
      <div className="absolute top-4 right-4 z-40 flex items-center space-x-2">
        <button
          onClick={toggleMute}
          className="p-2 border border-cyber-cyan/30 bg-cyber-card text-cyber-cyan hover:bg-cyber-cyan hover:text-black transition rounded shadow-neon-cyan"
          title="Toggle Synth Soundscape"
        >
          {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 animate-pulse" />}
        </button>
      </div>

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

      {/* SCREEN 4: LEADERBOARD SCREEN */}
      {screen === 'leaderboard' && (
        <Leaderboard />
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
          joinTeamName={joinTeamName}
          setJoinTeamName={setJoinTeamName}
          errorMsg={errorMsg}
          handleCreateTeamSubmit={handleCreateTeamSubmit}
          handleJoinTeamSubmit={handleJoinTeamSubmit}
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
              <h2 className="text-md font-bold text-cyber-cyan">{getLevelName(activeLevel)}</h2>
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
              activeLevel={activeLevel}
              activeTab={activeTab}
              onSelectLevel={handleSelectLevel}
              getLevelName={getLevelName}
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
                <p className="text-cyber-cyan font-bold">TRANSMISSION ENCRYPTED</p>
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
              onGoToLeaderboard={() => {
                window.history.pushState(null, '', '/leaderboard');
                setScreen('leaderboard');
              }}
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

/**
 * level format change logic
 * socket io implememntation
 * admin panel removal
 * endpoint check
 */