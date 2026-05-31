'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getUserHabits, getUsernameForAddress, getStreakData, getTodayCompletions,
  getGlobalLeaderboard, getAllHabitStreaks, getTotalCompletions,
  getDailyCompletionCounts, getProfileCreatedAt, getCircleRequests, type Habit,
} from '@/lib/supabase';
import { IconArrowLeft, IconFlame, IconSettings2 } from '@tabler/icons-react';

function glowStyle(count: number, total: number): React.CSSProperties {
  // Future day — visible box, very dim, not yet reached
  if (count === -1) {
    return {
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      opacity: 0.3,
    };
  }
  // Past day, nothing done — faintest accent glow (the journey started, just quiet)
  if (total === 0 || count === 0) {
    return {
      background: 'var(--accent)',
      border: '1px solid var(--accent-border)',
      opacity: 0.12,
    };
  }
  const ratio = Math.min(count / total, 1);

  if (ratio <= 0.25) {
    return {
      background: 'var(--accent)',
      border: '1px solid var(--accent-border)',
      opacity: 0.3,
    };
  }
  if (ratio <= 0.5) {
    return {
      background: 'var(--accent)',
      border: '1px solid var(--accent-border)',
      opacity: 0.55,
      boxShadow: '0 0 4px var(--accent)',
    };
  }
  if (ratio <= 0.75) {
    return {
      background: 'var(--accent)',
      border: '1px solid var(--accent-border)',
      opacity: 0.75,
      boxShadow: '0 0 7px var(--accent)',
    };
  }
  if (ratio < 1) {
    return {
      background: 'var(--accent)',
      border: '1px solid var(--accent-border)',
      opacity: 0.9,
      boxShadow: '0 0 10px var(--accent)',
    };
  }
  return {
    background: 'var(--accent)',
    border: '1px solid var(--accent-border)',
    opacity: 1,
    boxShadow: '0 0 14px 2px var(--accent)',
  };
}

