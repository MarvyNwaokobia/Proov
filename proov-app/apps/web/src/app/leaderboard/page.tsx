"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useLeaderboard } from "@/hooks/useStreak";
import { displayName } from "@/lib/username";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/goldsky";
import { getUsernamesForAddresses } from "@/lib/supabase";
import { IconArrowLeft, IconFlame } from "@tabler/icons-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entry = { address: string; streak: number; username: string };
type CircleMember = { address: string; username: string; streak: number };

// ─── Avatar ──────────────────────────────────────────────────────────────────

const RANK_STYLES = [
  { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'rgba(245,158,11,0.5)', color: '#fff' },
  { bg: 'linear-gradient(135deg, #9ca3af, #6b7280)', border: 'rgba(156,163,175,0.5)', color: '#fff' },
  { bg: 'linear-gradient(135deg, #b45309, #92400e)', border: 'rgba(180,83,9,0.5)',   color: '#fff' },
];

function Avatar({ name, size = 36, rank }: { name: string; size?: number; rank?: number }) {
  const s = rank !== undefined && rank < 3 ? RANK_STYLES[rank] : null;
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: s?.bg ?? 'var(--accent-bg)',
      border: `2px solid ${s?.border ?? 'var(--accent-border)'}`,
      color: s?.color ?? 'var(--accent-text)',
      fontWeight: 800, fontSize: Math.round(size * 0.38), fontFamily: 'inherit',
    }}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

// ─── Podium column ────────────────────────────────────────────────────────────

const PODIUM = [
  { rankIdx: 1, rankLabel: '2', blockH: 72,  avatarSz: 44, labelColor: '#9ca3af' },
  { rankIdx: 0, rankLabel: '1', blockH: 100, avatarSz: 58, labelColor: '#f59e0b' },
  { rankIdx: 2, rankLabel: '3', blockH: 56,  avatarSz: 40, labelColor: '#b45309' },
];

