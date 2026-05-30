'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

const ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '').toLowerCase();
const REFRESH_MS = 5 * 60 * 1000;

interface QueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  missing?: boolean;
  error?: string;
}

interface Analytics {
  totalTxs: QueryResult;
  uniqueUsers: QueryResult;
  dailyTxs: QueryResult;
  contractActivity: QueryResult;
  recentTxs: QueryResult;
}

function firstNumeric(row: Record<string, unknown>): string {
  if (!row) return '—';
  const val = Object.values(row).find(v => typeof v === 'number');
  return val !== undefined ? Number(val).toLocaleString() : String(Object.values(row)[0] ?? '—');
}

function BarChart({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) {
  if (!rows.length) return <Empty />;

  // Heuristic: first col = label (date/name), second col = numeric value
  const labelCol = columns[0] ?? Object.keys(rows[0])[0];
  const valueCol = columns.find((c, i) => i > 0 && typeof rows[0][c] === 'number') ??
    columns[1] ?? Object.keys(rows[0])[1];

  const values = rows.map(r => Number(r[valueCol] ?? 0));
  const max = Math.max(...values, 1);
  const slice = rows.slice(-30); // last 30 entries
  const sliceVals = slice.map(r => Number(r[valueCol] ?? 0));

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, minWidth: slice.length * 18, paddingBottom: 24, position: 'relative' }}>
        {slice.map((row, i) => {
          const pct = (sliceVals[i] / max) * 100;
          const label = String(row[labelCol] ?? '').slice(0, 10);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end', position: 'relative' }} title={`${label}: ${sliceVals[i].toLocaleString()}`}>
              <div style={{ width: '100%', height: `${pct}%`, background: 'var(--accent)', borderRadius: '3px 3px 0 0', opacity: 0.85, minHeight: 2, transition: 'height .3s ease' }} />
              {i % Math.ceil(slice.length / 6) === 0 && (
                <div style={{ position: 'absolute', bottom: -20, fontSize: 8, color: 'var(--text3)', whiteSpace: 'nowrap', transform: 'rotate(-30deg)', transformOrigin: 'top left' }}>{label}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 28 }}>
        {valueCol} — last {slice.length} entries · max {max.toLocaleString()}
      </div>
    </div>
  );
}

function GenericTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) {
  if (!rows.length) return <Empty />;
  const cols = columns.length ? columns : Object.keys(rows[0]);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg2)' }}>
              {cols.map(c => {
                const v = row[c];
                const str = typeof v === 'string' && v.startsWith('0x')
                  ? v.slice(0, 10) + '…'
                  : typeof v === 'number'
                  ? v.toLocaleString()
                  : String(v ?? '—');
                return (
                  <td key={c} style={{ padding: '6px 10px', color: 'var(--text2)', fontFamily: typeof v === 'string' && v.startsWith('0x') ? 'monospace' : 'inherit', whiteSpace: 'nowrap' }}>{str}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 20 && <div style={{ fontSize: 10, color: 'var(--text3)', padding: '6px 10px' }}>Showing 20 of {rows.length} rows</div>}
    </div>
  );
}

function Empty() {
  return <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No data — set the Dune query ID in env vars</div>;
}

function Card({ title, children, span }: { title: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 16, padding: '1.25rem',
      gridColumn: span ? '1 / -1' : undefined,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card title={title}>
      <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', letterSpacing: -1, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Guard — redirect if not admin wallet
  useEffect(() => {
    if (!isConnected) return;
    if (!ADMIN_ADDRESS) { setError('NEXT_PUBLIC_ADMIN_ADDRESS not set'); return; }
    if (address?.toLowerCase() !== ADMIN_ADDRESS) router.replace('/dashboard');
  }, [address, isConnected, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
      setLastFetched(new Date());
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  // Redirect non-admin before address resolves
  const localAddr = typeof window !== 'undefined' ? localStorage.getItem('proov_address') || '' : '';
  if (ADMIN_ADDRESS && localAddr && localAddr.toLowerCase() !== ADMIN_ADDRESS) {
    router.replace('/dashboard');
    return null;
  }

  return (
    <>
      <div className="blobs"><div className="blob b1"/><div className="blob b2"/></div>
      <div className="top-bar"/>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.25rem 1.25rem 6rem', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.3px' }}>Analytics</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {lastFetched ? `Updated ${lastFetched.toLocaleTimeString()}` : 'Loading…'} · refreshes every 5 min
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#ef4444', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading && !data ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 100, borderRadius: 16, background: 'var(--bg2)', border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : data ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>

            {/* Stat: Total Transactions */}
            <StatCard
              title="Total Transactions"
              value={data.totalTxs.rows.length ? firstNumeric(data.totalTxs.rows[0]) : '—'}
              sub={data.totalTxs.missing ? 'Set DUNE_QUERY_TOTAL_TXS' : data.totalTxs.error}
            />

            {/* Stat: Unique Users */}
            <StatCard
              title="Unique Users"
              value={data.uniqueUsers.rows.length ? firstNumeric(data.uniqueUsers.rows[0]) : '—'}
              sub={data.uniqueUsers.missing ? 'Set DUNE_QUERY_UNIQUE_USERS' : data.uniqueUsers.error}
            />

            {/* Bar Chart: Daily Transactions */}
            <Card title="Daily Transactions" span>
              {data.dailyTxs.missing
                ? <Empty />
                : <BarChart rows={data.dailyTxs.rows} columns={data.dailyTxs.columns} />
              }
            </Card>

            {/* Table: Contract Activity */}
            <Card title="Contract Activity Breakdown" span>
              {data.contractActivity.missing
                ? <Empty />
                : <GenericTable rows={data.contractActivity.rows} columns={data.contractActivity.columns} />
              }
            </Card>

            {/* Table: Recent Transactions */}
            <Card title="Recent Transactions" span>
              {data.recentTxs.missing
                ? <Empty />
                : <GenericTable rows={data.recentTxs.rows} columns={data.recentTxs.columns} />
              }
            </Card>

          </div>
        ) : null}

      </div>
    </>
  );
}
