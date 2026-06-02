'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconChevronLeft, IconUsers, IconFlame, IconBolt, IconTarget } from '@tabler/icons-react';

interface DauEntry { date: string; users: number; }
interface Stats {
  totalUsers: number;
  totalHabits: number;
  completionsAllTime: number;
  completionsToday: number;
  totalSessions: number;
  dau: DauEntry[];
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 16, padding: '16px 18px',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, date }: { value: number; max: number; date: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const d = new Date(date + 'T12:00:00Z');
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--text3)', minWidth: 80, textAlign: 'right' }}>{label}</span>
      <div style={{ flex: 1, height: 10, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 5 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', minWidth: 20, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(r => r.json())
      .then(d => {
        setStats(d.supabaseStats);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load stats.');
        setLoading(false);
      });
  }, []);

  const dau = stats?.dau ?? [];
  const maxDau = dau.length > 0 ? Math.max(...dau.map(d => d.users)) : 1;

  // MAU: unique users in the last 30 days — we proxy with totalUsers since
  // the analytics endpoint groups by date but not a 30d distinct-user window.
  // For now, display it as "registered accounts" which is the closest we have.
  const mau = stats?.totalUsers ?? 0;

  // Retention proxy: if we have ≥2 days of DAU data, show the ratio of
  // yesterday's DAU to the day before as a simple d1 retention signal.
  let retention = '—';
  if (dau.length >= 2) {
    const sorted = [...dau].sort((a, b) => a.date.localeCompare(b.date));
    const prev = sorted[sorted.length - 2]?.users ?? 0;
    const last = sorted[sorted.length - 1]?.users ?? 0;
    if (prev > 0) retention = `${Math.round((last / prev) * 100)}%`;
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '1.2px', color: 'var(--text3)', marginBottom: 10, marginTop: 20,
  };

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /></div>
      <div className="top-bar" />
      <div className="page-wrap" style={{ paddingTop: 18 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Link href="/settings" style={{ color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
            <IconChevronLeft size={20} stroke={2} />
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', margin: 0 }}>App Stats</h1>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#f43f5e', fontSize: 13 }}>{error}</div>
        )}

        {stats && (
          <>
            <p style={sectionLabel}>Overview</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <StatCard label="Registered users" value={mau.toLocaleString()} sub="All time" />
              <StatCard label="Today's completions" value={stats.completionsToday.toLocaleString()} sub="Habits done today" />
              <StatCard label="Total completions" value={stats.completionsAllTime.toLocaleString()} sub="All time" />
              <StatCard label="Focus sessions" value={stats.totalSessions.toLocaleString()} sub="All time" />
            </div>

            <p style={sectionLabel}>Engagement</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <StatCard label="Active habits" value={stats.totalHabits.toLocaleString()} sub="Currently tracking" />
              <StatCard label="D1 retention" value={retention} sub="Yesterday vs day before" />
            </div>

            {dau.length > 0 && (
              <>
                <p style={sectionLabel}>Daily Active Users (last 7 days)</p>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '16px 18px' }}>
                  {[...dau].sort((a, b) => a.date.localeCompare(b.date)).map(d => (
                    <MiniBar key={d.date} value={d.users} max={maxDau} date={d.date} />
                  ))}
                </div>
              </>
            )}

            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 18, lineHeight: 1.6 }}>
              Stats are sourced from Supabase and refresh on page load.
              Tx volume and on-chain activity are available in the admin dashboard.
            </p>
          </>
        )}

      </div>
    </>
  );
}
