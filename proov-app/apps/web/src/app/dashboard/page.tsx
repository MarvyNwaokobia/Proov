'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';

interface Habit {
  id: string;
  name: string;
  emoji: string;
  category: string;
  hasTimer: boolean;
  targetDuration?: number;
  active?: boolean;
  completedToday?: boolean;
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
  const { address, isConnected } = useAccount();

  const [username, setUsername] = useState('');
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);
  const [cheered, setCheered] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!isConnected) router.replace('/');
  }, [isConnected, router]);

  useEffect(() => {
    const storedUsername =
      localStorage.getItem('proov_username') ||
      (() => {
        const addr = localStorage.getItem('proov_address') || '';
        if (!addr) return null;
        try {
          const raw = localStorage.getItem(`proov_username_${addr.toLowerCase()}`);
          return raw ? JSON.parse(raw).username : null;
        } catch { return null; }
      })() ||
      null;

    if (storedUsername) setUsername(storedUsername);
  }, []);

  useEffect(() => {
    setMounted(true);
    const today = new Date().toDateString();

    // Habits
    const habitsRaw = localStorage.getItem('proov_habits');
    if (habitsRaw) {
      try {
        const all: Habit[] = JSON.parse(habitsRaw);
        const completions: string[] = JSON.parse(localStorage.getItem(`proov_completions_${today}`) || '[]');
        setHabits(
          all
            .filter(h => h.active !== false)
            .map(h => ({ ...h, completedToday: completions.includes(h.id) }))
        );
      } catch {}
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
  }, [address]);

  const completedCount = habits.filter(h => h.completedToday).length;
  const totalHabits = habits.length;
  const progressPercent = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0;

  const handleToggleHabit = (habitId: string) => {
    const today = new Date().toDateString();
    const key = `proov_completions_${today}`;
    const completions: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    const isNowDone = !completions.includes(habitId);

    if (isNowDone) {
      completions.push(habitId);
      showToast('Done ✓');
    } else {
      const idx = completions.indexOf(habitId);
      if (idx > -1) completions.splice(idx, 1);
    }
    localStorage.setItem(key, JSON.stringify(completions));
    setHabits(prev => prev.map(h => h.id === habitId ? { ...h, completedToday: isNowDone } : h));
    updateStreak(completions.length > 0);
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

  const displayName = username || 'there';

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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {getGreeting()}, {displayName} 👋
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{formatDate()}</div>
          </div>
          <Link href="/settings" style={{ fontSize: 20, textDecoration: 'none', lineHeight: 1, marginTop: 2 }} title="Settings">⚙️</Link>
        </div>

        {/* Streak card */}
        <div style={{
          background: 'linear-gradient(135deg, var(--accent, #059669), var(--accent2, #047857))',
          borderRadius: 16,
          padding: '1rem',
          marginBottom: '1rem',
          position: 'relative',
          overflow: 'hidden',
          color: '#ffffff',
        }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,.65)', marginBottom: 4 }}>
              Current streak
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: -2, lineHeight: 1 }}>
                {currentStreak}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.75)' }}>days 🔥</span>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.5)' }}>Best</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{longestStreak}</div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 20, height: 4, marginBottom: 5 }}>
              <div style={{
                background: '#fff', borderRadius: 20, height: 4,
                width: `${progressPercent}%`, transition: 'width .4s ease',
              }} />
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.6)' }}>
              {totalHabits === 0
                ? 'Create your first habit to start'
                : `${completedCount} of ${totalHabits} habits done today`}
            </div>
          </div>
        </div>

        {/* Today's habits */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-label" style={{ margin: '0 0 0.625rem' }}>Today's habits</div>
          <Link href="/habits" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 500 }}>Manage →</Link>
        </div>

        {habits.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>No habits yet</p>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
              Create your first habit to start building streaks
            </p>
            <Link href="/habits" style={{ padding: '9px 18px', borderRadius: 20, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              + Create first habit
            </Link>
          </div>
        ) : (
          /* 2-column grid — no horizontal scroll ever */
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: '1rem',
            width: '100%',
          }}>
            {habits.map(habit => (
              <div
                key={habit.id}
                style={{
                  background: 'var(--card-bg)',
                  border: `1px solid ${habit.completedToday ? 'var(--accent-border)' : 'var(--card-border)'}`,
                  borderRadius: 14,
                  padding: '0.875rem',
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  transition: 'border .15s, transform .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}
              >
                {/* Emoji + checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>{habit.emoji || '✅'}</span>
                  <button
                    onClick={() => handleToggleHabit(habit.id)}
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `1.5px solid ${habit.completedToday ? 'var(--accent)' : 'var(--border2)'}`,
                      background: habit.completedToday ? 'var(--accent)' : 'transparent',
                      color: habit.completedToday ? '#fff' : 'transparent',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s', flexShrink: 0,
                    }}
                  >
                    ✓
                  </button>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {habit.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                  {habit.hasTimer && habit.targetDuration ? `⏱ ${habit.targetDuration} min` : 'Tap to complete'}
                </div>
                {habit.hasTimer && !habit.completedToday && (
                  <Link
                    href={`/timer?habitId=${habit.id}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      marginTop: 7, padding: '3px 8px', borderRadius: 6,
                      background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                      textDecoration: 'none',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <span style={{ fontSize: 9, color: 'var(--accent-text)', fontWeight: 600 }}>▶ Start</span>
                  </Link>
                )}
              </div>
            ))}
            {/* Add habit cell */}
            <Link
              href="/habits"
              style={{
                background: 'transparent',
                border: '1.5px dashed var(--border2)',
                borderRadius: 14, padding: '0.875rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'var(--text3)', textDecoration: 'none',
                minWidth: 0, transition: 'border .15s, color .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; }}
            >
              + Add habit
            </Link>
          </div>
        )}

        {/* Circle section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-label" style={{ margin: '0 0 0.625rem' }}>Your circle</div>
          <Link href="/circle" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 500 }}>Manage →</Link>
        </div>

        {circleMembers.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '1.25rem', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>🤝</div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>No circle yet</p>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
              Add friends to cheer each other on and stay accountable
            </p>
            <Link href="/circle" style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              Add your first friend →
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

        {/* Squads — coming soon */}
        <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 14, padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.8 }}>
          <span style={{ fontSize: 24 }}>👥</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Squads</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>Do habits together with friends. One squad, one streak.</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'var(--accent-bg)', color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>
            Coming soon
          </span>
        </div>

        {/* Leaderboard snapshot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-label" style={{ margin: '0 0 0.625rem' }}>Leaderboard</div>
          <Link href="/leaderboard" style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 500 }}>See all →</Link>
        </div>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', marginBottom: '1rem' }}>
          {[
            { rank: '1', medal: '🥇', name: '@sarah_k',   streak: 89, isMe: false },
            { rank: '2', medal: '🥈', name: '@marcus_o',  streak: 74, isMe: false },
            { rank: '—', medal: '',   name: `You · @${displayName}`, streak: currentStreak, isMe: true },
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: '1rem' }}>
          <Link
            href="/timer"
            style={{
              padding: '13px', borderRadius: 14, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center',
              display: 'block', boxShadow: '0 4px 14px var(--btn-primary-shadow)',
              transition: 'transform .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = '')}
          >
            ⚡ Start session
          </Link>
          <Link
            href="/habits"
            style={{
              padding: '13px', borderRadius: 14,
              border: '1px solid var(--border2)', background: 'transparent',
              color: 'var(--text2)', fontSize: 13, fontWeight: 500,
              textDecoration: 'none', textAlign: 'center', display: 'block',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text2)'; }}
          >
            + New habit
          </Link>
        </div>

      </div>

      {/* Toast */}
      <div className={`toast ${toastVisible ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
