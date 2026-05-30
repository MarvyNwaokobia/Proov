import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Supabase (server-side, uses anon key + open RLS policies) ──────────────
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ── Celoscan ───────────────────────────────────────────────────────────────
const CELOSCAN_KEY = process.env.CELOSCAN_API_KEY || '';
const CONTRACTS = {
  ProovCore:      process.env.NEXT_PUBLIC_PROOV_CORE_ADDRESS      || '',
  SessionManager: process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS || '',
  CircleManager:  process.env.NEXT_PUBLIC_CIRCLE_MANAGER_ADDRESS  || '',
};

// ── Dune (optional — only if query IDs are configured) ────────────────────
const DUNE_KEY = process.env.DUNE_API_KEY || '';
const DUNE_QUERIES = {
  totalTxs:         process.env.DUNE_QUERY_TOTAL_TXS,
  uniqueUsers:      process.env.DUNE_QUERY_UNIQUE_USERS,
  dailyTxs:         process.env.DUNE_QUERY_DAILY_TXS,
  contractActivity: process.env.DUNE_QUERY_CONTRACT_ACTIVITY,
  recentTxs:        process.env.DUNE_QUERY_RECENT_TXS,
};

// ── helpers ────────────────────────────────────────────────────────────────
async function tryFetchDune(queryId?: string) {
  if (!queryId || !DUNE_KEY) return null;
  try {
    const r = await fetch(`https://api.dune.com/api/v1/query/${queryId}/results`, {
      headers: { 'X-Dune-API-Key': DUNE_KEY }, cache: 'no-store',
    });
    const j = await r.json();
    return { rows: j.result?.rows ?? [], columns: j.result?.metadata?.column_names ?? [] };
  } catch { return null; }
}

async function fetchCeloscanTxs(address: string, contractName: string) {
  if (!address) return [];
  const key = CELOSCAN_KEY ? `&apikey=${CELOSCAN_KEY}` : '';
  const url = `https://api.celoscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=latest&page=1&offset=20&sort=desc${key}`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    if (j.status !== '1') return [];
    return (j.result as any[]).map(tx => ({
      hash:         tx.hash,
      from:         tx.from,
      contract:     contractName,
      functionName: tx.functionName ? tx.functionName.split('(')[0] : 'transfer',
      timestamp:    Number(tx.timeStamp),
      isError:      tx.isError === '1',
    }));
  } catch { return []; }
}

// ── main handler ───────────────────────────────────────────────────────────
export async function GET() {
  // ── Supabase stats ──────────────────────────────────────────────────────
  let supabaseStats = {
    totalUsers: 0, totalHabits: 0,
    completionsAllTime: 0, completionsToday: 0,
    totalSessions: 0,
    dau: [] as { date: string; users: number }[],
  };

  if (supabaseUrl && supabaseKey) {
    const db = createClient(supabaseUrl, supabaseKey);
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0];

    const [
      { count: totalUsers },
      { count: totalHabits },
      { count: completionsAllTime },
      { count: completionsToday },
      { count: totalSessions },
      { data: dauRows },
    ] = await Promise.all([
      db.from('profiles').select('*', { count: 'exact', head: true }),
      db.from('habits').select('*', { count: 'exact', head: true }).eq('active', true),
      db.from('habit_completions').select('*', { count: 'exact', head: true }),
      db.from('habit_completions').select('*', { count: 'exact', head: true }).eq('completed_at', today),
      db.from('timer_sessions').select('*', { count: 'exact', head: true }),
      db.from('habit_completions')
        .select('completed_at, user_address')
        .gte('completed_at', sevenDaysAgo),
    ]);

    // Group DAU by date
    const dauMap: Record<string, Set<string>> = {};
    for (const row of dauRows ?? []) {
      const d = String(row.completed_at).split('T')[0];
      if (!dauMap[d]) dauMap[d] = new Set();
      dauMap[d].add(row.user_address);
    }
    const dau = Object.entries(dauMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, users]) => ({ date, users: users.size }));

    supabaseStats = {
      totalUsers:         totalUsers ?? 0,
      totalHabits:        totalHabits ?? 0,
      completionsAllTime: completionsAllTime ?? 0,
      completionsToday:   completionsToday ?? 0,
      totalSessions:      totalSessions ?? 0,
      dau,
    };
  }

  // ── Celoscan recent txs ─────────────────────────────────────────────────
  const [coreTxs, sessionTxs, circleTxs] = await Promise.all([
    fetchCeloscanTxs(CONTRACTS.ProovCore,      'ProovCore'),
    fetchCeloscanTxs(CONTRACTS.SessionManager, 'SessionManager'),
    fetchCeloscanTxs(CONTRACTS.CircleManager,  'CircleManager'),
  ]);

  const recentTxs = [...coreTxs, ...sessionTxs, ...circleTxs]
    .filter(tx => !tx.isError)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 30);

  // ── Dune (if configured) ────────────────────────────────────────────────
  const dune = DUNE_KEY ? {
    totalTxs:         await tryFetchDune(DUNE_QUERIES.totalTxs),
    uniqueUsers:      await tryFetchDune(DUNE_QUERIES.uniqueUsers),
    dailyTxs:         await tryFetchDune(DUNE_QUERIES.dailyTxs),
    contractActivity: await tryFetchDune(DUNE_QUERIES.contractActivity),
  } : null;

  return NextResponse.json({ supabaseStats, recentTxs, dune });
}
