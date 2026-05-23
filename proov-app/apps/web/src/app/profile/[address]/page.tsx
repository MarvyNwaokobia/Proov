'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getUserHabits, getUsernameForAddress, getStreakData, getTodayCompletions,
  type Habit,
} from '@/lib/supabase';
import { IconArrowLeft, IconFlame, IconSettings2 } from '@tabler/icons-react';

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ProfilePage() {
  const { address: rawAddress } = useParams<{ address: string }>();
  const router = useRouter();

  const [myAddress, setMyAddress] = useState('');
  const [username, setUsername] = useState('');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [activeToday, setActiveToday] = useState(false);
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
    ]).then(([un, userHabits, streakData, todayDone]) => {
      if (un) setUsername(un);
      setHabits(userHabits);
      setStreak({ current: streakData.currentStreak, longest: streakData.longestStreak });
      setCompletedToday(todayDone);
      const todayIso = new Date().toISOString().split('T')[0];
      setActiveToday(streakData.lastCompletionDate === todayIso);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [address, router]);

  const isOwn = myAddress && address && myAddress === address;
  const displayName = username ? `@${username}` : shortAddr(address);
  const initial = (username || address).slice(0, 1).toUpperCase();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)', fontSize: 13 }}>
      Loading…
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>

      {/* Glow */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 220, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, var(--accent-bg), transparent)', opacity: 0.4, zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)',
        padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.back()} style={{
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text3)', border: '1px solid var(--border2)', background: 'var(--bg2)',
              cursor: 'pointer',
            }}>
              <IconArrowLeft size={16} stroke={2} />
            </button>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
              {isOwn ? 'My Profile' : displayName}
            </span>
          </div>
          {isOwn && (
            <Link href="/settings" style={{ color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
              <IconSettings2 size={18} stroke={1.8} />
            </Link>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '2rem 1.25rem 0', position: 'relative', zIndex: 1 }}>

        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 22, flexShrink: 0,
            background: 'var(--btn-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 900, color: 'var(--btn-primary-text)',
            boxShadow: '0 0 28px var(--accent-bg)',
          }}>
            {initial}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{displayName}</div>
            {username && (
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', marginTop: 3 }}>
                {shortAddr(address)}
              </div>
            )}
            {isOwn && <div style={{ fontSize: 11, color: 'var(--accent-text)', marginTop: 4 }}>That's you</div>}
            {activeToday && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                borderRadius: 20, padding: '4px 12px', marginTop: 8,
                background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent-text)' }}>Active today</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Streak',      value: streak.current,           unit: 'days',    color: '#f59e0b' },
            { label: 'Best streak', value: streak.longest,           unit: 'days',    color: 'var(--accent-text)' },
            { label: 'Done today',  value: completedToday.length,    unit: 'habits',  color: 'var(--text)' },
            { label: 'Habits',      value: habits.length,            unit: 'active',  color: 'var(--text)' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 16, padding: '14px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: stat.color, lineHeight: 1 }}>
                {stat.value === 0 && stat.label === 'Streak'
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconFlame size={22} stroke={2} color="#f59e0b" />{stat.value}</span>
                  : stat.value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{stat.unit}</div>
            </div>
          ))}
        </div>

        {/* Habits list */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)', marginBottom: 10 }}>
            Habits — {habits.length}
          </div>
          {habits.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '2rem', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              No active habits yet.
            </div>
          ) : (
            habits.map(h => {
              const done = completedToday.includes(h.id);
              return (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: done ? 'var(--accent-bg)' : 'var(--card-bg)',
                  border: `1px solid ${done ? 'var(--accent-border)' : 'var(--card-border)'}`,
                  borderRadius: 13, padding: '11px 14px', marginBottom: 8,
                  opacity: done ? 0.8 : 1,
                }}>
                  <span style={{ fontSize: 22 }}>{h.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{h.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      {h.type === 'timed' ? `${h.duration_minutes}m` : 'Checkbox'} · {h.schedule} · {h.category}
                    </div>
                  </div>
                  {done && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      ✓ Done
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Own profile quick actions */}
        {isOwn && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            <Link href="/habits" style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 14, padding: '1rem', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, textDecoration: 'none',
            }}>
              <span style={{ fontSize: 22 }}>◆</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Manage Habits</span>
            </Link>
            <Link href="/circle" style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 14, padding: '1rem', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 6, textDecoration: 'none',
            }}>
              <span style={{ fontSize: 22 }}>◉</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>My Circle</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
