import React, { useState, useEffect } from "react";
import { Trophy, Award, Clock, ArrowLeft, Shield } from "lucide-react";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = () => {
    fetch("/api/points")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch mainframe records.");
        }
        return res.json();
      })
      .then((data) => {
        let payload = [];
        for (let team in data) {
          console.log(data[team]);
          const teamData = data[team];
          const score = teamData.total || 0;
          const solvedCount = Object.keys(teamData).filter(
            (k) => k !== "total" && k !== "start",
          ).length;
          payload.push({
            name: team,
            score: score,
            solvedCount: solvedCount,
            ques_data: teamData,
            //change 5 for any no of levels
            timeTakenMs:
              solvedCount == 5
                ? Object.keys(teamData)
                    .filter(
                      (k) =>
                        k !== "total" && k !== "start" && teamData[k].time,
                    )
                    .reduce((max, k) => Math.max(max, teamData[k].time), 0)
                : Date.now() - teamData.start,
          });
        }
        // Sort by score descending, then by time ascending
        payload.sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score; // Descending by score
          }
          return a.timeTakenMs - b.timeTakenMs; // Ascending by time
        });
        setLeaderboard(payload);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatStopwatch = (totalMs) => {
    if (!totalMs || isNaN(totalMs) || totalMs < 0) return "00:00";
    const totalSecs = Math.floor(totalMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return hrs > 0
      ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
      : `${pad(mins)}:${pad(secs)}`;
  };

  return (
    <div className="min-h-screen bg-cyber-bg text-white font-sans flex flex-col items-center p-4 md:p-8 relative select-none">
      <div className="w-full max-w-5xl mt-8 z-10">
        <div className="text-center mb-8 font-mono">
          <div className="inline-flex p-3 bg-cyber-cyan-dark border border-cyber-cyan/30 rounded mb-3 shadow-neon-cyan">
            <Trophy className="w-8 h-8 text-cyber-cyan animate-pulse" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-cyber-cyan tracking-widest uppercase drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]">
            Mainframe Leaderboard
          </h1>
          <p className="text-cyber-gray text-xs md:text-sm uppercase tracking-widest mt-2">
            Global Synced Uplink Registry
          </p>
        </div>

        {/* Leaderboard Table Container */}
        <div className="bg-cyber-card border border-cyber-cyan/25 rounded shadow-neon-cyan overflow-hidden font-mono">
          {loading && leaderboard.length === 0 ? (
            <div className="text-center py-16 text-cyber-gray animate-pulse">
              DECRYPTING LEADERBOARD DATA STREAM...
            </div>
          ) : error ? (
            <div className="text-center py-16 text-cyber-red font-bold">
              ERROR: {error}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-16 text-cyber-gray tracking-wider">
              NO ACTIVE NODE CONNECTIONS REGISTERED ON MAINFRAME.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-cyber-dark/80 border-b border-cyber-border text-[10px] md:text-xs text-cyber-gray uppercase tracking-wider">
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Team Operative</th>
                    <th className="px-3 py-4 text-center w-12">A</th>
                    <th className="px-3 py-4 text-center w-12">B</th>
                    <th className="px-3 py-4 text-center w-12">C</th>
                    <th className="px-3 py-4 text-center w-12">D</th>
                    <th className="px-3 py-4 text-center w-12">E</th>
                    <th className="px-6 py-4 text-right w-24">Score</th>
                    <th className="px-6 py-4 text-right flex items-center justify-end">
                      Time Elapsed
                    </th>
                  </tr>
                </thead>
                <tbody className="text-xs md:text-sm">
                  {leaderboard.map((team, idx) => {
                    const rank = idx + 1;
                    let rankClass = "text-cyber-gray";
                    let rowClass = "hover:bg-cyber-cyan/5";
                    if (rank === 1) {
                      rankClass =
                        "text-cyber-green font-bold drop-shadow-[0_0_5px_rgba(0,255,102,0.5)]";
                      rowClass = "bg-cyber-green/5 hover:bg-cyber-green/10";
                    } else if (rank === 2) {
                      rankClass =
                        "text-cyber-cyan font-bold drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]";
                      rowClass = "bg-cyber-cyan/5 hover:bg-cyber-cyan/10";
                    } else if (rank === 3) {
                      rankClass =
                        "text-cyber-amber font-bold drop-shadow-[0_0_5px_rgba(255,183,0,0.5)]";
                      rowClass = "bg-cyber-amber/5 hover:bg-cyber-amber/10";
                    }

                    return (
                      <tr
                        key={team.name}
                        className={`${rowClass} transition duration-150`}
                      >
                        <td className={`px-6 py-4 font-semibold ${rankClass}`}>
                          #{rank}
                        </td>
                        <td className="px-6 py-4 font-bold text-white tracking-wide">
                          {team.name}
                        </td>
                        {[1, 2, 3, 4, 5].map((lvl) => {
                          const isSolved = team.ques_data && team.ques_data[lvl] !== undefined;
                          return (
                            <td key={lvl} className="px-3 py-4 text-center">
                              <span
                                className={`inline-block w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                                  isSolved
                                    ? "bg-cyber-green border-cyber-green shadow-[0_0_8px_#00ff66]"
                                    : "bg-cyber-bg/40 border-cyber-border/40"
                                }`}
                                title={isSolved ? `Level ${lvl} Solved` : `Level ${lvl} Unsolved`}
                              />
                            </td>
                          );
                        })}
                        <td className="px-6 py-4 text-right text-cyber-cyan font-bold">
                          {team.score} PTS
                        </td>
                        <td className="px-6 py-4 text-right text-cyber-gray flex items-center justify-end space-x-1">
                          <Clock className="w-3.5 h-3.5 text-cyber-gray/50" />
                          <span>{formatStopwatch(team.timeTakenMs)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Back Link Button */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="inline-flex items-center space-x-2 text-cyber-cyan border border-cyber-cyan/30 bg-cyber-cyan-dark/15 hover:bg-cyber-cyan hover:text-black hover:shadow-neon-cyan transition duration-200 px-5 py-2.5 rounded font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Terminal</span>
          </a>
        </div>
      </div>
    </div>
  );
}
