"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import Link from "next/link";
import { useLeaderboard } from "@/hooks/useStreak";
import { displayName } from "@/lib/username";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  const { entries, isLoading } = useLeaderboard(50);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen app-bg pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] opacity-[0.05] rounded-full"
        style={{ background: "radial-gradient(ellipse, var(--accent), transparent)" }} />

      {/* Header */}
      <div style={{
        background: 'var(--nav-bg)',
        borderBottom: '1px solid var(--border)',
        padding: '1rem 1.25rem',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/dashboard" style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text3)', textDecoration: 'none', border: '1px solid var(--border2)', background: 'var(--bg2)', flexShrink: 0 }}>←</Link>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', flexShrink: 0 }}>🏆</div>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>Leaderboard</p>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Ranked by streak</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5">

        {/* Top 3 podium */}
        {!isLoading && entries.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-6">
            {/* 2nd */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex-1">
              <Link href={`/profile/${entries[1].address}`} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{entries[1].address.slice(2, 4).toUpperCase()}</span>
                </div>
                <span className="text-xl">🥈</span>
                <p className="text-white/60 text-[10px] text-center">{displayName(entries[1].address)}</p>
                <div className="w-full glass rounded-xl py-3 text-center">
                  <p className="text-white font-bold text-lg">{entries[1].streak.toString()}</p>
                  <p className="text-white/30 text-[10px]">days</p>
                </div>
              </Link>
            </motion.div>

            {/* 1st */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="flex-1">
              <Link href={`/profile/${entries[0].address}`} className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{ boxShadow: ["0 0 16px rgba(245,158,11,0.3)", "0 0 32px rgba(245,158,11,0.5)", "0 0 16px rgba(245,158,11,0.3)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center"
                >
                  <span className="text-white text-lg font-black">{entries[0].address.slice(2, 4).toUpperCase()}</span>
                </motion.div>
                <span className="text-2xl">🥇</span>
                <p className="text-white/80 text-[10px] text-center">{displayName(entries[0].address)}</p>
                <div className="w-full rounded-xl py-3 text-center"
                  style={{ background: "linear-gradient(135deg, #92400e40, #78350f40)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <p className="text-amber-300 font-black text-2xl">{entries[0].streak.toString()}</p>
                  <p className="text-amber-500/50 text-[10px]">days</p>
                </div>
              </Link>
            </motion.div>

            {/* 3rd */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex-1">
              <Link href={`/profile/${entries[2].address}`} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-800 to-orange-900 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{entries[2].address.slice(2, 4).toUpperCase()}</span>
                </div>
                <span className="text-xl">🥉</span>
                <p className="text-white/60 text-[10px] text-center">{displayName(entries[2].address)}</p>
                <div className="w-full glass rounded-xl py-3 text-center">
                  <p className="text-white font-bold text-lg">{entries[2].streak.toString()}</p>
                  <p className="text-white/30 text-[10px]">days</p>
                </div>
              </Link>
            </motion.div>
          </div>
        )}

        {/* Full list */}
        {isLoading ? (
          <div className="text-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 rounded-full mx-auto" style={{ border: '2px solid var(--accent-bg)', borderTopColor: 'var(--accent)' }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center">
            <p className="text-4xl mb-3">◈</p>
            <p className="text-white/40 text-sm">No players yet.</p>
            <p className="text-white/20 text-xs mt-1">Be the first to log a habit.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.slice(entries.length >= 3 ? 3 : 0).map((entry, i) => {
              const rank = (entries.length >= 3 ? 3 : 0) + i;
              const isMe = entry.address.toLowerCase() === address?.toLowerCase();
              const name = displayName(entry.address);
              return (
                <motion.div key={entry.address} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}>
                  <Link href={`/profile/${entry.address}`}
                    className={`flex items-center gap-4 rounded-2xl px-4 py-3 transition-all ${isMe ? "" : "glass glass-hover"}`}
                    style={isMe ? { background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' } : undefined}
                  >
                    <span className="text-white/30 text-xs font-mono w-7 text-right flex-shrink-0">
                      {rank < 3 ? MEDALS[rank] : `#${rank + 1}`}
                    </span>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
                      <span style={{ color: 'var(--accent-text)', fontSize: 10, fontWeight: 700 }}>{entry.address.slice(2, 4).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: isMe ? 'var(--accent-text)' : 'var(--text2)' }}>
                        {name}
                        {isMe && <span style={{ color: 'var(--accent-text)', fontSize: 10, marginLeft: 6 }}>you</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-white font-bold text-sm">{entry.streak.toString()}</span>
                      <span className="text-white/30 text-xs">🔥</span>
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
