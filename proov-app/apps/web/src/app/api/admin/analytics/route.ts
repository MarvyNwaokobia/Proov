import { NextResponse } from 'next/server';

const DUNE_API_KEY = process.env.DUNE_API_KEY || '';

const QUERY_IDS = {
  totalTxs:          process.env.DUNE_QUERY_TOTAL_TXS,
  uniqueUsers:       process.env.DUNE_QUERY_UNIQUE_USERS,
  dailyTxs:          process.env.DUNE_QUERY_DAILY_TXS,
  contractActivity:  process.env.DUNE_QUERY_CONTRACT_ACTIVITY,
  recentTxs:         process.env.DUNE_QUERY_RECENT_TXS,
};

async function fetchDune(queryId: string) {
  const res = await fetch(
    `https://api.dune.com/api/v1/query/${queryId}/results`,
    { headers: { 'X-Dune-API-Key': DUNE_API_KEY }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`Dune ${queryId} → ${res.status}`);
  const json = await res.json();
  return {
    rows:    json.result?.rows ?? [],
    columns: json.result?.metadata?.column_names ?? [],
  };
}

async function tryFetch(queryId: string | undefined) {
  if (!queryId) return { rows: [], columns: [], missing: true };
  try { return { ...(await fetchDune(queryId)), missing: false }; }
  catch (e: any) { return { rows: [], columns: [], missing: false, error: e.message }; }
}

export async function GET() {
  if (!DUNE_API_KEY) {
    return NextResponse.json({ error: 'DUNE_API_KEY not set' }, { status: 503 });
  }

  const [totalTxs, uniqueUsers, dailyTxs, contractActivity, recentTxs] =
    await Promise.all([
      tryFetch(QUERY_IDS.totalTxs),
      tryFetch(QUERY_IDS.uniqueUsers),
      tryFetch(QUERY_IDS.dailyTxs),
      tryFetch(QUERY_IDS.contractActivity),
      tryFetch(QUERY_IDS.recentTxs),
    ]);

  return NextResponse.json({ totalTxs, uniqueUsers, dailyTxs, contractActivity, recentTxs });
}
