"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import Link from "next/link";
import { useHabits, useSelfCompleteHabit } from "@/hooks/useHabits";
import { useStreak } from "@/hooks/useStreak";
import { useActiveSession } from "@/hooks/useSession";
import { TxToast } from "@/components/shared/TxToast";
import { HabitTypeLabel } from "@/lib/constants";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatElapsed(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

const NAV = [
  { href: "/timer",       icon: "⏱", label: "Timer" },
  { href: "/habits",      icon: "◆", label: "Habits" },
  { href: "/circle",      icon: "◉", label: "Circle" },
  { href: "/leaderboard", icon: "◈", label: "Board" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  const { habits, refetch: refetchHabits } = useHabits();
  const { currentStreak, longestStreak, totalCompletions, isActiveToday } = useStreak();
  const { isActive, elapsed, habitId } = useActiveSession();
  const { selfCompleteHabit, hash, isPending, isSuccess } = useSelfCompleteHabit();

  const activeHabits = habits.filter((h) => h.active);

  useEffect(() => { if (isSuccess) refetchHabits(); }, [isSuccess, refetchHabits]);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[#050508] pb-24 relative overflow-hidden">

      {/* Background glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] opacity-[0.06] rounded-full"
        style={{ background: "radial-gradient(ellipse, #7c3aed 0%, transparent 70%)" }} />

      {/* Top bar */}
      <div className="glass border-b border-white/[0.06] px-4 py-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-black">P</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">Proov</p>
              <p className="text-white/30 text-[10px]">{address ? shortAddr(address) : ""}</p>
            </div>
          </div>
          <Link href="/leaderboard"
            className="text-white/40 hover:text-white/80 text-xs transition-colors flex items-center gap-1">
            ◈ Leaderboard
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* Streak hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden p-6"
          style={{ background: "linear-gradient(135deg, #4c1d95 0%, #3730a3 50%, #1e1b4b 100%)" }}
        >
          {/* Inner glow */}
          <div className="absolute -top-6 -left-6 w-40 h-40 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />

          <div className="relative flex items-end justify-between">
            <div>
              <p className="text-violet-300 text-xs font-semibold uppercase tracking-widest mb-1">
                Current Streak
              </p>
              <div className="flex items-end gap-2">
                <span className="text-white text-7xl font-black leading-none">
                  {currentStreak.toString()}
                </span>
                <span className="text-violet-300 text-lg mb-2">days 🔥</span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-violet-300/70 text-xs">Best</p>
              <p className="text-white font-bold text-xl">{longestStreak.toString()}</p>
              <p className="text-violet-300/70 text-xs mt-2">Total</p>
              <p className="text-white font-bold">{totalCompletions.toString()}</p>
            </div>
          </div>

          {isActiveToday && (
            <div className="relative mt-3 inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-300 text-xs font-medium">Active today</span>
            </div>
          )}
        </motion.div>

        {/* Active session banner */}
        {isActive && (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            className="glass rounded-2xl p-4 flex items-center justify-between border border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <div>
                <p className="text-white text-sm font-semibold">Focus in progress</p>
                <p className="text-white/40 text-xs">Habit #{habitId.toString()} · {formatElapsed(elapsed)}</p>
              </div>
            </div>
            <Link href="/timer"
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors">
              View →
            </Link>
          </motion.div>
        )}

        {/* Today's habits */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">
              Today&apos;s Habits
            </p>
            <Link href="/habits" className="text-violet-400 text-xs hover:text-violet-300 transition-colors">
              Manage →
            </Link>
          </div>

          {activeHabits.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/40 text-sm mb-4">No habits yet.</p>
              <Link href="/habits"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                + Create first habit
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activeHabits.map((habit, i) => (
                <motion.div
                  key={habit.id.toString()}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass glass-hover rounded-2xl p-4 flex items-center gap-4 group"
                >
                  <button
                    onClick={() => selfCompleteHabit(Number(habit.id))}
                    disabled={isPending}
                    className="w-9 h-9 rounded-xl border border-white/10 hover:border-violet-500 hover:bg-violet-500/20
                      flex items-center justify-center transition-all duration-200 flex-shrink-0 group-hover:border-violet-400"
                  >
                    <span className="text-white/30 group-hover:text-violet-300 text-sm transition-colors">✓</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{habit.name}</p>
                    <p className="text-white/30 text-xs">{HabitTypeLabel[Number(habit.habitType)]}</p>
                  </div>
                  {Number(habit.habitType) === 0 && (
                    <Link href={`/timer?habitId=${habit.id.toString()}`}
                      className="text-white/20 hover:text-violet-300 text-xs transition-colors flex-shrink-0">
                      Focus →
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Quick nav grid */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          {NAV.map((item, i) => (
            <motion.div key={item.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}>
              <Link href={item.href}
                className="glass glass-hover rounded-2xl py-4 flex flex-col items-center gap-1.5">
                <span className="text-xl">{item.icon}</span>
                <span className="text-white/40 text-[10px]">{item.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <TxToast hash={hash} pendingText="Recording habit…" successText="Habit logged!" />
    </div>
  );
}
