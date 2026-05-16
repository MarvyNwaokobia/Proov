"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useHabits } from "@/hooks/useHabits";
import { useActiveSession, useStartSession, useEndSession, useAbandonSession } from "@/hooks/useSession";
import { TxToast } from "@/components/shared/TxToast";
import { MIN_SESSION_SECONDS } from "@/lib/constants";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

const RADIUS = 90;
const CIRC = 2 * Math.PI * RADIUS;

export default function TimerPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  const { habits } = useHabits();
  const { session, isActive, startTimestamp, refetch } = useActiveSession();
  const { startSession, hash: startHash, isPending: isStarting, isSuccess: startOk } = useStartSession();
  const { endSession,   hash: endHash,   isPending: isEnding,   isSuccess: endOk   } = useEndSession();
  const { abandonSession, hash: abortHash, isPending: isAborting, isSuccess: abortOk } = useAbandonSession();

  const [selHabitId, setSelHabitId] = useState<number>(Number(sp.get("habitId") ?? "0"));
  const [targetSec, setTargetSec] = useState(MIN_SESSION_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync elapsed from contract on mount / session change
  useEffect(() => {
    if (isActive && startTimestamp > 0) {
      setElapsed(Math.floor(Date.now() / 1000) - startTimestamp);
    } else {
      setElapsed(0);
    }
  }, [isActive, startTimestamp]);

  // Local tick
  useEffect(() => {
    if (isActive) {
      tickRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isActive]);

  useEffect(() => {
    if (startOk || endOk || abortOk) refetch();
  }, [startOk, endOk, abortOk, refetch]);

  const activeHabits = habits.filter(h => h.active);
  const currentHabit = isActive
    ? activeHabits.find(h => Number(h.id) === Number(session?.habitId ?? 0))
    : activeHabits.find(h => Number(h.id) === selHabitId);

  const progress    = isActive ? Math.min(1, elapsed / targetSec) : 0;
  const dashOffset  = CIRC * (1 - progress);
  const remaining   = Math.max(0, targetSec - elapsed);
  const isComplete  = isActive && elapsed >= MIN_SESSION_SECONDS;
  const pct         = Math.round(progress * 100);

  const ringColor = isComplete ? "#10b981" : "#8b5cf6";

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[#050508] pb-24 flex flex-col relative overflow-hidden">

      {/* Ambient glow behind ring */}
      <motion.div
        animate={{ opacity: isActive ? [0.08, 0.14, 0.08] : 0.05 }}
        transition={{ duration: 2.5, repeat: Infinity }}
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
        style={{ background: `radial-gradient(circle, ${isComplete ? "#10b981" : "#7c3aed"}, transparent 70%)` }}
      />

      {/* Header */}
      <div className="glass border-b border-white/[0.06] px-4 py-4 relative z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors text-sm">←</Link>
          <p className="text-white font-bold">Focus Timer</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-8 relative z-10">

        {/* Habit selector (idle only) */}
        <AnimatePresence>
          {!isActive && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-sm space-y-3"
            >
              <div>
                <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-2">Habit</p>
                <select
                  value={selHabitId}
                  onChange={e => setSelHabitId(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                    focus:outline-none focus:border-violet-500 transition-colors appearance-none"
                >
                  {activeHabits.map(h => (
                    <option key={h.id.toString()} value={Number(h.id)} className="bg-gray-900">
                      {h.name}
                    </option>
                  ))}
                  {activeHabits.length === 0 && (
                    <option disabled>No habits — create one first</option>
                  )}
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-white/30 text-xs font-semibold uppercase tracking-widest">Duration</p>
                  <p className="text-violet-300 text-xs font-semibold">{Math.round(targetSec / 60)} min</p>
                </div>
                <input
                  type="range" min={MIN_SESSION_SECONDS} max={7200} step={300}
                  value={targetSec}
                  onChange={e => setTargetSec(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-white/20 text-[10px] mt-1">
                  <span>25 min</span><span>2 hr</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Habit name while running */}
        {isActive && currentHabit && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-white/60 text-sm font-medium"
          >
            {currentHabit.name}
          </motion.p>
        )}

        {/* Ring */}
        <div className="relative">
          <svg width={220} height={220} className="-rotate-90">
            {/* Track */}
            <circle cx={110} cy={110} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
            {/* Progress */}
            <motion.circle
              cx={110} cy={110} r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              style={{ filter: `drop-shadow(0 0 8px ${ringColor}80)` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>

          {/* Center display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={isActive ? "running" : "idle"}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-white font-mono text-4xl font-black tracking-tight"
              >
                {isActive ? fmt(elapsed) : fmt(targetSec)}
              </motion.span>
            </AnimatePresence>

            {isActive && (
              <p className={`text-xs mt-1 font-medium ${isComplete ? "text-emerald-400" : "text-white/30"}`}>
                {isComplete ? "✓ Complete!" : `${fmt(remaining)} left · ${pct}%`}
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="w-full max-w-sm space-y-3">
          {!isActive ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => startSession(selHabitId)}
              disabled={isStarting || activeHabits.length === 0}
              className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold
                text-base disabled:opacity-40 transition-colors glow-violet-sm"
            >
              {isStarting ? "Starting…" : "▶ Start Session"}
            </motion.button>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => endSession()}
                disabled={isEnding || isAborting}
                className={`w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-40
                  ${isComplete
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white glow-emerald"
                    : "glass border border-white/10 text-white/60 hover:text-white hover:border-white/20"
                  }`}
              >
                {isEnding ? "Confirming…" : isComplete ? "✓ Confirm & Earn Credit" : "End Session (no credit)"}
              </motion.button>

              <button
                onClick={() => abandonSession()}
                disabled={isEnding || isAborting}
                className="w-full py-3 rounded-2xl text-white/30 hover:text-white/60 text-sm transition-colors disabled:opacity-40"
              >
                {isAborting ? "Abandoning…" : "Abandon session"}
              </button>
            </>
          )}
        </div>
      </div>

      <TxToast hash={startHash} pendingText="Starting session…" successText="Session started!" />
      <TxToast hash={endHash}   pendingText="Confirming…"       successText="Streak updated! 🔥" />
      <TxToast hash={abortHash} pendingText="Abandoning…"       successText="Session abandoned." />
    </div>
  );
}
