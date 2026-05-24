'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getUsernameForAddress, getUserHabits, getTodayCompletions, saveHabitCompletion,
  getStreakData, updateDailyStreak, getAllHabitStreaks,
  getCircleRequests, getUsernamesForAddresses, getLatestActivityForAddress,
  sendNudge, getTodayNudgesSent, getGlobalLeaderboard,
  type Habit,
} from '@/lib/supabase';
import { useProovTx } from '@/hooks/useProovTx';
import { Walkthrough } from '@/components/shared/Walkthrough';
import {
  IconFlame,
  IconUsers,
  IconPlus,
  IconPlayerPlay,
  IconSettings2,
  IconTarget,
  IconHeart,
  IconBell,
  IconCheck,
  IconBolt,
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
  lastCompletionDate: string | null;
  activityName: string | null;
  activityTime: string | null;
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

  const [username, setUsername] = useState('');
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);
  const [cheered, setCheered] = useState<Record<string, boolean>>({});
  const [nudgedMap, setNudgedMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lbEntries, setLbEntries] = useState<{ address: string; username: string; streak: number }[]>([]);
  const [userRank, setUserRank] = useState(0);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [streakFlipped, setStreakFlipped] = useState(false);
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});
  const [fuelBalance, setFuelBalance] = useState(0);
  const proovTx = useProovTx();

  useEffect(() => {
    const isAuth = localStorage.getItem('proov_authenticated') === 'true';
    if (!isAuth) router.replace('/');
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const alreadyDone = localStorage.getItem('proov_walkthrough_done') || localStorage.getItem('proov_tutorial_done');
      const isNewUser = localStorage.getItem('proov_is_new_user') === 'true';
      if (!alreadyDone && isNewUser) setShowWalkthrough(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    getUsernameForAddress(addr).then(remote => {
      if (remote) { setUsername(remote); localStorage.setItem('proov_username', remote); }
      else {
        const local = localStorage.getItem('proov_username') ||
          (() => { try { const r = localStorage.getItem(`proov_username_${addr.toLowerCase()}`); return r ? JSON.parse(r).username : null; } catch { return null; } })();
        if (local) setUsername(local);
      }
    }).catch(() => { const l = localStorage.getItem('proov_username'); if (l) setUsername(l); });
  }, []);

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

  // Load global leaderboard from Supabase
  useEffect(() => {
    const addr = (localStorage.getItem('proov_address') || '').toLowerCase();
    if (!addr) return;
    getGlobalLeaderboard(50).then(async rows => {
      const addrs = rows.map(r => r.address);
      const usernameMap = addrs.length > 0
        ? await getUsernamesForAddresses(addrs).catch(() => ({} as Record<string, string>))
        : {};
      const entries = rows.map(r => ({ address: r.address, username: usernameMap[r.address] || r.address.slice(0, 8), streak: r.streak }));
      setLbEntries(entries);
      const myIdx = entries.findIndex(e => e.address === addr);
      if (myIdx >= 0) { setUserRank(myIdx + 1); localStorage.setItem('proov_leaderboard_rank', String(myIdx + 1)); }
    }).catch(() => {});
  }, []);

  // Load circle members
  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;
    const addrLower = addr.toLowerCase();
    const today = new Date().toDateString();
    const load = async () => {
      const { accepted } = await getCircleRequests(addr).catch(() => ({ sent: [], received: [], accepted: [] }));
      if (accepted.length === 0) return;
      const memberAddrs = accepted.map(req => req.from_address === addrLower ? req.to_address : req.from_address);
      const [usernameMap, streaks, activities, nudgedToday] = await Promise.all([
        getUsernamesForAddresses(memberAddrs).catch(() => ({} as Record<string, string>)),
        Promise.all(memberAddrs.map(a => getStreakData(a).catch(() => null))),
        Promise.all(memberAddrs.map(a => getLatestActivityForAddress(a).catch(() => null))),
        getTodayNudgesSent(addr).catch(() => [] as string[]),
      ]);
      setCircleMembers(memberAddrs.map((a, i) => ({
        address: a,
        username: usernameMap[a] || a.slice(0, 8),
        streak: streaks[i]?.currentStreak ?? 0,
        lastCompletionDate: streaks[i]?.lastCompletionDate ?? null,
        activityName: activities[i]?.habitName ?? null,
        activityTime: activities[i]?.completedAt ?? null,
      })));
      if (nudgedToday.length > 0) {
        setNudgedMap(prev => { const n = { ...prev }; nudgedToday.forEach(a => { n[a] = true; }); return n; });
      }
      const cheeredState: Record<string, boolean> = {};
      memberAddrs.forEach(a => { if (localStorage.getItem(`proov_cheered_${a}_${today}`)) cheeredState[a] = true; });
      if (Object.keys(cheeredState).length > 0) setCheered(cheeredState);
    };
    load();
  }, []);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr || habits.length === 0) return;
    getAllHabitStreaks(habits.map(h => h.id), addr).then(setHabitStreaks).catch(() => {});
  }, [habits]);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;
    const onVisible = () => { if (!document.hidden) getTodayCompletions(addr).then(setCompletedToday).catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    setMounted(true);
    const addr = localStorage.getItem('proov_address') || '';
    if (addr) {
      Promise.all([getUserHabits(addr), getTodayCompletions(addr)])
        .then(([userHabits, todayDone]) => {
          setHabits(userHabits);
          setCompletedToday(todayDone);
          localStorage.setItem('proov_habits_cache', JSON.stringify(userHabits));
          // If every habit was already completed today (e.g. via timer / habits page),
          // fire the streak update now so the daily streak accumulates correctly.
          if (userHabits.length > 0 && userHabits.every((h: any) => todayDone.includes(h.id))) {
            updateDailyStreak(addr).then(newStreak => {
              setCurrentStreak(newStreak);
              setLongestStreak(prev => Math.max(prev, newStreak));
            }).catch(() => {});
          }
        })
        .catch(() => {
          const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
          setHabits(cached);
        });
    }
    const streakRaw = localStorage.getItem('proov_streak_global');
    if (streakRaw) {
      try { const s = JSON.parse(streakRaw); setCurrentStreak(prev => prev || s.current || 0); setLongestStreak(prev => prev || s.longest || 0); } catch {}
    }
    // Load fuel balance (cached from settings page visits)
    const bal = parseFloat(localStorage.getItem('proov_fuel_balance') || '0');
    if (bal > 0) setFuelBalance(bal);
    // Try to load it fresh
    import('@/lib/fuel').then(({ getUserCeloBalance }) => {
      getUserCeloBalance(addr).then(b => { setFuelBalance(b); localStorage.setItem('proov_fuel_balance', String(b)); }).catch(() => {});
    }).catch(() => {});
  }, []);

  const completedCount = completedToday.length;
  const totalHabits = habits.length;
  const progressPercent = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0;

  // Build last 7 days for streak card
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const isToday = i === 6;
    const filled = isToday ? completedToday.length > 0 : i < 6 && currentStreak > (6 - i);
    return { label: dayNames[d.getDay()], isToday, filled };
  });

  const handleToggleHabit = async (habitId: string) => {
    if (completedToday.includes(habitId)) return;
    const addr = localStorage.getItem('proov_address') || '';
    const newCompleted = [...completedToday, habitId];
    setCompletedToday(newCompleted);
    setHabitStreaks(prev => ({ ...prev, [habitId]: (prev[habitId] || 0) + 1 }));
    showToast('Done ✓');
    await saveHabitCompletion(habitId, addr, currentStreak).catch(() => {});
    const habit = habits.find(h => h.id === habitId);
    proovTx.completeHabit((habit as any)?.on_chain_id || 0);
    const allDone = habits.every(h => newCompleted.includes(h.id));
    if (allDone && habits.length > 0) {
      const newStreak = await updateDailyStreak(addr).catch(() => currentStreak + 1);
      setCurrentStreak(newStreak);
      setLongestStreak(prev => Math.max(prev, newStreak));
      proovTx.recordStreakIncrement(newStreak);
      showToast(`${newStreak} day streak! 🔥`);
    }
  };

  const handleCheer = (memberAddress: string) => {
    const today = new Date().toDateString();
    localStorage.setItem(`proov_cheered_${memberAddress}_${today}`, '1');
    setCheered(prev => ({ ...prev, [memberAddress]: true }));
    showToast('Cheer sent!');
  };

  const handleNudge = async (memberAddress: string, memberUsername: string) => {
    const myAddr = localStorage.getItem('proov_address') || '';
    setNudgedMap(prev => ({ ...prev, [memberAddress]: true }));
    const ok = await sendNudge(myAddr, memberAddress).catch(() => false);
    if (ok) showToast(`Nudge sent to @${memberUsername}!`);
    else { setNudgedMap(prev => { const n = { ...prev }; delete n[memberAddress]; return n; }); showToast('Could not send nudge'); }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const displayName = username ? username.charAt(0).toUpperCase() + username.slice(1) : 'there';
  const myLbEntry = lbEntries.find(e => e.address === (localStorage.getItem('proov_address') || '').toLowerCase());

  if (!mounted) return null;

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /></div>
      <div className="top-bar" />
      <div className="page-wrap" style={{ paddingTop: 18, paddingBottom: 100 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {getGreeting()}, {displayName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDate()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {fuelBalance > 0 && (
              <div style={{ padding: '5px 10px', borderRadius: 20, background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <IconBolt size={12} stroke={2} />
                {Math.floor(fuelBalance)} Fuel
              </div>
            )}
            <button onClick={() => router.push('/settings')} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', cursor: 'pointer' }}>
              <IconSettings2 size={14} stroke={1.8} />
            </button>
          </div>
        </div>

        {/* ── Streak flip card ── */}
        <div style={{ marginBottom: 16, borderRadius: 18, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setStreakFlipped(f => !f)}>
          {!streakFlipped ? (
            /* Front: current streak + week grid */
            <div style={{ background: 'var(--streak-hero-bg, var(--btn-primary-bg))', padding: '16px 18px', color: '#fff', borderRadius: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Current streak</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>{currentStreak}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                      <IconFlame size={15} stroke={2} />days
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '7px 10px' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>Goal</div>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{getNextGoal(currentStreak)}d</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                    {Math.max(0, getNextGoal(currentStreak) - currentStreak)} to go
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                  <span>Today</span>
                  <span>{completedCount} of {totalHabits} done</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${progressPercent}%`, background: 'rgba(255,255,255,0.85)', borderRadius: 2, transition: 'width .4s ease' }} />
                </div>
              </div>
              {/* 7-day week dots */}
              <div style={{ display: 'flex', gap: 4 }}>
                {last7.map((day, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{day.label}</div>
                    <div style={{
                      width: '100%', aspectRatio: '1', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                      background: day.filled ? 'rgba(255,255,255,0.85)' : day.isToday ? 'transparent' : 'rgba(255,255,255,0.12)',
                      border: day.isToday && !day.filled ? '2px solid rgba(255,255,255,0.5)' : 'none',
                      color: day.filled ? 'var(--btn-primary-bg)' : day.isToday ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
                    }}>
                      {day.filled ? '✓' : day.isToday ? '·' : ''}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 6, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                ↺ Tap for goal
              </div>
            </div>
          ) : (
            /* Back: goal milestones */
            <div style={{ background: 'var(--streak-hero-bg, var(--btn-primary-bg))', padding: '16px 18px', color: '#fff', borderRadius: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                <IconTarget size={13} stroke={2} color="rgba(255,255,255,0.6)" /> Goal Progress
              </div>
              {(() => {
                const goal = getNextGoal(currentStreak);
                const prev = getPrevGoal(currentStreak);
                const range = goal - prev;
                const elapsed = currentStreak - prev;
                const pct = range > 0 ? Math.min(100, (elapsed / range) * 100) : 100;
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
                      <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>{goal}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>day milestone</span>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 5 }}>
                        <span>Day {currentStreak} of {goal}</span>
                        <span>{Math.max(0, goal - currentStreak)} days to go</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(255,255,255,0.9)', borderRadius: 3, transition: 'width .4s ease' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                      {[7, 14, 21, 30].map(m => {
                        const done = currentStreak >= m;
                        const isCurrent = m === goal;
                        return (
                          <div key={m} style={{
                            flex: 1, textAlign: 'center', padding: '6px 2px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                            background: done ? 'rgba(255,255,255,0.9)' : isCurrent ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                            border: isCurrent && !done ? '1.5px solid rgba(255,255,255,0.5)' : 'none',
                            color: done ? 'var(--btn-primary-bg)' : 'rgba(255,255,255,0.85)',
                          }}>
                            {done ? '✓ ' : ''}{m}d
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                      Hit {goal} days → next goal becomes {getNextGoal(goal)}d
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>↺ Tap to go back</div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── TODAY habits 2-col grid ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)' }}>TODAY</span>
          <Link href="/habits" style={{ fontSize: 11, color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>Manage →</Link>
        </div>

        {habits.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>No habits yet</p>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.6 }}>Add a habit to start your streak</p>
            <Link href="/habits" style={{ padding: '9px 18px', borderRadius: 20, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 11, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IconPlus size={13} stroke={2} /> Create first habit
            </Link>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              {habits.map(habit => {
                const isDone = completedToday.includes(habit.id);
                const habitStreak = habitStreaks[habit.id] || 0;
                return (
                  <div
                    key={habit.id}
                    onClick={() => {
                      if (habit.type === 'checkbox') { if (!isDone) handleToggleHabit(habit.id); }
                      else { isDone ? router.push(`/habits/${habit.id}`) : router.push(`/timer?habitId=${habit.id}&autostart=1`); }
                    }}
                    style={{
                      background: 'var(--card-bg)',
                      border: `1px solid ${isDone ? 'var(--accent-border)' : 'var(--card-border)'}`,
                      borderRadius: 14, padding: 11,
                      cursor: isDone && habit.type === 'checkbox' ? 'default' : 'pointer',
                      opacity: isDone ? 0.78 : 1,
                      display: 'flex', flexDirection: 'column',
                    }}>
                    {/* Emoji icon */}
                    <div style={{ marginBottom: 5, fontSize: 22, color: 'var(--accent-text)', lineHeight: 1 }}>
                      {habit.emoji}
                    </div>
                    {/* Name */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {habit.name}
                    </div>
                    {/* Detail */}
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 3 }}>
                      {habit.type === 'timed' ? `${habit.duration_minutes}m` : 'Checkbox'}
                      {habitStreak > 0 && <> · <IconFlame size={8} stroke={2} color="#f59e0b" />{habitStreak}d</>}
                      {isDone && ' · Done'}
                    </div>
                    {/* Action button */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (habit.type === 'checkbox') { if (!isDone) handleToggleHabit(habit.id); }
                        else { isDone ? router.push(`/habits/${habit.id}`) : router.push(`/timer?habitId=${habit.id}&autostart=1`); }
                      }}
                      style={{
                        width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: isDone && habit.type === 'checkbox' ? 'default' : 'pointer',
                        border: isDone ? 'none' : '1.5px solid var(--border2)',
                        background: isDone ? 'var(--accent)' : 'transparent',
                        color: isDone ? '#fff' : 'var(--text2)',
                        fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      {isDone ? (
                        <><IconCheck size={11} stroke={2.5} /> Done</>
                      ) : habit.type === 'timed' ? (
                        <><IconPlayerPlay size={11} stroke={2} /> Start</>
                      ) : (
                        'Mark done'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Add habit — full width */}
            <button
              onClick={() => router.push('/habits')}
              style={{
                width: '100%', padding: 12, borderRadius: 13,
                border: '2px dashed var(--border2)', background: 'transparent',
                cursor: 'pointer', color: 'var(--text3)', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <IconPlus size={14} stroke={2} /> Add habit
            </button>
          </div>
        )}

        {/* ── CIRCLE ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)' }}>CIRCLE</span>
          <Link href="/circle" style={{ fontSize: 11, color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>Manage →</Link>
        </div>

        {circleMembers.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '1.25rem', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <IconUsers size={28} stroke={1.5} color="var(--accent)" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>No circle yet</p>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.6 }}>Add friends to cheer each other on</p>
            <Link href="/circle" style={{ padding: '8px 16px', borderRadius: 20, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              Invite someone →
            </Link>
          </div>
        ) : (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
            {circleMembers.slice(0, 3).map((member, i) => {
              const todayIso = new Date().toISOString().split('T')[0];
              const activeToday = member.lastCompletionDate === todayIso;
              const alreadyCheered = cheered[member.address];
              const alreadyNudged = nudgedMap[member.address];
              return (
                <div key={member.address} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                  borderBottom: i < Math.min(circleMembers.length, 3) - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--accent-text)',
                  }}>
                    {(member.username || '?').slice(0, 2).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      @{member.username}
                    </div>
                    <div style={{ fontSize: 10, color: activeToday ? 'var(--accent-text)' : 'var(--text3)', marginTop: 1 }}>
                      {activeToday ? (member.activityName ? `${member.activityName} done` : 'Done today') : 'No activity yet today'}
                    </div>
                  </div>
                  {/* Action */}
                  {activeToday ? (
                    alreadyCheered ? (
                      <span style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <IconCheck size={10} stroke={2.5} /> Cheered
                      </span>
                    ) : (
                      <button onClick={() => handleCheer(member.address)} style={{ flexShrink: 0, padding: '5px 9px', borderRadius: 8, border: '1px solid var(--pink-text, #f43f5e)', background: 'var(--pink-bg, rgba(244,63,94,0.08))', color: 'var(--pink-text, #f43f5e)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                        <IconHeart size={10} stroke={2} /> Cheer
                      </button>
                    )
                  ) : (
                    alreadyNudged ? (
                      <span style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <IconCheck size={10} stroke={2.5} /> Nudged
                      </span>
                    ) : (
                      <button onClick={() => handleNudge(member.address, member.username)} style={{ flexShrink: 0, padding: '5px 9px', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text3)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                        <IconBell size={10} stroke={1.8} /> Nudge
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── LEADERBOARD snippet ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)' }}>LEADERBOARD</span>
          <Link href="/leaderboard" style={{ fontSize: 11, color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>See all →</Link>
        </div>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
          {[
            lbEntries[0] ?? { username: '—', streak: 0, address: '' },
            lbEntries[1] ?? { username: '—', streak: 0, address: '' },
          ].map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 800, minWidth: 22, color: i === 0 ? '#f59e0b' : '#9ca3af' }}>#{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>@{entry.username}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
                <IconFlame size={12} stroke={2} /> {entry.streak}
              </span>
            </div>
          ))}
          {/* Current user row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--accent-bg)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, minWidth: 22, color: 'var(--accent-text)' }}>
              {userRank > 0 ? `#${userRank}` : '—'}
            </span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              You · @{username || displayName}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
              <IconFlame size={12} stroke={2} /> {currentStreak}
            </span>
          </div>
        </div>

      </div>

      {/* Toast */}
      <div className={`toast ${toastVisible ? 'show' : ''}`}>{toast}</div>

      {showWalkthrough && (
        <Walkthrough onComplete={() => { setShowWalkthrough(false); localStorage.removeItem('proov_is_new_user'); }} />
      )}
    </>
  );
}
