"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getCircleRequests, getUsernamesForAddresses, getStreakData,
  getGlobalLeaderboard,
} from "@/lib/supabase";
import { IconArrowLeft, IconFlame } from "@tabler/icons-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entry = { address: string; streak: number; username: string };

// ─── Podium config ────────────────────────────────────────────────────────────

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
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [myAddress, setMyAddress] = useState('');

  useEffect(() => {
    const addr = localStorage.getItem('proov_address');
    if (!addr) { router.push('/'); setAuthed(false); } else { setMyAddress(addr.toLowerCase()); setAuthed(true); }
  }, [router]);

  const [tab, setTab] = useState<'global' | 'circle'>('global');

  const [globalRaw, setGlobalRaw] = useState<{ address: string; streak: number }[]>([]);
  const [usernameMap, setUsernameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [circleEntries, setCircleEntries] = useState<Entry[]>([]);
  const [circleLoading, setCircleLoading] = useState(false);

  // Load global leaderboard from Supabase streaks table
  useEffect(() => {
    if (!myAddress) return;
    setLoading(true);
    getGlobalLeaderboard(100).then(async rows => {
      setGlobalRaw(rows);
      const addrs = rows.map(r => r.address);
      if (addrs.length > 0) {
        const map = await getUsernamesForAddresses(addrs).catch(() => ({}));
        setUsernameMap(map);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [myAddress]);

  // Load circle tab from Supabase
  useEffect(() => {
    if (tab !== 'circle' || !myAddress) return;
    setCircleLoading(true);
    getCircleRequests(myAddress).then(async ({ accepted }) => {
      const memberAddrs = accepted.map(r =>
        r.from_address === myAddress ? r.to_address : r.from_address
      );
      const allAddrs = [myAddress, ...memberAddrs];
      const [streaks, usernames] = await Promise.all([
        Promise.all(allAddrs.map(addr => getStreakData(addr).catch(() => ({ currentStreak: 0 })))),
        getUsernamesForAddresses(allAddrs).catch(() => ({} as Record<string, string>)),
      ]);
      const entries: Entry[] = allAddrs.map((addr, i) => ({
        address: addr,
        streak: streaks[i]?.currentStreak ?? 0,
        username: usernames[addr] || addr.slice(0, 8),
      }));
      setCircleEntries(entries.sort((a, b) => b.streak - a.streak));
      setCircleLoading(false);
    }).catch(() => setCircleLoading(false));
  }, [tab, myAddress]);

  const globalEntries: Entry[] = useMemo(() => {
    const myUsername = localStorage.getItem('proov_username') || myAddress.slice(0, 8);
    const myStreak = parseInt(localStorage.getItem('proov_streak_count') || '0');

    const mapped: Entry[] = globalRaw.map(r => ({
      address: r.address,
      streak: r.streak,
      username: usernameMap[r.address] || r.address.slice(0, 8),
    }));

    // Include current user if not already present (e.g., streak = 0 was filtered out)
    if (myAddress && !mapped.some(e => e.address === myAddress)) {
      if (myStreak > 0) {
        mapped.push({ address: myAddress, streak: myStreak, username: myUsername });
      }
    }

    return mapped.sort((a, b) => b.streak - a.streak);
  }, [globalRaw, usernameMap, myAddress]);

  const entries = tab === 'global' ? globalEntries : circleEntries;
  const isLoading = tab === 'global' ? loading : circleLoading;

  const myRank = myAddress ? entries.findIndex(e => e.address === myAddress) + 1 : 0;
  const me = myAddress ? entries.find(e => e.address === myAddress) ?? null : null;

  // Cache rank for settings page
  useEffect(() => {
    if (tab === 'global' && myRank > 0) {
      localStorage.setItem('proov_leaderboard_rank', String(myRank));
    }
  }, [tab, myRank]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
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
        {isLoading && (
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
        {!isLoading && entries.length === 0 && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
              {tab === 'circle' ? 'Add friends to your circle to compare streaks.' : 'No streaks yet — keep your habits going!'}
            </p>
          </div>
        )}

        {/* Podium — top 3 */}
        {!isLoading && podiumOrder.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
            {podiumOrder.map(({ entry, cfg }) => (
              <PodiumCol
                key={entry.address}
                entry={entry}
                cfg={cfg}
                isMe={entry.address === myAddress}
              />
            ))}
          </div>
        )}

        {/* Simple list when < 3 entries */}
        {!isLoading && entries.length > 0 && top3.length < 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map((entry, i) => {
              const isMe = entry.address === myAddress;
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
        {!isLoading && rest.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
            {rest.map((entry, i) => {
              const rank = 4 + i;
              const isMe = entry.address === myAddress;
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
      {me && !isLoading && (
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