export default function ProfilePage() {
  const { address: rawAddress } = useParams<{ address: string }>();
  const router = useRouter();

  const [myAddress, setMyAddress] = useState('');
  const [username, setUsername] = useState('');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [rank, setRank] = useState<number | null>(null);
  const [totalDone, setTotalDone] = useState(0);
  const [circleCount, setCircleCount] = useState(0);
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});
  const [memberSince, setMemberSince] = useState('');
  const [joinedDate, setJoinedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const address = (rawAddress || '').toLowerCase();

  useEffect(() => {
    const me = localStorage.getItem('proov_address') || '';
    setMyAddress(me.toLowerCase());
    if (!address) { router.replace('/'); return; }

    Promise.all([
      getUsernameForAddress(address),
      getUserHabits(address),
      getStreakData(address),
      getTodayCompletions(address),
      getGlobalLeaderboard(200),
      getTotalCompletions(address),
      getDailyCompletionCounts(address),
      getProfileCreatedAt(address),
    ]).then(([un, userHabits, streakData, todayDone, leaderboard, total, counts, createdAt]) => {
      if (un) setUsername(un as string);
      setHabits(userHabits as Habit[]);
      setStreak({ current: (streakData as any).currentStreak, longest: (streakData as any).longestStreak });
      setCompletedToday(todayDone as string[]);
      setTotalDone(total as number);
      setDailyCounts(counts as Record<string, number>);

      const idx = (leaderboard as { address: string }[]).findIndex(
        r => r.address.toLowerCase() === address
      );
      setRank(idx >= 0 ? idx + 1 : null);

      if (createdAt) {
        const d = new Date(createdAt as string);
        setMemberSince(d.toLocaleString('default', { month: 'short', year: 'numeric' }));
        setJoinedDate(d);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [address, router]);

  useEffect(() => {
    if (!address || habits.length === 0) return;
    getAllHabitStreaks(habits.map(h => h.id), address).then(setHabitStreaks).catch(() => {});
  }, [habits, address]);

  useEffect(() => {
    if (!address) return;
    getCircleRequests(address)
      .then(({ accepted }) => setCircleCount(accepted.length))
      .catch(() => {});
  }, [address]);

  const MILESTONES = [7, 14, 21, 30, 60, 90];
  const nextMilestone = MILESTONES.find(m => m > streak.current) ?? 120;
  const prevMilestone = (() => { let p = 0; for (const m of MILESTONES) { if (streak.current < m) return p; p = m; } return MILESTONES[MILESTONES.length - 1]; })();
  const milestonePct = nextMilestone > prevMilestone ? Math.min(100, ((streak.current - prevMilestone) / (nextMilestone - prevMilestone)) * 100) : 100;

  const isOwn = myAddress && address && myAddress === address;
  const displayName = username ? `@${username}` : address.slice(0, 8) + '…';
  const initial = (username || address).slice(0, 1).toUpperCase();

  // 30-day journey from join date. Box 1 = day they joined, box 30 = day 29.
  // Past days glow based on completions. Future days show as dim visible outlines.
  const heatmapDays = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = joinedDate ? new Date(joinedDate) : new Date(today);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const isFuture = d > today;
      return { date: dateStr, count: isFuture ? -1 : (dailyCounts[dateStr] || 0) };
    });
  })();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)', fontSize: 13 }}>
      Loading…
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)',
        padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.back()} style={{
              width: 30, height: 30, borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text2)', border: '1px solid var(--border)', background: 'var(--bg2)',
              cursor: 'pointer',
            }}>
              <IconArrowLeft size={14} stroke={2} />
            </button>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', letterSpacing: '-.3px' }}>
              {displayName}
            </span>
          </div>
          {isOwn && (
            <button onClick={() => router.push('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
              <IconSettings2 size={16} stroke={1.8} />
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 18px' }}>

        {/* Profile card */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, marginBottom: 14, overflow: 'hidden' }}>
          {/* Avatar + name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px 14px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: 'var(--btn-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 900, color: 'var(--btn-primary-text)',
            }}>
              {initial}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.3px' }}>{displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {memberSince ? `Member since ${memberSince}` : 'Member'}
              </div>
            </div>
          </div>

          {/* Stats grid — 3 cols × 2 rows with 1px dividers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)' }}>
            {[
              { value: streak.current,           label: 'Streak 🔥' },
              { value: streak.longest,            label: 'Best streak' },
              { value: rank ? `#${rank}` : '—',  label: 'Rank' },
              { value: habits.length,             label: 'Habits' },
              { value: circleCount,               label: 'Circle' },
              { value: totalDone,                 label: 'Total done' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--card-bg)', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.7px', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Milestone progress */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>
              <span>Next goal: <strong style={{ color: 'var(--text2)' }}>{nextMilestone}-day streak</strong></span>
              <span style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{Math.max(0, nextMilestone - streak.current)} days to go</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${milestonePct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width .4s ease' }} />
            </div>
          </div>
        </div>

        {/* Habits section */}
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)', marginBottom: 8 }}>
          Habits ({habits.length} active)
        </div>

        {habits.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '2rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
            No active habits yet.
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {habits.map((h, i) => {
              const done = completedToday.includes(h.id);
              const hStreak = habitStreaks[h.id] || 0;
              return (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0',
                  borderBottom: i < habits.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 18, color: 'var(--text3)', flexShrink: 0 }}>{h.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{h.name}</span>
                  <span style={{ fontSize: 11, color: done ? 'var(--success-text, #059669)' : 'var(--text3)', fontWeight: 600, marginRight: 4 }}>
                    {done ? 'Done today' : 'Pending'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--streak, #f59e0b)', minWidth: 32, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                    <IconFlame size={11} stroke={2} color="var(--streak, #f59e0b)" />{hStreak}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 30-day glow heatmap */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)' }}>
              30 days
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>less</span>
              {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: r === 0 ? 'var(--bg2)' : 'var(--accent)',
                  border: `1px solid ${r === 0 ? 'var(--border)' : 'var(--accent-border)'}`,
                  opacity: r === 0 ? 0.35 : r <= 0.25 ? 0.3 : r <= 0.5 ? 0.55 : r <= 0.75 ? 0.75 : 1,
                  boxShadow: r >= 1 ? '0 0 6px var(--accent)' : r >= 0.75 ? '0 0 4px var(--accent)' : undefined,
                }} />
              ))}
              <span>more</span>
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: 4,
          }}>
            {heatmapDays.map(({ date, count }) => (
              <div
                key={date}
                title={count === -1 ? date : `${date}${count > 0 ? ` · ${count} completed` : ''}`}
                style={{
                  aspectRatio: '1',
                  borderRadius: 5,
                  transition: 'box-shadow 0.2s',
                  ...glowStyle(count, habits.length),
                }}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
