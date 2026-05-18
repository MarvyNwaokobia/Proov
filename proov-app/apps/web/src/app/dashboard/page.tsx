"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useHabits, useSelfCompleteHabit } from "@/hooks/useHabits";
import { useStreak } from "@/hooks/useStreak";
import { useActiveSession } from "@/hooks/useSession";
import { TxToast } from "@/components/shared/TxToast";
import { HabitTypeLabel, HABIT_CATEGORIES, getCategoryById } from "@/lib/constants";
import { getUsername, validateUsername, setUsername } from "@/lib/username";
import { getHabitMeta, reconcilePendingCategory } from "@/lib/habitMeta";
import { UsernameSetup } from "@/components/onboarding/UsernameSetup";
import { AppTutorial } from "@/components/onboarding/AppTutorial";
import { StreakMilestoneModal } from "@/components/shared/StreakMilestoneModal";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { isMilestone } from "@/lib/shareCard";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatElapsed(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

const NAV = [
  { href: "/timer",       icon: "⏱", label: "Timer"  },
  { href: "/habits",      icon: "◆", label: "Habits" },
  { href: "/circle",      icon: "◉", label: "Circle" },
  { href: "/leaderboard", icon: "◈", label: "Board"  },
];


export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [milestoneStreak, setMilestoneStreak] = useState<number | null>(null);
  const [username, setUsernameState] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [doneHabitId, setDoneHabitId] = useState<number | null>(null);
  const [prevStreak, setPrevStreak] = useState<number | null>(null);

  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  useEffect(() => {
    if (address) {
      const u = getUsername(address);
      setUsernameState(u);
      if (!u) { setShowUsernameSetup(true); return; }
      // Show tutorial after username is set, only once
      if (!localStorage.getItem('proov_tutorial_done')) {
        setShowTutorial(true);
      }
    }
  }, [address]);

  const { habits, refetch: refetchHabits } = useHabits();
  const { currentStreak, longestStreak, totalCompletions, isActiveToday } = useStreak();
  const { isActive, elapsed, habitId } = useActiveSession();
  const { selfCompleteHabit, hash, isPending, isSuccess } = useSelfCompleteHabit();

  const habitMeta = address ? getHabitMeta(address) : {};
  const activeHabits = habits.filter((h) => h.active);

  useEffect(() => {
    if (isSuccess && address) {
      reconcilePendingCategory(address, habits as unknown as Array<{ id: bigint; name: string; createdAt: bigint }>);
      refetchHabits();
    }
  }, [isSuccess, address, habits, refetchHabits]);

  // Track streak milestones after a habit completion
  const currentStreakNum = Number(currentStreak);
  useEffect(() => {
    if (isSuccess && prevStreak !== null && currentStreakNum > prevStreak) {
      if (isMilestone(currentStreakNum)) setMilestoneStreak(currentStreakNum);
    }
    if (currentStreakNum > 0) setPrevStreak(currentStreakNum);
  }, [isSuccess, currentStreakNum, prevStreak]);

  // Filtered habits
  const filteredHabits = categoryFilter === "all"
    ? activeHabits
    : activeHabits.filter((h) => {
        const meta = habitMeta[h.id.toString()];
        return meta?.categoryId === categoryFilter;
      });

  const handleComplete = (id: number) => {
    selfCompleteHabit(id);
    setDoneHabitId(id);
    setTimeout(() => setDoneHabitId(null), 2000);
  };

  const handleUsernameSetupDone = (uname: string) => {
    setShowUsernameSetup(false);
    setUsernameState(uname);
    // After username, check if tutorial should show
    if (!localStorage.getItem('proov_tutorial_done')) setShowTutorial(true);
  };

  const handleTutorialDone = () => {
    localStorage.setItem('proov_tutorial_done', '1');
    setShowTutorial(false);
  };

  if (!isConnected) return null;

  return (
    <div className="min-h-screen app-bg pb-24 relative overflow-hidden">
      {showUsernameSetup && address && (
        <UsernameSetup address={address} onComplete={handleUsernameSetupDone} />
      )}
      {showTutorial && !showUsernameSetup && (
        <AppTutorial onDone={handleTutorialDone} />
      )}
      {milestoneStreak !== null && address && (
        <StreakMilestoneModal
          streak={milestoneStreak}
          username={username ?? shortAddr(address)}
          categories={Object.values(getHabitMeta(address)).map(m => m.categoryId).filter(Boolean)}
          onClose={() => setMilestoneStreak(null)}
        />
      )}

      {/* Background glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] opacity-[0.08] rounded-full"
        style={{ background: "radial-gradient(ellipse, var(--accent) 0%, transparent 70%)" }} />

      {/* Top bar */}
      <div className="glass border-b border-white/[0.06] px-4 py-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent2))' }}>
              <span className="text-white text-sm font-black">P</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">Proov</p>
              <p className="text-white/30 text-[10px]">
                {username ?? (address ? shortAddr(address) : "")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/leaderboard"
              className="text-white/40 hover:text-white/80 text-xs transition-colors flex items-center gap-1">
              ◈ Board
            </Link>
            <Link href="/settings"
              className="text-white/30 hover:text-white/60 text-xs transition-colors">
              ⚙
            </Link>
            <button
              onClick={() => { disconnect(); router.push("/"); }}
              className="text-white/25 hover:text-white/60 text-xs transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* Streak hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden p-6"
          style={{ background: "var(--streak-hero-bg)" }}
        >
          <div className="absolute -top-6 -left-6 w-40 h-40 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, var(--accent-text), transparent)" }} />

          <div className="relative flex items-end justify-between">
            <div>
              <p style={{ color:'rgba(255,255,255,.7)', fontSize:10, fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:4 }}>Streak</p>
              <div className="flex items-end gap-2">
                <span style={{ color:'#fff', fontSize:72, fontWeight:900, lineHeight:1 }}>
                  {currentStreak.toString()}
                </span>
                <span style={{ color:'rgba(255,255,255,.8)', fontSize:18, marginBottom:8 }}>days 🔥</span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p style={{ color:'rgba(255,255,255,.5)', fontSize:10 }}>Best</p>
              <p style={{ color:'#fff', fontWeight:700, fontSize:20 }}>{longestStreak.toString()}</p>
              <p style={{ color:'rgba(255,255,255,.5)', fontSize:10, marginTop:8 }}>Total</p>
              <p style={{ color:'#fff', fontWeight:700 }}>{totalCompletions.toString()}</p>
            </div>
          </div>

          {isActiveToday && (
            <div className="relative mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#fff' }} />
              <span style={{ color:'#fff', fontSize:10, fontWeight:500 }}>Active today</span>
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

        {/* Habits section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Today</p>
            <Link href="/habits" className="text-violet-400 text-xs hover:text-violet-300 transition-colors">
              Manage →
            </Link>
          </div>

          {/* Category filter bar */}
          {activeHabits.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  categoryFilter === "all" ? "" : "glass text-white/40 hover:text-white/70"
                }`}
                style={categoryFilter === "all" ? { background:'var(--btn-primary-bg)', color:'var(--btn-primary-text)' } : undefined}
              >
                All
              </button>
              {HABIT_CATEGORIES.map((cat) => {
                const hasHabits = activeHabits.some(
                  (h) => habitMeta[h.id.toString()]?.categoryId === cat.id
                );
                if (!hasHabits) return null;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      categoryFilter === cat.id
                        ? "text-white"
                        : "glass text-white/40 hover:text-white/70"
                    }`}
                    style={categoryFilter === cat.id ? { backgroundColor: cat.color } : undefined}
                  >
                    {cat.emoji}
                  </button>
                );
              })}
            </div>
          )}

          {activeHabits.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/40 text-sm mb-4">No habits yet.</p>
              <Link href="/habits" className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                style={{ background:'var(--btn-primary-bg)', color:'var(--btn-primary-text)' }}>
                + Create first habit
              </Link>
            </div>
          ) : (
            <>
              {/* 2-column habits grid */}
              <div className="habits-grid">
                {filteredHabits.map((habit, i) => {
                  const meta = habitMeta[habit.id.toString()];
                  const cat = meta ? getCategoryById(meta.categoryId) : null;
                  const isDone = doneHabitId === Number(habit.id);

                  return (
                    <motion.div
                      key={habit.id.toString()}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{
                        background: 'var(--bg2)',
                        border: `1px solid ${cat ? cat.color + '40' : 'var(--border)'}`,
                        borderRadius: 14,
                        padding: '0.875rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        transition: 'background .25s, border-color .25s',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 18 }}>{cat ? cat.emoji : '◆'}</span>
                        <button
                          onClick={() => handleComplete(Number(habit.id))}
                          disabled={isPending}
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            border: `1px solid ${isDone ? 'var(--success)' : 'var(--border2)'}`,
                            background: isDone ? 'var(--success-bg)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: isDone ? 'var(--success)' : 'var(--text3)',
                            fontSize: 12, fontWeight: 700,
                            transition: 'all .2s',
                            cursor: isPending ? 'default' : 'pointer',
                          }}
                        >
                          ✓
                        </button>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}
                          className="truncate">{habit.name}</p>
                        <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                          {HabitTypeLabel[Number(habit.habitType)]}
                        </p>
                      </div>
                      {Number(habit.habitType) === 0 && (
                        <Link href={`/timer?habitId=${habit.id.toString()}`}
                          style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                          Focus →
                        </Link>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              {filteredHabits.length === 0 && categoryFilter !== "all" && (
                <p className="text-white/30 text-sm text-center py-6">No habits in this category.</p>
              )}
            </>
          )}
        </div>

        {/* Quick nav */}
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

        {/* Theme toggle */}
        <div style={{ paddingTop: '1.25rem', paddingBottom: '1rem' }}>
          <p className="section-label" style={{ marginTop: 0 }}>Your theme</p>
          <ThemeToggle />
        </div>
      </div>

      <TxToast hash={hash} pendingText="Recording habit…" successText="Done! ✓" />
    </div>
  );
}
