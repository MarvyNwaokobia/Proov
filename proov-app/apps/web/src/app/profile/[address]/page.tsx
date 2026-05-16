"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import Link from "next/link";
import { useHabits } from "@/hooks/useHabits";
import { useStreak } from "@/hooks/useStreak";
import { HabitTypeLabel } from "@/lib/constants";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const HABIT_TYPE_ICONS: Record<number, string> = {
  0: "🧠", 1: "💪", 2: "📖", 3: "💧", 4: "😴", 5: "◆",
};

export default function ProfilePage({ params }: { params: { address: string } }) {
  const router = useRouter();
  const { address: myAddress, isConnected } = useAccount();
  const profileAddress = params.address as `0x${string}`;
  const isOwn = profileAddress.toLowerCase() === myAddress?.toLowerCase();

  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  const { habits } = useHabits(profileAddress);
  const { currentStreak, longestStreak, totalCompletions, journalCount, isActiveToday } = useStreak(profileAddress);

  const activeHabits = habits.filter(h => h.active);

  const STATS = [
    { label: "Current Streak", value: currentStreak.toString(), unit: "days", accent: "text-amber-300", glow: "#f59e0b" },
    { label: "Longest Streak", value: longestStreak.toString(), unit: "days", accent: "text-violet-300", glow: "#7c3aed" },
    { label: "Completions",    value: totalCompletions.toString(), unit: "total", accent: "text-white", glow: "" },
    { label: "Journal Entries",value: journalCount.toString(), unit: "entries", accent: "text-emerald-300", glow: "#10b981" },
  ];

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[#050508] pb-24 relative overflow-hidden">

      {/* Header glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] opacity-[0.06] rounded-full"
        style={{ background: "radial-gradient(ellipse, #7c3aed, transparent)" }} />

      {/* Header */}
      <div className="glass border-b border-white/[0.06] px-4 py-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/leaderboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors text-sm">←</Link>
          <p className="text-white font-bold">{isOwn ? "My Profile" : "Profile"}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">

        {/* Identity hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ boxShadow: ["0 0 20px rgba(124,58,237,0.2)", "0 0 40px rgba(124,58,237,0.4)", "0 0 20px rgba(124,58,237,0.2)"] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center"
          >
            <span className="text-white text-2xl font-black">{profileAddress.slice(2, 4).toUpperCase()}</span>
          </motion.div>

          <div className="text-center">
            <p className="text-white/60 font-mono text-sm">{shortAddr(profileAddress)}</p>
            {isOwn && <p className="text-violet-400 text-xs mt-0.5">That&apos;s you</p>}
            {isActiveToday && (
              <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mt-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-emerald-300 text-[10px] font-medium">Active today</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="glass rounded-2xl p-4 relative overflow-hidden"
            >
              {stat.glow && (
                <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-10"
                  style={{ background: `radial-gradient(circle, ${stat.glow}, transparent)` }} />
              )}
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.accent}`}>{stat.value}</p>
              <p className="text-white/20 text-xs">{stat.unit}</p>
            </motion.div>
          ))}
        </div>

        {/* Habits */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest">
              Active Habits
            </p>
            <span className="text-white/20 text-xs">{activeHabits.length}</span>
          </div>

          {activeHabits.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/20 text-sm">No active habits.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeHabits.map((habit, i) => (
                <motion.div
                  key={habit.id.toString()}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="glass glass-hover rounded-2xl p-4 flex items-center gap-4"
                >
                  <span className="text-xl flex-shrink-0">
                    {HABIT_TYPE_ICONS[Number(habit.habitType)] ?? "◆"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{habit.name}</p>
                    <p className="text-white/30 text-xs">
                      {HabitTypeLabel[Number(habit.habitType)]}
                      {Number(habit.targetDuration) > 0
                        ? ` · ${Math.round(Number(habit.targetDuration) / 60)} min`
                        : ""}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Own profile — quick actions */}
        {isOwn && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link href="/habits"
              className="glass glass-hover rounded-2xl py-4 flex flex-col items-center gap-2">
              <span className="text-xl">◆</span>
              <span className="text-white/40 text-xs">Manage Habits</span>
            </Link>
            <Link href="/circle"
              className="glass glass-hover rounded-2xl py-4 flex flex-col items-center gap-2">
              <span className="text-xl">◉</span>
              <span className="text-white/40 text-xs">My Circle</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
