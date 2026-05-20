"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  useCircle, useSendRequest, useAcceptRequest, useRejectRequest, useWitnessHabit,
} from "@/hooks/useCircle";
import {
  IconUsers,
  IconHeart,
  IconHeartFilled,
} from '@tabler/icons-react';
import { useStreak } from "@/hooks/useStreak";
import { TxToast } from "@/components/shared/TxToast";
import { isAddress } from "viem";
import { findAddressByUsername, displayName } from "@/lib/username";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function MemberRow({
  address: memberAddr,
  isSelf,
  onWitness,
  isWitnessing,
}: {
  address: `0x${string}`;
  isSelf?: boolean;
  onWitness: (addr: `0x${string}`, habitId: number) => void;
  isWitnessing: boolean;
}) {
  const { currentStreak, isActiveToday } = useStreak(memberAddr);
  const name = displayName(memberAddr);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 16, padding: '1rem',
        display: 'flex', alignItems: 'center', gap: 14,
        transition: 'border .2s',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
          {name.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{name}</p>
          {isSelf && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent-text)' }}>(you)</span>}
          {isActiveToday && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, display: 'inline-block' }} />
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{currentStreak.toString()} day streak</p>
      </div>

      <button
        onClick={() => onWitness(memberAddr, 0)}
        disabled={isWitnessing || !!isSelf}
        style={{
          fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none',
          cursor: isSelf ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: isSelf ? 0 : 1,
        }}
      >
        Witness
      </button>
    </motion.div>
  );
}

// Cheer helpers
function canCheer(memberAddr: string): boolean {
  if (typeof window === "undefined") return false;
  const today = new Date().toDateString();
  return !localStorage.getItem(`proov_cheered_${memberAddr}_${today}`);
}
function doCheer(memberAddr: string) {
  const today = new Date().toDateString();
  localStorage.setItem(`proov_cheered_${memberAddr}_${today}`, "1");
}

