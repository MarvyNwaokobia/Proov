'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft, IconExternalLink, IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { getRecoveryData, type RecoveryData } from '@/lib/goldsky';

const CELOSCAN = 'https://celoscan.io/tx';
const ALL_MILESTONES = [7, 21, 30, 50, 100, 200];

function shortAddr(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function tsToDate(ts: string) {
  return new Date(Number(ts) * 1000);
}

function fmtDate(ts: string) {
  return tsToDate(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(ts: string) {
  const d = tsToDate(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function RecoveryPage() {
  const router = useRouter();
  const [address, setAddress]   = useState('');
  const [input, setInput]       = useState('');
  const [data, setData]         = useState<RecoveryData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [noUrl, setNoUrl]       = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);

  // Pre-fill from localStorage on mount.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOLDSKY_URL) setNoUrl(true);
    const stored = localStorage.getItem('proov_address') || '';
    if (stored) {
      setInput(stored);
      setAddress(stored.toLowerCase());
    }
  }, []);

  // Fetch when address is set.
  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setNotFound(false);
    setData(null);
    setVisibleCount(50);
    getRecoveryData(address).then(result => {
      if (!result) setNotFound(true);
      else setData(result);
      setLoading(false);
    });
  }, [address]);

  function handleLookup() {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;
    setAddress(trimmed);
  }

  const earnedMilestones = new Set(data?.milestones.map(m => Number(m.milestone)) ?? []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)',
        padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.back()} style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text2)', border: '1px solid var(--border)', background: 'var(--bg2)', cursor: 'pointer',
          }}>
            <IconArrowLeft size={14} stroke={2} />
          </button>
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', letterSpacing: '-.3px' }}>
            On-chain recovery
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 18px' }}>

        {/* Source banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 16,
        }}>
          <IconCircleCheck size={14} stroke={2} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>
            This page reads directly from{' '}
            <strong style={{ color: 'var(--text)' }}>Goldsky</strong> (on-chain indexed events).
            No Supabase. No backend. Data is reconstructed from immutable contract events on Celo.
          </span>
        </div>

        {/* No Goldsky URL configured */}
        {noUrl && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 12, padding: '14px', marginBottom: 16,
          }}>
            <IconAlertCircle size={14} stroke={2} color="#f59e0b" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              <strong style={{ color: 'var(--text)' }}>NEXT_PUBLIC_GOLDSKY_URL</strong> is not set.
              Add it to your environment to use recovery.
            </span>
          </div>
        )}

        {/* Address lookup */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)', marginBottom: 8 }}>
            Wallet address
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="0x…"
              style={{
                flex: 1, height: 40, borderRadius: 10, padding: '0 12px',
                background: 'var(--bg2)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 13, fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <button onClick={handleLookup} style={{
              height: 40, padding: '0 16px', borderRadius: 10,
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              flexShrink: 0,
            }}>
              Recover
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '2rem 0' }}>
            Querying Goldsky…
          </div>
        )}

        {/* Not found */}
        {!loading && notFound && (
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 14, padding: '2rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No on-chain data found</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              This address has no indexed events in the subgraph yet.
            </div>
          </div>
        )}

        {/* Data loaded */}
        {!loading && data && (
          <>
            {/* Queried address */}
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', marginBottom: 16 }}>
              {address}
            </div>

            {/* Stats card */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)' }}>
                {[
                  { value: data.currentStreak,    label: 'Current streak 🔥' },
                  { value: data.longestStreak,     label: 'Longest streak' },
                  { value: data.totalCompletions,  label: 'Total completions' },
                  { value: fmtDate(data.createdAt), label: 'First on-chain event' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--card-bg)', padding: '12px 14px' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.7px', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)', marginBottom: 10 }}>
                Milestones
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ALL_MILESTONES.map(m => {
                  const earned = earnedMilestones.has(m);
                  const ts = data.milestones.find(x => Number(x.milestone) === m)?.timestamp;
                  return (
                    <div key={m} title={earned && ts ? fmtDate(ts) : undefined} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 12,
                      background: earned ? 'var(--accent)' : 'var(--bg2)',
                      border: `1px solid ${earned ? 'var(--accent-border)' : 'var(--border)'}`,
                      opacity: earned ? 1 : 0.4,
                      boxShadow: earned ? '0 0 10px var(--accent)' : 'none',
                      transition: 'all .2s',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: earned ? 'var(--btn-primary-text)' : 'var(--text3)' }}>
                        {m}
                      </span>
                      <span style={{ fontSize: 8, color: earned ? 'var(--btn-primary-text)' : 'var(--text3)', opacity: .7, marginTop: 1 }}>
                        days
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Habits */}
            {data.habits.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)', marginBottom: 10 }}>
                  Habits ({data.habits.length})
                </div>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden' }}>
                  {data.habits.map((h, i) => (
                    <div key={h.habitId} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px',
                      borderBottom: i < data.habits.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, minWidth: 18 }}>#{h.habitId}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{h.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginRight: 8 }}>{h.totalCompletions}×</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                        background: h.active ? 'var(--accent)' : 'var(--bg3)',
                        color: h.active ? 'var(--btn-primary-text)' : 'var(--text3)',
                        textTransform: 'uppercase', letterSpacing: '.5px',
                      }}>
                        {h.active ? 'active' : 'off'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completion log */}
            {data.completions.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)' }}>
                    Completion log ({data.completions.length})
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>each row links to Celoscan</div>
                </div>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden' }}>
                  {data.completions.slice(0, visibleCount).map((c, i) => (
                    <a
                      key={c.txHash + i}
                      href={`${CELOSCAN}/${c.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px', textDecoration: 'none',
                        borderBottom: i < Math.min(visibleCount, data.completions.length) - 1 ? '1px solid var(--border)' : 'none',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                        {c.habit.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--streak, #f59e0b)', fontWeight: 700, marginRight: 4 }}>
                        🔥{c.streak}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text3)', marginRight: 6, whiteSpace: 'nowrap' }}>
                        {fmtDateTime(c.timestamp)}
                      </span>
                      <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {shortAddr(c.txHash)}
                        <IconExternalLink size={10} stroke={1.8} />
                      </span>
                    </a>
                  ))}
                </div>

                {visibleCount < data.completions.length && (
                  <button
                    onClick={() => setVisibleCount(v => v + 50)}
                    style={{
                      width: '100%', marginTop: 8, height: 38, borderRadius: 10,
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Show more ({data.completions.length - visibleCount} remaining)
                  </button>
                )}
              </div>
            )}

            {/* Honest gap disclosure */}
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', marginBottom: 8 }}>
                What this page cannot recover from chain
              </div>
              {[
                'Habit emojis — stored in Supabase, not emitted in HabitCreated events',
                'Username — UsernameSet events exist on-chain but are not yet indexed in the subgraph',
                'Session detail beyond start/end — duration and habit mapping require Supabase',
              ].map(note => (
                <div key={note} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1, flexShrink: 0 }}>·</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{note}</span>
                </div>
              ))}
            </div>

          </>
        )}
      </div>
    </div>
  );
}
