"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import Link from "next/link";
import { useHabits, useSelfCompleteHabit } from "@/hooks/useHabits";
import { useStreak, useLeaderboard } from "@/hooks/useStreak";
import { useActiveSession } from "@/hooks/useSession";
import { useCircle } from "@/hooks/useCircle";
import { TxToast } from "@/components/shared/TxToast";
import { HABIT_CATEGORIES, getCategoryById } from "@/lib/constants";
import { getUsername } from "@/lib/username";
import { getHabitMeta, reconcilePendingCategory } from "@/lib/habitMeta";
import { UsernameSetup } from "@/components/onboarding/UsernameSetup";
import { AppTutorial } from "@/components/onboarding/AppTutorial";
import { StreakMilestoneModal } from "@/components/shared/StreakMilestoneModal";
import { isMilestone } from "@/lib/shareCard";

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Hey";
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Cheer helpers
function canCheer(memberAddr: string): boolean {
  if (typeof window === "undefined") return false;
  const today = new Date().toDateString();
  return !localStorage.getItem(`proov_cheered_${memberAddr}_${today}`);
}
function sendCheer(memberAddr: string) {
  const today = new Date().toDateString();
  localStorage.setItem(`proov_cheered_${memberAddr}_${today}`, "1");
}

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [milestoneStreak, setMilestoneStreak] = useState<number | null>(null);
  const [username, setUsernameState] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cheeredMap, setCheeredMap] = useState<Record<string, boolean>>({});
  const [prevStreak, setPrevStreak] = useState<number | null>(null);

  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  useEffect(() => {
    if (address) {
      const u = getUsername(address);
      setUsernameState(u);
      if (!u) { setShowUsernameSetup(true); return; }
      if (!localStorage.getItem("proov_tutorial_done")) setShowTutorial(true);
    }
  }, [address]);

  const { habits, refetch: refetchHabits } = useHabits();
  const { currentStreak, longestStreak, totalCompletions, isActiveToday } = useStreak();
  const { isActive, elapsed, habitId } = useActiveSession();
  const { selfCompleteHabit, hash, isPending, isSuccess } = useSelfCompleteHabit();
  const { circle } = useCircle();
  const { entries: leaderboard } = useLeaderboard(50);

  const habitMeta = address ? getHabitMeta(address) : {};
  const activeHabits = habits.filter(h => h.active);
  const completedToday = 0; // derived from local completions
  const totalHabits = activeHabits.length;

  const currentStreakNum = Number(currentStreak);

  useEffect(() => {
    if (isSuccess && address) {
      reconcilePendingCategory(address, habits as unknown as Array<{ id: bigint; name: string; createdAt: bigint }>);
      refetchHabits();
    }
  }, [isSuccess, address, habits, refetchHabits]);

  useEffect(() => {
    if (isSuccess && prevStreak !== null && currentStreakNum > prevStreak) {
      if (isMilestone(currentStreakNum)) setMilestoneStreak(currentStreakNum);
    }
    if (currentStreakNum > 0) setPrevStreak(currentStreakNum);
  }, [isSuccess, currentStreakNum, prevStreak]);

  const filteredHabits = categoryFilter === "all"
    ? activeHabits
    : activeHabits.filter(h => {
        const meta = habitMeta[h.id.toString()];
        return meta?.categoryId === categoryFilter;
      });

  const myRank = address ? leaderboard.findIndex(e => e.address.toLowerCase() === address.toLowerCase()) + 1 : 0;
  const top2 = leaderboard.slice(0, 2);
  const meEntry = myRank > 2 ? leaderboard.find(e => e.address.toLowerCase() === address?.toLowerCase()) : null;

  const handleUsernameSetupDone = (uname: string) => {
    setShowUsernameSetup(false);
    setUsernameState(uname);
    if (!localStorage.getItem("proov_tutorial_done")) setShowTutorial(true);
  };

  const handleTutorialDone = () => {
    localStorage.setItem("proov_tutorial_done", "1");
    setShowTutorial(false);
  };

  const handleCheer = (addr: string) => {
    sendCheer(addr);
    setCheeredMap(m => ({ ...m, [addr]: true }));
  };

  if (!isConnected) return null;

  const displayName = username ?? (address ? shortAddr(address) : "");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {showUsernameSetup && address && (
        <UsernameSetup address={address} onComplete={handleUsernameSetupDone} />
      )}
      {showTutorial && !showUsernameSetup && (
        <AppTutorial onDone={handleTutorialDone} />
      )}
      {milestoneStreak !== null && address && (
        <StreakMilestoneModal
          streak={milestoneStreak}
          username={displayName}
          categories={Object.values(habitMeta).map(m => m.categoryId).filter(Boolean)}
          onClose={() => setMilestoneStreak(null)}
        />
      )}

      {/* Top gradient bar */}
      <div className="top-bar" />
      {/* Background blobs */}
      <div className="blobs">
        <div className="blob b1" />
        <div className="blob b2" />
      </div>

      <div style={{ position: "relative", zIndex: 1, padding: "calc(3px + 0.875rem) 1rem 0" }}>

        {/* 6.1 Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.875rem" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              {greeting()}, {displayName} 👋
            </div>
            <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
              {formatDate(new Date())}
            </div>
          </div>
          <div style={{ fontSize: 20, cursor: "pointer" }} onClick={() => router.push("/settings")}>⚙️</div>
        </div>

        {/* 6.2 Streak card */}
        <div style={{
          background: "linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))",
          borderRadius: 16, padding: "0.875rem", marginBottom: "0.875rem",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", right: -20, top: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: -1.5, lineHeight: 1 }}>
              {currentStreakNum}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.75)" }}>days 🔥</span>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,.5)" }}>Best: {longestStreak.toString()}</div>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,.2)", borderRadius: 20, height: 3, marginBottom: 4 }}>
            <div style={{ background: "#fff", borderRadius: 20, height: 3, width: totalHabits > 0 ? `${(completedToday / totalHabits) * 100}%` : "0%" }} />
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,.55)" }}>
            {isActiveToday ? "Active today ✓" : `${completedToday} of ${totalHabits} habits done today`}
          </div>
        </div>

        {/* Category filter */}
        {activeHabits.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: "0.625rem" }}>
            <button onClick={() => setCategoryFilter("all")} style={{
              flexShrink: 0, padding: "5px 12px", borderRadius: 14, fontSize: 10, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${categoryFilter === "all" ? "var(--accent)" : "var(--border)"}`,
              background: categoryFilter === "all" ? "var(--accent-bg)" : "transparent",
              color: categoryFilter === "all" ? "var(--accent-text)" : "var(--text3)",
            }}>All</button>
            {HABIT_CATEGORIES.map(cat => {
              const hasHabits = activeHabits.some(h => habitMeta[h.id.toString()]?.categoryId === cat.id);
              if (!hasHabits) return null;
              return (
                <button key={cat.id} onClick={() => setCategoryFilter(cat.id)} style={{
                  flexShrink: 0, padding: "5px 12px", borderRadius: 14, fontSize: 10, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${categoryFilter === cat.id ? cat.color + "80" : "var(--border)"}`,
                  background: categoryFilter === cat.id ? cat.color + "18" : "transparent",
                  color: categoryFilter === cat.id ? cat.color : "var(--text3)",
                }}>{cat.emoji}</button>
              );
            })}
          </div>
        )}

        {/* 6.3 Habits 2-column grid */}
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>Today</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: "0.875rem" }}>
          {filteredHabits.map(habit => {
            const meta = habitMeta[habit.id.toString()];
            const cat = meta ? getCategoryById(meta.categoryId) : null;
            const hasTimer = Number(habit.targetDuration) > 0;
            return (
              <div key={habit.id.toString()} style={{
                width: "100%", minWidth: 0, boxSizing: "border-box",
                background: "var(--card-bg)", border: `1px solid ${cat ? cat.color + "50" : "var(--card-border)"}`,
                borderRadius: 14, padding: "0.75rem", display: "flex", flexDirection: "column", gap: 5,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 18 }}>{cat ? cat.emoji : "◆"}</span>
                  <button
                    onClick={() => selfCompleteHabit(Number(habit.id))}
                    disabled={isPending}
                    style={{
                      width: 22, height: 22, borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                      border: `1.5px solid var(--border2)`, background: "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                    }}
                  >✓</button>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {habit.name}
                </p>
                <p style={{ fontSize: 9, color: "var(--text3)", margin: 0 }}>
                  {hasTimer ? `⏱ ${Math.round(Number(habit.targetDuration) / 60)} min` : "✅ Tap to complete"}
                </p>
                {hasTimer && (
                  <Link href={`/timer?habitId=${habit.id.toString()}`} style={{
                    display: "flex", alignItems: "center", gap: 3, padding: "3px 6px", borderRadius: 6,
                    background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
                    textDecoration: "none",
                  }}>
                    <span style={{ fontSize: 8, color: "var(--accent-text)", fontWeight: 500 }}>▶ Start</span>
                  </Link>
                )}
              </div>
            );
          })}
          {/* Add habit card */}
          <button onClick={() => router.push("/habits")} style={{
            width: "100%", minWidth: 0, boxSizing: "border-box",
            background: "transparent", border: "1px dashed var(--border2)",
            borderRadius: 14, padding: "0.75rem",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 11, color: "var(--text3)", fontFamily: "inherit",
          }}>+ Add habit</button>
        </div>

        {/* 6.4 Circle section */}
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>Circle</p>
        {circle.length === 0 ? (
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 14, padding: "1rem", textAlign: "center", marginBottom: "0.875rem" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🤝</div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>No circle yet</p>
            <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: "0.75rem", lineHeight: 1.6 }}>Add friends to cheer each other on</p>
            <button onClick={() => router.push("/circle")} style={{ padding: "8px 16px", borderRadius: 20, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Add your first friend →
            </button>
          </div>
        ) : (
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 14, overflow: "hidden", marginBottom: "0.875rem" }}>
            {circle.slice(0, 3).map((addr, i) => {
              const name = getUsername(addr) ?? shortAddr(addr);
              const cheered = cheeredMap[addr] || !canCheer(addr);
              return (
                <div key={addr} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: i < Math.min(circle.length, 3) - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--accent-text)", flexShrink: 0 }}>
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text)", flex: 1 }}>{name}</span>
                  {!cheered ? (
                    <button onClick={() => handleCheer(addr)} style={{ padding: "4px 10px", borderRadius: 14, border: "1px solid var(--pink-border)", background: "var(--pink-bg)", color: "var(--pink-text)", fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      🌸 Cheer
                    </button>
                  ) : (
                    <span style={{ fontSize: 9, color: "var(--text3)" }}>Cheered! ✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 6.5 Leaderboard snapshot */}
        {leaderboard.length > 0 && (
          <>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>This week</p>
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 14, overflow: "hidden", marginBottom: "0.875rem" }}>
              {top2.map((e, i) => {
                const isMe = e.address.toLowerCase() === address?.toLowerCase();
                return (
                  <div key={e.address} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)", background: isMe ? "var(--accent-bg)" : "transparent" }}>
                    <span style={{ fontSize: 11, minWidth: 18, color: ["#f59e0b", "#94a3b8"][i] || "var(--text3)", fontWeight: 700 }}>#{i + 1}</span>
                    <span style={{ fontSize: 11, flex: 1, color: isMe ? "var(--accent-text)" : "var(--text)" }}>{getUsername(e.address) ?? shortAddr(e.address)}{isMe ? " (you)" : ""}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--streak-color)" }}>🔥 {e.streak.toString()}</span>
                  </div>
                );
              })}
              {meEntry && myRank > 2 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--accent-bg)" }}>
                  <span style={{ fontSize: 11, minWidth: 18, color: "var(--accent-text)", fontWeight: 700 }}>#{myRank}</span>
                  <span style={{ fontSize: 11, flex: 1, color: "var(--accent-text)" }}>{displayName} (you)</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--streak-color)" }}>🔥 {meEntry.streak.toString()}</span>
                </div>
              )}
              <div style={{ padding: "8px 12px", textAlign: "center" }}>
                <Link href="/leaderboard" style={{ fontSize: 10, color: "var(--accent-text)", textDecoration: "none", fontWeight: 600 }}>
                  See full leaderboard →
                </Link>
              </div>
            </div>
          </>
        )}

        {/* 6.6 Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: "1.5rem" }}>
          <button onClick={() => router.push("/timer")} style={{ padding: 12, borderRadius: 12, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ⚡ Start session
          </button>
          <button onClick={() => router.push("/habits")} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border2)", background: "transparent", color: "var(--text2)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
            + New habit
          </button>
        </div>
      </div>

      <TxToast hash={hash} pendingText="Recording habit…" successText="Done! ✓" />
    </div>
  );
}