export default function CirclePage() {
  const router = useRouter();
  const { address, isConnected, status } = useAccount();
  useEffect(() => { if (status === 'disconnected') router.push("/"); }, [status, router]);

  const { circle, pending, refetch } = useCircle();
  const { sendRequest,    hash: sendHash,    isPending: isSending,    isSuccess: sendOk    } = useSendRequest();
  const { acceptRequest,  hash: acceptHash,  isPending: isAccepting,  isSuccess: acceptOk  } = useAcceptRequest();
  const { rejectRequest,  hash: rejectHash,  isPending: isRejecting,  isSuccess: rejectOk  } = useRejectRequest();
  const { witnessHabit,   hash: witnessHash, isPending: isWitnessing, isSuccess: witnessOk } = useWitnessHabit();

  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [resolvedAddr, setResolvedAddr] = useState<string | null>(null);
  const [cheeredMap, setCheeredMap] = useState<Record<string, boolean>>({});
  const [pendingInvite, setPendingInvite] = useState<string>("");
  const [showConfirmInvite, setShowConfirmInvite] = useState(false);
  const [cheerToast, setCheerToast] = useState({ visible: false });

  const handleCheer = (addr: string) => {
    doCheer(addr);
    setCheeredMap(m => ({ ...m, [addr]: true }));
    setCheerToast({ visible: true });
    setTimeout(() => setCheerToast({ visible: false }), 2500);
  };

  useEffect(() => {
    if (sendOk || acceptOk || rejectOk || witnessOk) refetch();
  }, [sendOk, acceptOk, rejectOk, witnessOk, refetch]);

  useEffect(() => {
    const val = input.trim();
    if (!val) { setResolvedAddr(null); setInputError(""); return; }
    if (val.startsWith("0x") && val.length === 42) {
      setResolvedAddr(val); setInputError("");
    } else {
      const username = val.replace(/^@/, "");
      const found = findAddressByUsername(username);
      if (found) { setResolvedAddr(found); setInputError(""); }
      else setResolvedAddr(null);
    }
  }, [input]);

  const handleSend = () => {
    const val = input.trim();
    if (!val) return;
    let target: string | null = null;
    if (val.startsWith("0x") && val.length === 42) {
      if (!isAddress(val)) { setInputError("Not a valid address."); return; }
      target = val;
    } else {
      const username = val.replace(/^@/, "");
      const found = findAddressByUsername(username);
      if (!found) { setInputError(`No user found with username "${username}"`); return; }
      target = found;
    }
    if (target?.toLowerCase() === address?.toLowerCase()) { setInputError("That's you!"); return; }
    setInputError("");
    setPendingInvite(target);
    setShowConfirmInvite(true);
  };

  const handleConfirmedInvite = () => {
    if (!pendingInvite) return;
    sendRequest(pendingInvite as `0x${string}`);
    setInput("");
    setResolvedAddr(null);
    setPendingInvite("");
    setShowConfirmInvite(false);
  };

  if (!isConnected) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 96 }}>

      {/* Accent glow — purely decorative */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 200, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, var(--accent-bg), transparent)',
        opacity: 0.4,
      }} />

      {/* Header */}
      <div style={{
        background: 'var(--nav-bg)',
        borderBottom: '1px solid var(--border)',
        padding: '1rem 1.25rem',
        position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
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
          }}><IconUsers size={18} color="#fff" stroke={1.8} /></div>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, margin: 0 }}>Circle</p>
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>{circle.length}/10 members</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 512, margin: '0 auto', padding: '1.25rem 1.25rem 0' }}>

        {/* ── Add member ── */}
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 20, padding: '1.25rem', marginBottom: '1.25rem',
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10,
          }}>Add Member</p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={input}
              onChange={e => { setInput(e.target.value); setInputError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
              placeholder="@username or address"
              style={{ flex: 1 }}
            />
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              style={{
                padding: '0 18px', borderRadius: 12, border: 'none',
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                opacity: (isSending || !input.trim()) ? 0.4 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isSending ? "…" : "Invite"}
            </motion.button>
          </div>

          {resolvedAddr && !inputError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}
            >
              ✓ {shortAddr(resolvedAddr)}
            </motion.p>
          )}

          <AnimatePresence>
            {inputError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ fontSize: 11, color: '#f43f5e', marginBottom: 4 }}
              >
                {inputError}
              </motion.p>
            )}
          </AnimatePresence>

          <p style={{ fontSize: 11, color: 'var(--text3)' }}>
            Your circle sees your progress, and cheers you on.
          </p>
        </div>

        {/* ── Pending requests ── */}
        <AnimatePresence>
          {pending.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginBottom: '1.25rem' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 10 }}>
                ⏳ Requests · {pending.length}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(from => (
                  <motion.div
                    key={from}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                    style={{
                      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                      borderRadius: 16, padding: '1rem',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--amber), #b45309)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{from.slice(2, 4).toUpperCase()}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text)', flex: 1, margin: 0 }}>{displayName(from)}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => acceptRequest(from)} disabled={isAccepting || isRejecting}
                        style={{
                          fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 10,
                          border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                          cursor: 'pointer', fontFamily: 'inherit', opacity: (isAccepting || isRejecting) ? 0.4 : 1,
                        }}>
                        Accept
                      </motion.button>
                      <button onClick={() => rejectRequest(from)} disabled={isAccepting || isRejecting}
                        style={{
                          fontSize: 12, padding: '7px 12px', borderRadius: 10,
                          border: '1px solid var(--border2)', background: 'transparent',
                          color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit',
                          opacity: (isAccepting || isRejecting) ? 0.4 : 1,
                        }}>
                        Reject
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Circle members ── */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
            Your Circle
          </p>
          {circle.length === 0 ? (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 16, padding: '2.5rem', textAlign: 'center',
            }}>
              <p style={{ fontSize: 36, marginBottom: 10 }}>◉</p>
              <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>Your circle is empty.</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Add by @username or address above</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {circle.map(addr => {
                const isSelf = addr.toLowerCase() === address?.toLowerCase();
                const cheered = cheeredMap[addr] || !canCheer(addr);
                return (
                  <div key={addr}>
                    <MemberRow address={addr} isSelf={isSelf} onWitness={witnessHabit} isWitnessing={isWitnessing} />
                    {!isSelf && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        {!cheered ? (
                          <button onClick={() => handleCheer(addr)} style={{
                            padding: '4px 12px', borderRadius: 14,
                            border: '1px solid var(--pink-border)', background: 'var(--pink-bg)',
                            color: 'var(--pink-text)', fontSize: 10, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <IconHeart size={14} stroke={2} /> Cheer
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--text3)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}><IconHeartFilled size={14} /> Cheered</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TxToast hash={sendHash}    pendingText="Sending invite…"   successText="Invite sent! ✓" />
      <TxToast hash={acceptHash}  pendingText="Connecting…"       successText="Connected! ✓" />
      <TxToast hash={rejectHash}  pendingText="Rejecting…"        successText="Request rejected." />
      <TxToast hash={witnessHash} pendingText="Witnessing…"       successText="Witnessed!" />

      {/* Cheer toast */}
      <div style={{
        position: 'fixed', bottom: 84, left: '50%',
        transform: `translateX(-50%) translateY(${cheerToast.visible ? 0 : 16}px)`,
        opacity: cheerToast.visible ? 1 : 0,
        background: 'var(--pink)', color: '#fff',
        padding: '9px 18px', borderRadius: 20,
        fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        pointerEvents: 'none', zIndex: 9999,
        transition: 'all 0.3s cubic-bezier(.34,1.56,.64,1)',
        whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,.15)',
      }}>
        Cheer sent
      </div>

      {/* Confirm invite modal */}
      {showConfirmInvite && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 1rem 1.5rem' }}
          onClick={() => setShowConfirmInvite(false)}
        >
          <div
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '1.5rem', width: '100%', maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Add to circle?</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>{pendingInvite.startsWith('0x') ? `${pendingInvite.slice(0, 8)}…${pendingInvite.slice(-4)}` : pendingInvite}</strong> will see your habit activity and you'll see theirs.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setShowConfirmInvite(false)}
                style={{ padding: 11, borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={handleConfirmedInvite}
                style={{ padding: 11, borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Add them
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
