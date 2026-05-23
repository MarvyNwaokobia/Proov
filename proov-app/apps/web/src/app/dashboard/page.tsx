'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { getLeaderboard, getUserStats } from '@/lib/goldsky';
import { getUsernameForAddress, getUserHabits, getTodayCompletions, saveHabitCompletion, getStreakData, updateDailyStreak, getAllHabitStreaks, type Habit } from '@/lib/supabase';
import { useProovTx } from '@/hooks/useProovTx';
import { Walkthrough } from '@/components/shared/Walkthrough';
import {
  IconFlame,
  IconCheckbox,
  IconUsers,
  IconBolt,
  IconPlus,
  IconPlayerPlay,
  IconCheck,
  IconSettings2,
  IconTarget,
  IconHeart,
} from '@tabler/icons-react';

const STREAK_MILESTONES = [7, 14, 21, 30, 60, 90];
function getNextGoal(s: number) {
  for (const m of STREAK_MILESTONES) if (s < m) return m;
  return 120;
}
function getPrevGoal(s: number) {
  let p = 0;
  for (const m of STREAK_MILESTONES) { if (s < m) return p; p = m; }
  return STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
}

interface CircleMember {
  address: string;
  username: string;
  streak: number;
  completedHabitToday?: string;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Hey';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();
  const { address } = useAccount();