function PodiumCol({ entry, cfg, isMe }: {
  entry: Entry;
  cfg: typeof PODIUM[number];
  isMe: boolean;
}) {
  const goldBlock = cfg.rankIdx === 0;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 900, color: cfg.labelColor }}>{cfg.rankLabel}</span>
      <Avatar name={entry.username} size={cfg.avatarSz} rank={cfg.rankIdx} />
      <p style={{
        fontSize: 10, fontWeight: 600, margin: 0, textAlign: 'center',
        color: isMe ? 'var(--accent-text)' : 'var(--text2)',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '0 4px',
      }}>
        @{entry.username}
      </p>
      <div style={{
        width: '100%', height: cfg.blockH, borderRadius: '10px 10px 0 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        background: goldBlock ? 'rgba(245,158,11,0.12)' : 'var(--card-bg)',
        border: `1px solid ${goldBlock ? 'rgba(245,158,11,0.28)' : 'var(--card-border)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <IconFlame size={goldBlock ? 13 : 11} stroke={2} color="#f59e0b" />
          <span style={{ fontSize: goldBlock ? 22 : 17, fontWeight: 900, color: goldBlock ? '#f59e0b' : 'var(--text)', lineHeight: 1 }}>
            {entry.streak}
          </span>
        </div>
        <span style={{ fontSize: 9, color: 'var(--text3)' }}>day streak</span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const router = useRouter();
  const { address } = useAccount();
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    const addr = localStorage.getItem('proov_address');
    if (!addr) { router.push('/'); setAuthed(false); } else { setAuthed(true); }
  }, [router]);

  const [tab, setTab] = useState<'global' | 'circle'>('global');

  // Global data sources
  const { entries: contractEntries, isLoading: contractLoading } = useLeaderboard(50);
  const [goldskyEntries, setGoldskyEntries] = useState<LeaderboardEntry[]>([]);
  const [goldskyLoaded, setGoldskyLoaded] = useState(false);
  const [usernameMap, setUsernameMap] = useState<Record<string, string>>({});

  // Circle data
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);

  // Current user (loaded client-side)
  const [me, setMe] = useState<{ address: string; username: string; streak: number } | null>(null);

  useEffect(() => {
    const addr = (address?.toLowerCase() || localStorage.getItem('proov_address') || '').toLowerCase();
    if (!addr) return;
    const un = localStorage.getItem('proov_username') || displayName(addr);
    const streak = parseInt(localStorage.getItem('proov_streak_count') || '0');
    setMe({ address: addr, username: un, streak });
  }, [address]);

  useEffect(() => {
    getLeaderboard(100).then(data => {
      setGoldskyEntries(data);
      setGoldskyLoaded(true);
      const addrs = data.map(e => e.id.toLowerCase());
      getUsernamesForAddresses(addrs).then(setUsernameMap).catch(() => {});
    });
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('proov_circle');
    if (raw) { try { setCircleMembers(JSON.parse(raw)); } catch {} }
  }, []);

  const globalEntries: Entry[] = useMemo(() => {
    const raw = goldskyLoaded && goldskyEntries.length > 0
      ? goldskyEntries.map(e => ({ address: e.id as string, streak: Number(e.currentStreak ?? 0) }))
      : contractEntries.map(e => ({ address: e.address as string, streak: Number(e.streak) }));
    const mapped: Entry[] = raw.map(e => ({
      address: e.address,
      streak: e.streak,
      username: usernameMap[e.address.toLowerCase()] || displayName(e.address),
    }));
    // Always include the current user if they have a streak and aren't in the on-chain data yet
    if (me && me.streak > 0 && !mapped.some(e => e.address.toLowerCase() === me.address.toLowerCase())) {
      mapped.push({ address: me.address, streak: me.streak, username: me.username });
    }
    return mapped.sort((a, b) => b.streak - a.streak);
  }, [goldskyLoaded, goldskyEntries, contractEntries, usernameMap, me]);

  const circleEntries: Entry[] = useMemo(() => {
    if (!me) return [];
    const self: Entry = { address: me.address, streak: me.streak, username: me.username };
    const others = circleMembers
      .filter(m => m.address.toLowerCase() !== me.address)
      .map(m => ({ address: m.address, streak: m.streak ?? 0, username: m.username }));
    return [self, ...others].sort((a, b) => b.streak - a.streak);
  }, [circleMembers, me]);

  const entries = tab === 'global' ? globalEntries : circleEntries;
  const loading = tab === 'global' ? (goldskyLoaded ? false : contractLoading) : false;

  const myRank = me ? entries.findIndex(e => e.address.toLowerCase() === me.address) + 1 : 0;

  // Cache global rank so Settings can display it without reloading leaderboard data
  useEffect(() => {
    if (tab === 'global' && myRank > 0) {
      localStorage.setItem('proov_leaderboard_rank', String(myRank));
    }
  }, [tab, myRank]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Podium order: 2nd left, 1st center, 3rd right
  const podiumOrder = top3.length >= 3
    ? [{ entry: top3[1], cfg: PODIUM[0] }, { entry: top3[0], cfg: PODIUM[1] }, { entry: top3[2], cfg: PODIUM[2] }]
    : [];

  if (authed === null || authed === false) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 160 }}>

      {/* Accent glow */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 480, height: 220, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, var(--accent-bg), transparent)', opacity: 0.45, zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)',
        padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text3)', border: '1px solid var(--border2)', background: 'var(--bg2)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <IconArrowLeft size={16} stroke={2} />
          </button>
          <div>
            <p style={{ fontWeight: 800, color: 'var(--text)', fontSize: 16, margin: 0, letterSpacing: '-.3px' }}>Leaderboard</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>Ranked by streak</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 512, margin: '0 auto', padding: '1rem 1.25rem 0', position: 'relative', zIndex: 1 }}>

        {/* Tab toggle */}
        <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 12, padding: 4, gap: 3, marginBottom: 20 }}>
          {(['global', 'circle'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, textAlign: 'center', padding: '7px 0',
              borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12,
              background: tab === t ? 'var(--card-bg)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--text3)',
              fontWeight: tab === t ? 700 : 500,
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
              transition: 'all 0.2s',
            }}>
              {t === 'global' ? 'Global' : 'Circle'}
            </button>
          ))}
        </div>

        {/* Loading spinner */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', margin: '0 auto',
              border: '2px solid var(--accent-bg)', borderTopColor: 'var(--accent)',
              animation: 'lb-spin 1s linear infinite',
            }} />
            <style>{`@keyframes lb-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Empty */}
        {!loading && entries.length === 0 && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
              {tab === 'circle' ? 'Add friends to see them here.' : 'Be the first on the board — keep your streak going.'}
            </p>
          </div>
        )}

        {/* Podium — top 3 */}
        {!loading && podiumOrder.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
            {podiumOrder.map(({ entry, cfg }) => (
              <PodiumCol
                key={entry.address}
                entry={entry}
                cfg={cfg}
                isMe={entry.address.toLowerCase() === (me?.address ?? '')}
              />
            ))}
          </div>
        )}

        {/* Simple list when < 3 entries */}
        {!loading && entries.length > 0 && top3.length < 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map((entry, i) => {
              const isMe = entry.address.toLowerCase() === (me?.address ?? '');
              return (
                <div key={entry.address} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderRadius: 14, padding: '10px 14px',
                  background: isMe ? 'var(--accent-bg)' : 'var(--card-bg)',
                  border: `1px solid ${isMe ? 'var(--accent-border)' : 'var(--card-border)'}`,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 26, color: 'var(--text3)', fontFamily: 'monospace', flexShrink: 0 }}>
                    #{i + 1}
                  </span>
                  <Avatar name={entry.username} size={34} />
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: isMe ? 'var(--accent-text)' : 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    @{entry.username}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <IconFlame size={13} stroke={2} color="#f59e0b" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{entry.streak}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ranked list — #4 and beyond */}
        {!loading && rest.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
            {rest.map((entry, i) => {
              const rank = 4 + i;
              const isMe = entry.address.toLowerCase() === (me?.address ?? '');
              return (
                <div key={entry.address} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderRadius: 14, padding: '10px 14px',
                  background: isMe ? 'var(--accent-bg)' : 'var(--card-bg)',
                  border: `1px solid ${isMe ? 'var(--accent-border)' : 'var(--card-border)'}`,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 26, textAlign: 'right', color: 'var(--text3)', fontFamily: 'monospace', flexShrink: 0 }}>
                    #{rank}
                  </span>
                  <Avatar name={entry.username} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isMe ? 'var(--accent-text)' : 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      @{entry.username}
                      {isMe && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text3)', fontWeight: 400 }}>you</span>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <IconFlame size={13} stroke={2} color="#f59e0b" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{entry.streak}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pinned current-user bar */}
      {me && !loading && (
        <div style={{ position: 'fixed', bottom: 68, left: 0, right: 0, zIndex: 40, padding: '0 1.25rem' }}>
          <div style={{ maxWidth: 512, margin: '0 auto' }}>
            <div style={{
              background: 'var(--card-bg)', border: '1.5px solid var(--accent-border)',
              borderRadius: 14, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 28, textAlign: 'right', color: 'var(--text3)', fontFamily: 'monospace', flexShrink: 0 }}>
                {myRank > 0 ? `#${myRank}` : '—'}
              </span>
              <Avatar name={me.username} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{me.username}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text3)', margin: 0 }}>You</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <IconFlame size={14} stroke={2} color="#f59e0b" />
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{me.streak}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
