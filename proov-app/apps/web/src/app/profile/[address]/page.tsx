'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getUserHabits, getUsernameForAddress, getStreakData, getTodayCompletions,
  getGlobalLeaderboard, getAllHabitStreaks, getTotalCompletions,
  getCompletionDates, getProfileCreatedAt, type Habit,
} from '@/lib/supabase';
import { IconArrowLeft, IconFlame, IconSettings2 } from '@tabler/icons-react';

export default function ProfilePage() {
  const { address: rawAddress } = useParams<{ address: string }>();
  const router = useRouter();

  const [myAddress, setMyAddress] = useState('');
  const [username, setUsername] = useState('');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [streak, setStreak] = useState({ current: 0 });
  const [rank, setRank] = useState<number | null>(null);
  const [totalDone, setTotalDone] = useState(0);
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});
  const [completionDates, setCompletionDates] = useState<string[]>([]);
  const [memberSince, setMemberSince] = useState('');
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
      getCompletionDates(address),
      getProfileCreatedAt(address),
    ]).then(([un, userHabits, streakData, todayDone, leaderboard, total, dates, createdAt]) => {
      if (un) setUsername(un as string);
      setHabits(userHabits as Habit[]);
      setStreak({ current: (streakData as any).currentStreak });
      setCompletedToday(todayDone as string[]);
      setTotalDone(total as number);
      setCompletionDates(dates as string[]);

      const idx = (leaderboard as { address: string }[]).findIndex(
        r => r.address.toLowerCase() === address
      );
      setRank(idx >= 0 ? idx + 1 : null);

      if (createdAt) {
        const d = new Date(createdAt as string);
        setMemberSince(d.toLocaleString('default', { month: 'short', year: 'numeric' }));
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [address, router]);

  useEffect(() => {
    if (!address || habits.length === 0) return;
    getAllHabitStreaks(habits.map(h => h.id), address).then(setHabitStreaks).catch(() => {});
  }, [habits, address]);

  const isOwn = myAddress && address && myAddress === address;
  const displayName = username ? `@${username}` : address.slice(0, 8) + '…';
  const initial = (username || address).slice(0, 1).toUpperCase();

  // Build 7-row × 8-col heatmap (last 56 days, row=day-of-week, col=week)
  const heatmap = (() => {
    const dateSet = new Set(completionDates);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows: { date: string; done: boolean; future: boolean }[][] = [];
    for (let row = 0; row < 7; row++) {
      rows.push([]);
      for (let col = 0; col < 8; col++) {
        const daysAgo = (6 - row) + (7 - col) * 7;
        const d = new Date(today);
        d.setDate(today.getDate() - daysAgo);
        const dateStr = d.toISOString().split('T')[0];
        rows[row].push({ date: dateStr, done: dateSet.has(dateStr), future: d > today });
      }
    }
    return rows;
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

          {/* Stats grid — 3 cols with 1px dividers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)' }}>
            {[
              { value: streak.current, label: 'Streak' },
              { value: totalDone,      label: 'Total done' },
              { value: rank ? `#${rank}` : '—', label: 'Rank' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--card-bg)', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.7px', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
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

        {/* Heatmap */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)', marginBottom: 10 }}>
            Streak history · last 8 weeks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {heatmap.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 3 }}>
                {row.map((cell, ci) => (
                  <div
                    key={ci}
                    title={cell.date}
                    style={{
                      flex: 1,
                      aspectRatio: '1',
                      borderRadius: 4,
                      background: cell.done ? 'var(--accent)' : 'var(--bg2)',
                      border: `1px solid ${cell.done ? 'var(--accent-border)' : 'var(--border)'}`,
                      opacity: cell.done ? 0.85 : 0.4,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
