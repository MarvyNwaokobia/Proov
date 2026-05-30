'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

const ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '').toLowerCase();
const REFRESH_MS    = 5 * 60 * 1000;
const CELOSCAN_BASE = 'https://celoscan.io/tx/';

interface DAU        { date: string; users: number }
interface RecentTx   { hash: string; from: string; contract: string; functionName: string; timestamp: number; isError: boolean }
interface SupaStats  { totalUsers: number; totalHabits: number; completionsAllTime: number; completionsToday: number; totalSessions: number; dau: DAU[] }
interface DuneResult { rows: Record<string, unknown>[]; columns: string[] }
interface Analytics  { supabaseStats: SupaStats; recentTxs: RecentTx[]; dune: { totalTxs: DuneResult | null; uniqueUsers: DuneResult | null; dailyTxs: DuneResult | null; contractActivity: DuneResult | null } | null }

// ── tiny helpers ──────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString(); }
function shortAddr(a: string) { return a.slice(0, 6) + '…' + a.slice(-4); }
function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function firstNum(row: Record<string, unknown>): string {
  const v = Object.values(row).find(x => typeof x === 'number');
  return v !== undefined ? fmt(Number(v)) : String(Object.values(row)[0] ?? '—');
}

// ── sub-components ─────────────────────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px', background: '#fff' }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#111', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{typeof value === 'number' ? fmt(value) : value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function DAUChart({ data }: { data: DAU[] }) {
  if (!data.length) return <Empty msg="No completions in the last 7 days" />;
  const max = Math.max(...data.map(d => d.users), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
        {data.map(({ date, users }) => (
          <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 10, color: '#374151', fontWeight: 600 }}>{users}</div>
            <div title={`${date}: ${users} users`} style={{ width: '100%', height: `${Math.max((users / max) * 80, 4)}px`, background: '#2563eb', borderRadius: '3px 3px 0 0' }} />
            <div style={{ fontSize: 9, color: '#9ca3af', whiteSpace: 'nowrap' }}>{date.slice(5)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DuneTable({ result, label }: { result: DuneResult | null; label: string }) {
  if (!result) return <Empty msg={`Set ${label} in env vars`} />;
  if (!result.rows.length) return <Empty msg="No data" />;
  const cols = result.columns.length ? result.columns : Object.keys(result.rows[0]);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {cols.map(c => <th key={c} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, 15).map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {cols.map(c => {
                const v = row[c];
                const s = typeof v === 'string' && v.startsWith('0x') ? shortAddr(v) : typeof v === 'number' ? fmt(v) : String(v ?? '—');
                return <td key={c} style={{ padding: '6px 10px', color: '#374151', fontFamily: typeof v === 'string' && v.startsWith('0x') ? 'monospace' : 'inherit', whiteSpace: 'nowrap' }}>{s}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: '1rem', color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>{msg}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: '#374151' }}>{title}</div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [data, setData]         = useState<Analytics | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [lastFetched, setLast]  = useState<Date | null>(null);

  // Wallet guard
  useEffect(() => {
    if (!isConnected) return;
    if (!ADMIN_ADDRESS) { setError('NEXT_PUBLIC_ADMIN_ADDRESS not configured'); return; }
    if (address?.toLowerCase() !== ADMIN_ADDRESS) router.replace('/dashboard');
  }, [address, isConnected, router]);

  // Fast redirect from localStorage before wagmi resolves
  useEffect(() => {
    if (!ADMIN_ADDRESS) return;
    const local = typeof window !== 'undefined' ? (localStorage.getItem('proov_address') || '') : '';
    if (local && local.toLowerCase() !== ADMIN_ADDRESS) router.replace('/dashboard');
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) throw new Error(`API ${res.status}`);
      setData(await res.json());
      setLast(new Date());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const id = setInterval(fetchData, REFRESH_MS); return () => clearInterval(id); }, [fetchData]);

  const s = data?.supabaseStats;
  const txs = data?.recentTxs ?? [];
  const dune = data?.dune;

  return (
    <div style={{ fontFamily: 'ui-monospace, monospace', background: '#f3f4f6', minHeight: '100vh', padding: '24px 16px 80px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>Proov Admin</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              {loading ? 'Loading…' : lastFetched ? `Updated ${lastFetched.toLocaleTimeString()} · auto-refreshes every 5 min` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="https://dune.com/marvyy/proov" target="_blank" rel="noreferrer"
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
              Dune Dashboard ↗
            </a>
            <button onClick={fetchData} disabled={loading}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .5 : 1, fontFamily: 'inherit' }}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{error}</div>}

        {/* ── Supabase stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          <Stat label="Registered Users"     value={s?.totalUsers ?? '…'} />
          <Stat label="Active Habits"        value={s?.totalHabits ?? '…'} />
          <Stat label="Timer Sessions"       value={s?.totalSessions ?? '…'} />
          <Stat label="Completions Today"    value={s?.completionsToday ?? '…'} />
          <Stat label="Completions All-Time" value={s?.completionsAllTime ?? '…'} />
          <Stat label="Dune Dashboard"       value="→" sub="dune.com/marvyy/proov" />
        </div>

        {/* ── DAU chart ── */}
        <div style={{ marginBottom: 16 }}>
          <Section title="Daily Active Users — last 7 days">
            <DAUChart data={s?.dau ?? []} />
          </Section>
        </div>

        {/* ── Recent Transactions (Celoscan) ── */}
        <div style={{ marginBottom: 16 }}>
          <Section title={`Recent Transactions (${txs.length})`}>
            {txs.length === 0
              ? <Empty msg="No transactions or CELOSCAN_API_KEY not set" />
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Time', 'Contract', 'Action', 'Wallet', 'Tx Hash'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((tx, i) => (
                        <tr key={tx.hash} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                          <td style={{ padding: '6px 10px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtTime(tx.timestamp)}</td>
                          <td style={{ padding: '6px 10px', color: '#374151', fontWeight: 600 }}>{tx.contract}</td>
                          <td style={{ padding: '6px 10px', color: '#111', fontWeight: 500 }}>{tx.functionName || '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#374151', fontFamily: 'monospace', fontSize: 11 }}>{shortAddr(tx.from)}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <a href={`${CELOSCAN_BASE}${tx.hash}`} target="_blank" rel="noreferrer"
                              style={{ color: '#2563eb', fontFamily: 'monospace', fontSize: 11, textDecoration: 'none' }}>
                              {tx.hash.slice(0, 10)}… ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Section>
        </div>

        {/* ── Dune sections (if API key configured) ── */}
        {dune && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <Section title="Dune — Total Transactions">
                <div style={{ fontSize: 36, fontWeight: 800, color: '#111' }}>
                  {dune.totalTxs?.rows.length ? firstNum(dune.totalTxs.rows[0]) : '—'}
                </div>
              </Section>
              <Section title="Dune — Unique Users">
                <div style={{ fontSize: 36, fontWeight: 800, color: '#111' }}>
                  {dune.uniqueUsers?.rows.length ? firstNum(dune.uniqueUsers.rows[0]) : '—'}
                </div>
              </Section>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Section title="Dune — Contract Activity">
                <DuneTable result={dune.contractActivity} label="DUNE_QUERY_CONTRACT_ACTIVITY" />
              </Section>
            </div>
          </>
        )}

        <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
          Proov Admin · sources: Supabase (live) + Celoscan + Dune ·{' '}
          <a href="https://dune.com/marvyy/proov" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>dune.com/marvyy/proov</a>
        </div>
      </div>
    </div>
  );
}
