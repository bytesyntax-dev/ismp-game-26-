import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, ShieldCheck, Radio, Loader2, Users } from 'lucide-react';

const OVERLAY_ID = 'game-start-lock';
const START_POLL_MS = 2000;
const GUARD_CHECK_MS = 500;

export default function GameStartOverlay({ active = false, team = null, currentMemberId = null }) {
  const [started, setStarted] = useState(false);
  const [checking, setChecking] = useState(true);
  // Bumped by the guard timer when the overlay is stripped from the DOM so
  // React is forced to remount a brand new overlay node.
  const [remountKey, setRemountKey] = useState(0);
  const startedRef = useRef(false);
  startedRef.current = started;

  // Poll the backend to see if the admin has started the game. Only runs while
  // the player is in the game screen (i.e. after creating/joining a team).
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // Fail closed: reset to locked until the poll confirms the game started.
    setStarted(false);
    setChecking(true);
    const checkStarted = async () => {
      try {
        const res = await fetch('/api/started', { cache: 'no-store' });
        if (!res.ok) throw new Error('started endpoint unreachable');
        const data = await res.json();
        if (!cancelled) {
          setStarted(!!data.started);
          setChecking(false);
        }
      } catch (err) {
        // Fail closed: if we cannot reach the server, keep the game locked.
        if (!cancelled) setChecking(false);
      }
    };

    checkStarted();
    const poll = setInterval(checkStarted, START_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [active]);

  // Guard timer: continuously verify the overlay node still exists. If an
  // advanced user deletes it from DevTools, force a remount so it reappears.
  useEffect(() => {
    if (!active || started) return;
    const guard = setInterval(() => {
      if (startedRef.current) return;
      if (!document.getElementById(OVERLAY_ID)) {
        setRemountKey((k) => k + 1);
      }
    }, GUARD_CHECK_MS);
    return () => clearInterval(guard);
  }, [active, started]);

  // Defense-in-depth: a MutationObserver that instantly detects removal of the
  // overlay node and triggers the same remount instead of waiting for the timer.
  useEffect(() => {
    if (!active || started) return;
    const observer = new MutationObserver((mutations) => {
      if (startedRef.current) return;
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.id === OVERLAY_ID) {
            // Only force a remount if the overlay is truly gone. React's own
            // reconciliation adds a fresh node synchronously, so by the time
            // this microtask runs it would already exist again.
            queueMicrotask(() => {
              if (!startedRef.current && !document.getElementById(OVERLAY_ID)) {
                setRemountKey((k) => k + 1);
              }
            });
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active, started]);

  // While locked, intercept every pointer/keyboard interaction at the window
  // level so nothing under the overlay can be triggered, even via DevTools.
  useEffect(() => {
    if (!active || started) return;
    const blockedEvents = [
      'pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick',
      'touchstart', 'touchend', 'keydown', 'keypress', 'keyup', 'input',
      'wheel', 'contextmenu', 'select', 'dragstart'
    ];
    const block = (e) => {
      if (startedRef.current) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    blockedEvents.forEach((type) =>
      window.addEventListener(type, block, { capture: true })
    );
    return () => {
      document.body.style.overflow = prevOverflow;
      blockedEvents.forEach((type) =>
        window.removeEventListener(type, block, { capture: true })
      );
    };
  }, [active, started]);

  // Re-declare the overlay (new key) whenever the guard catches a removal.
  const overlay = useCallback((key) => (
    <div
      key={key}
      id={OVERLAY_ID}
      data-testid="game-start-overlay"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-cyber-bg font-mono overflow-hidden select-none"
      style={{ pointerEvents: 'auto', cursor: 'default' }}
      aria-live="assertive"
    >
      <div className="absolute inset-0 matrix-bg opacity-10"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-cyber-cyan shadow-neon-cyan-intense animate-pulse"></div>

      <div className="relative text-center px-6 space-y-6 max-w-lg">
        <div className="inline-flex p-5 bg-cyber-card border-2 border-cyber-cyan/60 rounded-full shadow-neon-cyan-intense animate-pulse">
          <Lock className="w-14 h-14 text-cyber-cyan" />
        </div>

        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-cyber-cyan tracking-[0.3em] uppercase drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]">
            Uplink Locked
          </h1>
          <p className="mt-3 text-cyber-gray text-xs md:text-sm uppercase tracking-widest">
            The mainframe is not yet active. The administrator has not authorized
            this session.
          </p>
        </div>

        {/* Active squad details */}
        {team && (
          <div className="w-full max-w-sm mx-auto bg-cyber-card border border-cyber-cyan/30 rounded p-4 text-left">
            <div className="flex items-center space-x-2 border-b border-cyber-cyan/20 pb-2 mb-2">
              <Users className="w-4 h-4 text-cyber-cyan" />
              <p className="text-[10px] text-cyber-gray uppercase tracking-widest">
                Active Squad
              </p>
            </div>
            <p className="text-cyber-cyan font-bold text-lg tracking-wider break-all">
              {team.name}
            </p>
            <div className="mt-2 space-y-1.5">
              {team.members?.length ? team.members.map((member, i) => {
                const isSelf = currentMemberId && member.id === currentMemberId;
                return (
                  <div key={member.id || i} className="flex items-center justify-between text-xs">
                    <span className={`truncate ${isSelf
                      ? 'text-cyber-cyan font-bold drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]'
                      : 'text-cyber-gray'}`}>
                      {member.name || 'Operative'}
                    </span>
                    <span className={isSelf
                      ? 'text-cyber-cyan font-bold'
                      : (i === 0 ? 'text-cyber-amber' : 'text-cyber-green')}>
                      {isSelf ? 'YOU' : (i === 0 ? 'LEAD' : 'MEMBER')}
                    </span>
                  </div>
                );
              }) : (
                <p className="text-cyber-gray text-xs">No members synced yet.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center space-x-2 text-cyber-cyan/80 text-xs tracking-widest uppercase">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>AWAITING ADMIN AUTHORIZATION</span>
        </div>

        <div className="flex items-center justify-center space-x-6 text-[10px] text-cyber-gray uppercase tracking-wider">
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyber-green" /> Encrypted
          </span>
          <span className="flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-cyber-cyan animate-pulse" />
            {checking ? 'Verifying uplink…' : 'Link: STANDBY'}
          </span>
        </div>
      </div>

      <p className="absolute bottom-4 text-[9px] text-cyber-gray/40 uppercase tracking-[0.25em]">
        System access restricted until game start
      </p>
    </div>
  ), [checking, team, currentMemberId]);

  if (!active || started) return null;
  return overlay(remountKey);
}