  const [username, setUsername] = useState('');
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);
  const [cheered, setCheered] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lbTop, setLbTop] = useState<{ name: string; streak: number }[]>([]);
  const [userRank, setUserRank] = useState(0);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [streakFlipped, setStreakFlipped] = useState(false);
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});
  const [canClaimFuel, setCanClaimFuel] = useState(false);
  const [claimingFuel, setClaimingFuel] = useState(false);
  const [celoBalance, setCeloBalance] = useState(0);
  const [secondsUntilClaim, setSecondsUntilClaim] = useState(0);
  const proovTx = useProovTx();

  useEffect(() => {
    const isAuth = localStorage.getItem('proov_authenticated') === 'true';
    if (!isAuth) router.replace('/');
  }, [router]);

  // Fuel faucet status
  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;

    const checkFuel = async () => {
      const { checkCanClaim, getUserCeloBalance } = await import('@/lib/fuel');
      const [claimStatus, balance] = await Promise.all([
        checkCanClaim(addr),
        getUserCeloBalance(addr),
      ]);
      setCanClaimFuel(claimStatus.canClaim);
      setSecondsUntilClaim(claimStatus.secondsLeft);
      setCeloBalance(balance);
    };

    checkFuel();
    const interval = setInterval(checkFuel, 60000);
    return () => clearInterval(interval);
  }, []);

  // Walkthrough — show once for new users, never for returning users
  useEffect(() => {
    const timer = setTimeout(() => {
      const alreadyDone =
        localStorage.getItem('proov_walkthrough_done') ||
        localStorage.getItem('proov_tutorial_done');
      const isNewUser = localStorage.getItem('proov_is_new_user') === 'true';
      if (!alreadyDone && isNewUser) {
        setShowWalkthrough(true);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    // Supabase first (most up to date across devices), then localStorage
    getUsernameForAddress(addr).then(remote => {
      if (remote) {
        setUsername(remote);
        localStorage.setItem('proov_username', remote);
      } else {
        const local =
          localStorage.getItem('proov_username') ||
          (() => {
            try {
              const raw = localStorage.getItem(`proov_username_${addr.toLowerCase()}`);
              return raw ? JSON.parse(raw).username : null;
            } catch { return null; }
          })();
        if (local) setUsername(local);
      }
    }).catch(() => {
      const local = localStorage.getItem('proov_username');
      if (local) setUsername(local);
    });
  }, []);

  // Load daily streak from Supabase (authoritative, cross-device)
  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;
    getStreakData(addr).then(data => {
      if (data.currentStreak > 0 || data.longestStreak > 0) {
        setCurrentStreak(data.currentStreak);
        setLongestStreak(data.longestStreak);
      }
    }).catch(() => {});
  }, []);

  // Load per-habit streaks whenever habits array changes
  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr || habits.length === 0) return;
    getAllHabitStreaks(habits.map(h => h.id), addr).then(setHabitStreaks).catch(() => {});
  }, [habits]);

  useEffect(() => {
    setMounted(true);
    const today = new Date().toDateString();

    // Habits — load from Supabase, fall back to cache
    const addr2 = localStorage.getItem('proov_address') || '';
    if (addr2) {
      Promise.all([getUserHabits(addr2), getTodayCompletions(addr2)])
        .then(([userHabits, todayDone]) => {
          setHabits(userHabits);
          setCompletedToday(todayDone);
          localStorage.setItem('proov_habits_cache', JSON.stringify(userHabits));
        })
        .catch(() => {
          const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
          setHabits(cached);
        });
    }

    // Streak — localStorage as fast initial value; Supabase effect above will override
    const streakRaw = localStorage.getItem('proov_streak_global');
    if (streakRaw) {
      try {
        const s = JSON.parse(streakRaw);
        setCurrentStreak(prev => prev || s.current || 0);
        setLongestStreak(prev => prev || s.longest || 0);
      } catch {}
    }

    // Circle members
    const circleRaw = localStorage.getItem('proov_circle');
    if (circleRaw) {
      try { setCircleMembers(JSON.parse(circleRaw)); } catch {}
    }

    // Today's cheers
    const cheeredRaw = localStorage.getItem(`proov_cheered_${today}`);
    if (cheeredRaw) {
      try { setCheered(JSON.parse(cheeredRaw)); } catch {}
    }

    // Goldsky leaderboard snapshot — only when authenticated
    const addr = localStorage.getItem('proov_address') || '';
    if (addr) {
      Promise.all([getLeaderboard(2), getUserStats(addr)]).then(([top, myStats]) => {
        if (top.length > 0) {
          setLbTop(top.map(e => ({ name: `@${e.id.slice(0, 8)}`, streak: e.currentStreak })));
        }
        if (myStats) {
          setCurrentStreak(myStats.currentStreak);
          setUserRank(myStats.rank);
        }
      });
    }
  }, [address]);

  const completedCount = completedToday.length;
  const totalHabits = habits.length;
  const progressPercent = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0;
  const totalCompletionDays = currentStreak;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const isToday = i === 6;
    return {
      label: dayNames[d.getDay()],
      dateStr: d.toISOString().split('T')[0],
      isToday,
      completed: isToday ? completedToday.length > 0 : false,
    };
  });

  const handleToggleHabit = async (habitId: string) => {
    if (completedToday.includes(habitId)) return;
    const addr = localStorage.getItem('proov_address') || '';
    const newCompleted = [...completedToday, habitId];

    setCompletedToday(newCompleted);
    // Optimistically bump this habit's streak in the UI
    setHabitStreaks(prev => ({ ...prev, [habitId]: (prev[habitId] || 0) + 1 }));
    showToast('Saved ✓');

    await saveHabitCompletion(habitId, addr, currentStreak).catch(() => {});

    const habit = habits.find(h => h.id === habitId);
    proovTx.completeHabit((habit as any)?.on_chain_id || 0);

    // Increment daily streak when ALL habits are done
    const allDone = habits.every(h => newCompleted.includes(h.id));
    if (allDone && habits.length > 0) {
      const newStreak = await updateDailyStreak(addr).catch(() => currentStreak + 1);
      setCurrentStreak(newStreak);
      setLongestStreak(prev => Math.max(prev, newStreak));
      proovTx.recordStreakIncrement(newStreak);
      showToast(`${newStreak} day streak!`);
    }
  };

  const handleCheer = (memberAddress: string) => {
    const today = new Date().toDateString();
    const key = `proov_cheered_${today}`;
    const updated = { ...cheered, [memberAddress]: true };
    setCheered(updated);
    localStorage.setItem(key, JSON.stringify(updated));
    showToast('Cheer sent!');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const handleClaimFuel = async () => {
    if (!canClaimFuel || claimingFuel) return;
    setClaimingFuel(true);

    const { claimFuel, getUserCeloBalance } = await import('@/lib/fuel');
    const result = await claimFuel();

    if (result.success) {
      showToast('Fuel claimed!');
      setCanClaimFuel(false);
      setSecondsUntilClaim(86400);
      const addr = localStorage.getItem('proov_address') || '';
      const newBalance = await getUserCeloBalance(addr);
      setCeloBalance(newBalance);
    } else {
      showToast(result.error || 'Could not claim fuel');
    }

    setClaimingFuel(false);
  };

  const displayName = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : 'there';

  const greeting = `${getGreeting()}, ${displayName}`;
  const subtitle = formatDate();

  // Don't render until mounted to avoid hydration mismatch on date/greeting
  if (!mounted) return null;

  return (
    <>
      <div className="blobs">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>
      <div className="top-bar" />

      <div className="page-wrap" style={{ paddingTop: 18 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div data-wt="wt-greeting">
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {greeting}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {subtitle}
            </div>
          </div>

          <div data-wt="wt-fuel" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canClaimFuel ? (
              <button
                onClick={handleClaimFuel}
                disabled={claimingFuel}
                style={{
                  padding: '6px 12px', borderRadius: 20,
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  border: 'none', color: '#fff',
                  fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
                  animation: 'pulse 2s ease-in-out infinite',
                }}>
                <IconBolt size={13} stroke={2} />
                {claimingFuel ? 'Claiming…' : 'Claim fuel'}
              </button>
            ) : celoBalance > 0 ? (
              <div style={{
                padding: '6px 12px', borderRadius: 20,
                background: 'var(--bg2)', border: '1px solid var(--border)',
                color: 'var(--text3)', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <IconBolt size={13} stroke={2} /> {celoBalance.toFixed(3)} Fuel
              </div>
            ) : null}

            <button onClick={() => router.push('/settings')} style={{
              background: 'transparent', border: 'none',
              color: 'var(--text3)', cursor: 'pointer', padding: 4,
            }}>
              <IconSettings2 size={20} stroke={1.8} />
            </button>
          </div>
        </div>

        {/* Streak card — flippable */}
        {!streakFlipped ? (
          <div
            id="wt-streak-card"
            data-wt="wt-streak-card"
            onClick={() => setStreakFlipped(true)}
            style={{
              background: 'var(--btn-primary-bg)',
              borderRadius: 16, padding: 16,
              marginBottom: 14, color: '#fff',
              cursor: 'pointer',
              transition: 'filter 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.06)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Current streak
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>{currentStreak}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 4 }}>days <IconFlame size={14} stroke={2} /></span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                Best
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{longestStreak}</div>
              </div>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 12 }}>
              <div style={{ height: '100%', background: 'rgba(255,255,255,0.85)', borderRadius: 2, width: `${progressPercent}%`, transition: 'width .4s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
              {totalHabits === 0
                ? 'Add a habit to start your streak'
                : `${completedCount} of ${totalHabits} habits done today · tap for details`}
            </div>
          </div>
        ) : (
          <div onClick={() => setStreakFlipped(false)} style={{
            background: 'var(--btn-primary-bg)', borderRadius: 16, padding: 16,
            marginBottom: 14, cursor: 'pointer', color: '#fff',
          }}>
            {(() => {
              const goal = getNextGoal(currentStreak);
              const prev = getPrevGoal(currentStreak);
              const range = goal - prev;
              const elapsed = currentStreak - prev;
              const pct = range > 0 ? Math.min(100, (elapsed / range) * 100) : 100;
              const daysLeft = Math.max(0, goal - currentStreak);
              const displayMilestones = [7, 14, 21, 30];
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    <IconTarget size={13} stroke={2} color="rgba(255,255,255,0.65)" /> Goal Progress · tap to flip
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>{goal}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>day milestone</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{daysLeft}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>days to go</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 5 }}>
                      <span>Day {currentStreak} of {goal}</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(255,255,255,0.9)', borderRadius: 3, transition: 'width .4s ease' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {displayMilestones.map(m => {
                      const done = currentStreak >= m;
                      const isCurrent = m === goal;
                      return (
                        <div key={m} style={{
                          flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 8, fontSize: 9, fontWeight: 700,
                          background: done ? 'rgba(255,255,255,0.9)' : isCurrent ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                          border: isCurrent && !done ? '1.5px solid rgba(255,255,255,0.5)' : 'none',
                          color: done ? 'var(--btn-primary-bg)' : 'rgba(255,255,255,0.85)',
                        }}>
                          {done ? '✓' : ''}{m}d
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Today's habits */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-label" style={{ margin: '0 0 0.625rem' }}>Today</div>
          <Link href="/habits" className="pill-link">Manage →</Link>
        </div>

        {habits.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <IconCheckbox size={28} stroke={1.5} color="var(--accent)" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>No habits yet</p>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
              Add a habit to start your streak
            </p>
            <Link href="/habits" className="create-btn" style={{ padding: '9px 18px', borderRadius: 20 }}>
              <IconPlus size={14} stroke={2} /> Create first habit
            </Link>
          </div>
        ) : (
          <div id="wt-habits-grid" data-wt="wt-habits-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem', width: '100%' }}>
            {habits.map(habit => {
              const isDone = completedToday.includes(habit.id);
              return (
                <div key={habit.id} style={{ background: 'var(--card-bg)', border: `1px solid ${isDone ? 'var(--accent-border)' : 'var(--card-border)'}`, borderRadius: 14, padding: '12px', opacity: isDone ? 0.7 : 1, transition: 'all 0.2s ease' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{habit.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>
                    {habit.type === 'timed' ? `${habit.duration_minutes}m · ${habit.schedule}` : `Tap · ${habit.schedule}`}
                  </div>
                  {habit.type === 'timed' ? (
                    <button onClick={() => router.push('/timer')} disabled={isDone} style={{ width: '100%', padding: '6px 0', borderRadius: 8, border: 'none', background: isDone ? 'var(--bg2)' : 'var(--btn-primary-bg)', color: isDone ? 'var(--text3)' : 'var(--btn-primary-text)', fontSize: 11, fontWeight: 600, cursor: isDone ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      {isDone ? 'Done ✓' : '▶ Start'}
                    </button>
                  ) : (
                    <button onClick={() => handleToggleHabit(habit.id)} style={{ width: '100%', padding: '6px 0', borderRadius: 8, border: '1.5px solid', borderColor: isDone ? 'var(--accent)' : 'var(--border2)', background: isDone ? 'var(--accent)' : 'transparent', color: isDone ? '#fff' : 'var(--text2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease' }}>
                      {isDone ? '✓ Done' : 'Mark done'}
                    </button>
                  )}
                </div>
              );
            })}
            {/* Add habit cell */}
            <button id="wt-add-habit" data-wt="wt-add-habit" onClick={() => router.push('/habits')} style={{ border: '2px dashed var(--border2)', borderRadius: 14, padding: '12px', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 100 }}>
              <IconPlus size={22} stroke={1.5} color="var(--text3)" />
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', marginTop: 4 }}>Add habit</span>
            </button>
          </div>
        )}

        {/* Circle section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-label" style={{ margin: '0 0 0.625rem' }}>Circle</div>
          <Link href="/circle" className="pill-link">Manage →</Link>
        </div>

        {circleMembers.length === 0 ? (
          <div data-wt="wt-circle" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '1.25rem', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <IconUsers size={28} stroke={1.5} color="var(--accent)" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>No circle yet</p>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
              Add friends to cheer each other on and stay accountable
            </p>
            <Link href="/circle" style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              Invite someone →
            </Link>
          </div>
        ) : (
          <div data-wt="wt-circle" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(circleMembers.length, 3)}, 1fr)`, gap: 8, marginBottom: '1rem' }}>
            {circleMembers.slice(0, 3).map(member => {
              const canCheer = !!member.completedHabitToday && !cheered[member.address];
              const alreadyCheered = cheered[member.address];
              return (
                <div key={member.address} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', margin: '0 auto 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                    {(member.username || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    @{member.username}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}><IconFlame size={10} stroke={2} />{member.streak}</div>
                  {member.completedHabitToday && (
                    <div style={{ fontSize: 8, color: 'var(--accent-text)', margin: '3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ✓ {member.completedHabitToday}
                    </div>
                  )}
                  {canCheer && (
                    <button
                      onClick={() => handleCheer(member.address)}
                      style={{
                        display: 'block', width: '100%', marginTop: 6, padding: '4px 0',
                        borderRadius: 7, border: '1px solid var(--pink-border)',
                        background: 'var(--pink-bg)', color: 'var(--pink-text)',
                        fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'transform .2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = '')}
                    >
                      <IconHeart size={10} stroke={2} /> Cheer
                    </button>
                  )}
                  {alreadyCheered && (
                    <div style={{ marginTop: 6, padding: '4px 0', borderRadius: 7, background: 'var(--pink)', color: '#fff', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                      <IconHeart size={10} stroke={2} /> Cheered
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Leaderboard snapshot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-label" style={{ margin: '0 0 0.625rem' }}>Leaderboard</div>
          <Link href="/leaderboard" className="pill-link">See all →</Link>
        </div>
        <div id="wt-leaderboard" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', marginBottom: '1rem' }}>
          {[
            ...(lbTop.length >= 2
              ? [
                  { rank: '1', rankColor: '#f59e0b', name: lbTop[0].name, streak: lbTop[0].streak, isMe: false },
                  { rank: '2', rankColor: '#94a3b8', name: lbTop[1].name, streak: lbTop[1].streak, isMe: false },
                ]
              : [
                  { rank: '1', rankColor: '#f59e0b', name: '@—', streak: 0, isMe: false },
                  { rank: '2', rankColor: '#94a3b8', name: '@—', streak: 0, isMe: false },
                ]),
            { rank: userRank ? `#${userRank}` : '—', rankColor: 'var(--accent-text)', name: `You · @${displayName}`, streak: currentStreak, isMe: true },
          ].map((row, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px',
              borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
              background: row.isMe ? 'var(--accent-bg)' : 'transparent',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 22, color: row.rankColor }}>
                {row.rank}
              </span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{row.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--streak-color, var(--amber))', display: 'flex', alignItems: 'center', gap: 3 }}>
                <IconFlame size={13} stroke={2} /> {row.streak}
              </span>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, paddingBottom: '1rem' }}>
          <button
            onClick={() => router.push('/timer')}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              background: 'var(--btn-primary-bg)', border: 'none',
              color: 'var(--btn-primary-text)', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <IconPlayerPlay size={14} stroke={2} /> Start session
          </button>
          <button
            onClick={() => router.push('/habits')}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              background: 'transparent',
              border: '2px solid var(--accent-border)',
              color: 'var(--accent-text)', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            + New habit
          </button>
        </div>

      </div>

      {/* Toast */}
      <div className={`toast ${toastVisible ? 'show' : ''}`}>{toast}</div>

      {showWalkthrough && (
        <Walkthrough onComplete={() => {
          setShowWalkthrough(false);
          localStorage.removeItem('proov_is_new_user');
        }} />
      )}
    </>
  );
}
