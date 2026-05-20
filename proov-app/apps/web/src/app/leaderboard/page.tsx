"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import Link from "next/link";
import { useLeaderboard } from "@/hooks/useStreak";
import { displayName } from "@/lib/username";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/goldsky";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const router = useRouter();
  const { address, isConnected, status } = useAccount();
  useEffect(() => { if (status === 'disconnected') router.push("/"); }, [status, router]);

  const { entries: contractEntries, isLoading: contractLoading } = useLeaderboard(50);
  const [goldskyEntries, setGoldskyEntries] = useState<LeaderboardEntry[]>([]);
  const [goldskyLoaded, setGoldskyLoaded] = useState(false);

  useEffect(() => {
    getLeaderboard(100).then(data => {
      setGoldskyEntries(data);
      setGoldskyLoaded(true);
    });
  }, []);

  // Prefer Goldsky when available; fall back to on-chain contract data
  const entries = goldskyLoaded && goldskyEntries.length > 0
    ? goldskyEntries.map(e => ({ address: e.id as `0x${string}`, streak: BigInt(e.currentStreak ?? 0) }))
    : contractEntries;
  const isLoading = goldskyLoaded ? false : contractLoading;

  if (!isConnected) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 96 }}>

      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 250, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, var(--accent-bg), transparent)', opacity: 0.4,
      }} />

      {/* Header */}
      <div style={{
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)',
        padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/dashboard" style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: 'var(--text3)', textDecoration: 'none',
            border: '1px solid var(--border2)', background: 'var(--bg2)',
          }}>←</Link>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff',
          }}>🏆</div>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, margin: 0 }}>Leaderboard</p>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Ranked by streak</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 512, margin: '0 auto', padding: '1.25rem 1.25rem 0' }}>

        {/* Top 3 podium */}
        {!isLoading && entries.length >= 3 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 24 }}>

            {/* 2nd */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ flex: 1 }}>
              <Link href={`/profile/${entries[1].address}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #6b7280, #4b5563)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{entries[1].address.slice(2, 4).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 20 }}>🥈</span>
                <p style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', margin: 0 }}>{displayName(entries[1].address)}</p>
                <div style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '10px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{entries[1].streak.toString()}</p>
                  <p style={{ fontSize: 9, color: 'var(--text3)', margin: 0 }}>days</p>
                </div>
              </Link>
            </motion.div>

            {/* 1st */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ flex: 1 }}>
              <Link href={`/profile/${entries[0].address}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <motion.div
                  animate={{ boxShadow: ['0 0 16px rgba(245,158,11,0.3)', '0 0 32px rgba(245,158,11,0.5)', '0 0 16px rgba(245,158,11,0.3)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span style={{ color: '#fff', fontSize: 18, fontWeight: 900 }}>{entries[0].address.slice(2, 4).toUpperCase()}</span>
                </motion.div>
                <span style={{ fontSize: 24 }}>🥇</span>
                <p style={{ fontSize: 10, color: 'var(--text2)', textAlign: 'center', margin: 0 }}>{displayName(entries[0].address)}</p>
                <div style={{ width: '100%', borderRadius: 12, padding: '10px 0', textAlign: 'center', background: 'rgba(146,64,14,0.25)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p style={{ fontSize: 24, fontWeight: 900, color: '#fcd34d', margin: 0 }}>{entries[0].streak.toString()}</p>
                  <p style={{ fontSize: 9, color: 'rgba(245,158,11,0.5)', margin: 0 }}>days</p>
                </div>
              </Link>
            </motion.div>

            {/* 3rd */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ flex: 1 }}>
              <Link href={`/profile/${entries[2].address}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #92400e, #78350f)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{entries[2].address.slice(2, 4).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 20 }}>🥉</span>
                <p style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', margin: 0 }}>{displayName(entries[2].address)}</p>
                <div style={{ width: '100%', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '10px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{entries[2].streak.toString()}</p>
                  <p style={{ fontSize: 9, color: 'var(--text3)', margin: 0 }}>days</p>
                </div>
              </Link>
            </motion.div>
          </div>
        )}

        {/* Full list */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ width: 32, height: 32, borderRadius: '50%', margin: '0 auto', border: '2px solid var(--accent-bg)', borderTopColor: 'var(--accent)' }} />
          </div>
        ) : entries.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '3rem', textAlign: 'center' }}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>◈</p>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>No players yet.</p>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Be the first to log a habit.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.slice(entries.length >= 3 ? 3 : 0).map((entry, i) => {
              const rank = (entries.length >= 3 ? 3 : 0) + i;
              const isMe = entry.address.toLowerCase() === address?.toLowerCase();
              const name = displayName(entry.address);
              return (
                <motion.div key={entry.address} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
                  <Link
                    href={`/profile/${entry.address}`}
                    style={{
                      textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: 14,
                      borderRadius: 16, padding: '10px 14px',
                      background: isMe ? 'var(--accent-bg)' : 'var(--card-bg)',
                      border: `1px solid ${isMe ? 'var(--accent-border)' : 'var(--card-border)'}`,
                      transition: 'border .15s',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, minWidth: 28, textAlign: 'right', flexShrink: 0, color: 'var(--text3)', fontFamily: 'monospace' }}>
                      {rank < 3 ? MEDALS[rank] : `#${rank + 1}`}
                    </span>
                    <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
                      <span style={{ color: 'var(--accent-text)', fontSize: 10, fontWeight: 700 }}>{entry.address.slice(2, 4).toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: isMe ? 'var(--accent-text)' : 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}{isMe && <span style={{ color: 'var(--accent-text)', fontSize: 10, marginLeft: 6 }}>you</span>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--streak-color, var(--amber))' }}>{entry.streak.toString()}</span>
                      <span style={{ fontSize: 11 }}>🔥</span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
