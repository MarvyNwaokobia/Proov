'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { getLeaderboard, getUserStats } from '@/lib/goldsky';
import { getUsernameForAddress, getUserHabits, getTodayCompletions, saveHabitCompletion, type Habit } from '@/lib/supabase';
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
} from '@tabler/icons-react';

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

  useEffect(() => {
    const isAuth = localStorage.getItem('proov_authenticated') === 'true';
    if (!isAuth) router.replace('/');
  }, [router]);

  // Walkthrough — standalone effect, runs once on mount after 1.2s
  useEffect(() => {
    const timer = setTimeout(() => {
      const tutorialDone = localStorage.getItem('proov_tutorial_done');
      const isNewUser = localStorage.getItem('proov_is_new_user') === 'true';
      if (!tutorialDone && isNewUser) {
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

    // Streak
    const streakRaw = localStorage.getItem('proov_streak_global');
    if (streakRaw) {
      try {
        const s = JSON.parse(streakRaw);
        setCurrentStreak(s.current || 0);
        setLongestStreak(s.longest || 0);
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
    d.setDate(d.getDate() - 6 + i);
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const isToday = i === 6;
    return {
      label: dayNames[d.getDay()],
      completed: isToday ? completedToday.length > 0 : false,
      isToday,
    };
  });

  const handleToggleHabit = async (habitId: string) => {
    if (completedToday.includes(habitId)) return;
    const addr = localStorage.getItem('proov_address') || '';
    setCompletedToday(prev => [...prev, habitId]);
    showToast('Saved ✓');
    const streak = parseInt(localStorage.getItem('proov_streak_count') || '0');
    await saveHabitCompletion(habitId, addr, streak).catch(() => {});
    updateStreak(true);
  };

  const updateStreak = (hasCompletion: boolean) => {
    if (!hasCompletion) return;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const raw = localStorage.getItem('proov_streak_global');
    const streak = raw ? JSON.parse(raw) : { current: 0, longest: 0, lastDate: '' };
    if (streak.lastDate === today) return;
    streak.current = streak.lastDate === yesterday ? streak.current + 1 : 1;
    streak.lastDate = today;
    if (streak.current > streak.longest) streak.longest = streak.current;
    localStorage.setItem('proov_streak_global', JSON.stringify(streak));
    setCurrentStreak(streak.current);
    setLongestStreak(streak.longest);
  };

  const handleCheer = (memberAddress: string) => {
    const today = new Date().toDateString();
    const key = `proov_cheered_${today}`;
    const updated = { ...cheered, [memberAddress]: true };
    setCheered(updated);
    localStorage.setItem(key, JSON.stringify(updated));
    showToast('🌸 Cheer sent!');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const displayName = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : 'there';

  const greeting = `${getGreeting()}, ${displayName} 👋`;
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {greeting}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              {subtitle}
            </div>
          </div>
          <Link href="/settings" style={{ textDecoration: 'none', lineHeight: 1, marginTop: 2 }} title="Settings">
            <IconSettings2 size={20} stroke={1.8} color="var(--text3)" />
          </Link>
        </div>

        {/* Streak card — flippable */}
        {!streakFlipped ? (
          <div
            id="wt-streak-card"
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
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>days 🔥</span>
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
          <div
            onClick={() => setStreakFlipped(false)}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 16, padding: 16,
              marginBottom: 14, cursor: 'pointer',
            }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 12 }}>
              Streak details · tap to flip back
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[
                { num: currentStreak, label: 'Current', color: 'var(--accent-text)' },
                { num: longestStreak, label: 'All-time best', color: 'var(--text)' },
                { num: totalCompletionDays, label: 'Total days', color: 'var(--text)' },
              ].map(s => (
                <div key={s.label} style={{
                  flex: 1, background: 'var(--bg2)', borderRadius: 12, padding: 10, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.num}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {last7Days.map((day, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{day.label}</div>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: day.completed ? 'var(--btn-primary-bg)' : day.isToday ? 'transparent' : 'var(--bg2)',
                    border: day.isToday ? '2px solid var(--accent-border)' : day.completed ? 'none' : '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: day.completed ? '#fff' : day.isToday ? 'var(--accent-text)' : 'var(--text3)',
                  }}>
                    {day.completed ? '✓' : day.isToday ? '•' : ''}
                  </div>
                </div>
              ))}
            </div>
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
          <div id="wt-habits-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem', width: '100%' }}>
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
            <button id="wt-add-habit" onClick={() => router.push('/habits')} style={{ border: '2px dashed var(--border2)', borderRadius: 14, padding: '12px', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 100 }}>
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
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '1.25rem', textAlign: 'center', marginBottom: '1rem' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(circleMembers.length, 3)}, 1fr)`, gap: 8, marginBottom: '1rem' }}>
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
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>🔥 {member.streak}</div>
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
                      🌸 Cheer
                    </button>
                  )}
                  {alreadyCheered && (
                    <div style={{ marginTop: 6, padding: '4px 0', borderRadius: 7, background: 'var(--pink)', color: '#fff', fontSize: 9, fontWeight: 600 }}>
                      🌸 Cheered!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Group habits — coming soon */}
        <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 14, padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.8 }}>
          <IconUsers size={22} stroke={1.5} color="var(--text3)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Group habits</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>Do habits together with friends. One squad, one streak.</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'var(--accent-bg)', color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>
            Coming soon
          </span>
        </div>

        {/* Leaderboard snapshot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-label" style={{ margin: '0 0 0.625rem' }}>Leaderboard</div>
          <Link href="/leaderboard" className="pill-link">See all →</Link>
        </div>
        <div id="wt-leaderboard" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', marginBottom: '1rem' }}>
          {[
            ...(lbTop.length >= 2
              ? [
                  { rank: '1', medal: '🥇', name: lbTop[0].name, streak: lbTop[0].streak, isMe: false },
                  { rank: '2', medal: '🥈', name: lbTop[1].name, streak: lbTop[1].streak, isMe: false },
                ]
              : [
                  { rank: '1', medal: '🥇', name: '@—',  streak: 0, isMe: false },
                  { rank: '2', medal: '🥈', name: '@—',  streak: 0, isMe: false },
                ]),
            { rank: userRank ? `#${userRank}` : '—', medal: '', name: `You · @${displayName}`, streak: currentStreak, isMe: true },
          ].map((row, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px',
              borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
              background: row.isMe ? 'var(--accent-bg)' : 'transparent',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 22, color: row.isMe ? 'var(--accent-text)' : row.rank === '1' ? '#f59e0b' : '#94a3b8' }}>
                {row.medal || row.rank}
              </span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{row.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--streak-color, var(--amber))' }}>🔥 {row.streak}</span>
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
            }}>
            ⚡ Start session
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
