'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconChevronLeft, IconUsers, IconFlame, IconBolt, IconTarget, IconShieldCheck } from '@tabler/icons-react';

interface DauEntry { date: string; users: number; }
interface Stats {
  totalUsers: number;
  totalHabits: number;
  completionsAllTime: number;
  completionsToday: number;
  totalSessions: number;
  dau: DauEntry[];
}

interface OnChainStats {
  onChainUsers: number;
  onChainCompletions: number;
  verifiedCompletions: number;
  onChainSessions: number;
  milestones: number;
}

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 16, padding: '16px 18px',
    }}>
      {icon && <div style={{ marginBottom: 8 }}>{icon}</div>}
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

async function fetchOnChainStats(): Promise<OnChainStats | null> {
  const url = process.env.NEXT_PUBLIC_GOLDSKY_URL;
  if (!url) return null;
  const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `{
          users(first: 1000) { id totalCompletions totalSessions }
          verifiedCompletions: habitCompletions(
            first: 1000
            where: { verificationHash_not: "${ZERO_HASH}" }
          ) { id }
          milestones(first: 1000) { id }
        }`,
      }),
    });
    const { data } = await res.json();
    if (!data) return null;
    const users: { totalCompletions: number; totalSessions: number }[] = data.users ?? [];
    return {
      onChainUsers: users.length,
      onChainCompletions: users.reduce((s, u) => s + (u.totalCompletions ?? 0), 0),
      verifiedCompletions: data.verifiedCompletions?.length ?? 0,
      onChainSessions: users.reduce((s, u) => s + (u.totalSessions ?? 0), 0),
      milestones: data.milestones?.length ?? 0,
    };
  } catch {
    return null;
  }
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [onChain, setOnChain] = useState<OnChainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/analytics').then(r => r.json()),
      fetchOnChainStats(),
    ])
      .then(([analytics, chain]) => {
        setStats(analytics.supabaseStats);
        setOnChain(chain);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load stats.');
        setLoading(false);
      });
  }, []);

  const dau = stats?.dau ?? [];
  const maxDau = dau.length > 0 ? Math.max(...dau.map(d => d.users)) : 1;

  let retention = '—';
  if (dau.length >= 2) {
    const sorted = [...dau].sort((a, b) => a.date.localeCompare(b.date));
    const prev = sorted[sorted.length - 2]?.users ?? 0;
    const last = sorted[sorted.length - 1]?.users ?? 0;
    if (prev > 0) retention = `${Math.round((last / prev) * 100)}%`;
  }

  const verifiedPct = onChain && onChain.onChainCompletions > 0
    ? `${Math.round((onChain.verifiedCompletions / onChain.onChainCompletions) * 100)}%`
    : '—';

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
              <StatCard label="Registered users" value={(stats.totalUsers ?? 0).toLocaleString()} sub="All time" />
              <StatCard label="Today's completions" value={(stats.completionsToday ?? 0).toLocaleString()} sub="Habits done today" />
              <StatCard label="Total completions" value={(stats.completionsAllTime ?? 0).toLocaleString()} sub="All time" />
              <StatCard label="Focus sessions" value={(stats.totalSessions ?? 0).toLocaleString()} sub="All time" />
            </div>

            <p style={sectionLabel}>Engagement</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <StatCard label="Active habits" value={(stats.totalHabits ?? 0).toLocaleString()} sub="Currently tracking" />
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
          </>
        )}

        {onChain && (
          <>
            <p style={sectionLabel}>On-Chain Activity (Celo Mainnet)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <StatCard
                label="On-chain users"
                value={onChain.onChainUsers.toLocaleString()}
                sub="Unique addresses"
                icon={<IconUsers size={16} stroke={2} color="var(--accent-text)" />}
              />
              <StatCard
                label="On-chain completions"
                value={onChain.onChainCompletions.toLocaleString()}
                sub="Habit proofs recorded"
                icon={<IconTarget size={16} stroke={2} color="var(--accent-text)" />}
              />
              <StatCard
                label="AI-verified proofs"
                value={onChain.verifiedCompletions.toLocaleString()}
                sub={`${verifiedPct} of completions`}
                icon={<IconShieldCheck size={16} stroke={2} color="var(--accent-text)" />}
              />
              <StatCard
                label="Focus sessions"
                value={onChain.onChainSessions.toLocaleString()}
                sub="On-chain proofs"
                icon={<IconBolt size={16} stroke={2} color="var(--accent-text)" />}
              />
              <StatCard
                label="Milestones reached"
                value={onChain.milestones.toLocaleString()}
                sub="7 / 21 / 30 / 50 / 100 / 200d"
                icon={<IconFlame size={16} stroke={2} color="var(--accent-text)" />}
              />
            </div>

            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 12,
              background: 'var(--bg2)', border: '1px solid var(--card-border)',
              fontSize: 11, color: 'var(--text3)', lineHeight: 1.6,
            }}>
              On-chain data indexed by{' '}
              <a href="https://goldsky.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>
                Goldsky
              </a>
              {' '}· contracts on{' '}
              <a href="https://celoscan.io/address/0x6f379efDb10aFD85b233aE35Ad01164c7bc54eE2" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>
                Celoscan
              </a>
            </div>
          </>
        )}

        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 18, lineHeight: 1.6 }}>
          App stats from Supabase · On-chain stats from Goldsky subgraph · Both refresh on page load.
        </p>

      </div>
    </>
  );
}
