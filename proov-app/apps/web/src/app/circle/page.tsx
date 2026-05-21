"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconUsers } from '@tabler/icons-react';
import {
  getAddressForUsername,
  sendCircleRequest,
  getCircleRequests,
  respondToCircleRequest,
  getUsernamesForAddresses,
  type CircleRequest,
} from "@/lib/supabase";

export default function CirclePage() {
  const router = useRouter();

  const [sent, setSent] = useState<CircleRequest[]>([]);
  const [received, setReceived] = useState<CircleRequest[]>([]);
  const [accepted, setAccepted] = useState<CircleRequest[]>([]);
  const [usernameMap, setUsernameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [resolvedUsername, setResolvedUsername] = useState('');

  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [cheeredMap, setCheeredMap] = useState<Record<string, boolean>>({});

  const myAddress = typeof window !== 'undefined'
    ? (localStorage.getItem('proov_address') || '').toLowerCase()
    : '';

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  // ── Load circle data ────────────────────────────────────────────────────────
  const loadCircleData = useCallback(async () => {
    const address = localStorage.getItem('proov_address') || '';
    if (!address) { setLoading(false); return; }

    const { sent: s, received: r, accepted: a } = await getCircleRequests(address);
    setSent(s);
    setReceived(r);
    setAccepted(a);

    const allAddresses = [
      ...s.map(x => x.to_address),
      ...r.map(x => x.from_address),
      ...a.map(x => x.from_address === address.toLowerCase() ? x.to_address : x.from_address),
    ];
    if (allAddresses.length > 0) {
      const map = await getUsernamesForAddresses(allAddresses).catch(() => ({}));
      setUsernameMap(map);
    }
    setLoading(false);
  }, []);

  // Mount + poll every 30 seconds
  useEffect(() => {
    loadCircleData();
    const interval = setInterval(loadCircleData, 30000);
    return () => clearInterval(interval);
  }, [loadCircleData]);

  // ── Invite: clear errors on input change ───────────────────────────────────
  useEffect(() => {
    setInviteError('');
    setResolvedAddress('');
    setResolvedUsername('');
  }, [inviteInput]);

  // ── Invite submit: validate then show confirm ───────────────────────────────
  const handleInviteSubmit = async () => {
    const raw = inviteInput.trim();
    if (!raw) return;
    setInviteLoading(true);
    setInviteError('');

    const clean = raw.replace(/^@/, '').toLowerCase();

    const address = await getAddressForUsername(clean).catch(() => null);
    if (!address) {
      setInviteError(`@${clean} not found — they need to join Proov first`);
      setInviteLoading(false);
      return;
    }

    if (address.toLowerCase() === myAddress) {
      setInviteError("That's you!");
      setInviteLoading(false);
      return;
    }

    const allRequests = [...sent, ...received, ...accepted];
    const alreadyExists = allRequests.some(
      r => r.to_address === address.toLowerCase() || r.from_address === address.toLowerCase()
    );
    if (alreadyExists) {
      setInviteError('Already in your circle or request pending');
      setInviteLoading(false);
      return;
    }

    setResolvedAddress(address);
    setResolvedUsername(clean);
    setInviteLoading(false);
    setShowConfirm(true);
  };

  const handleConfirmInvite = async () => {
    if (!resolvedAddress) return;
    await sendCircleRequest(myAddress, resolvedAddress).catch(() => {});
    setInviteInput('');
    setResolvedAddress('');
    setResolvedUsername('');
    setShowConfirm(false);
    showToast('Invite sent ✓');
    loadCircleData();
  };

  const handleAccept = async (requestId: string) => {
    await respondToCircleRequest(requestId, 'accepted').catch(() => {});
    showToast('Connected ✓');
    loadCircleData();
  };

  const handleDecline = async (requestId: string) => {
    await respondToCircleRequest(requestId, 'declined').catch(() => {});
    loadCircleData();
  };

  const handleCheer = (addr: string) => {
    const today = new Date().toDateString();
    localStorage.setItem(`proov_cheered_${addr}_${today}`, '1');
    setCheeredMap(m => ({ ...m, [addr]: true }));
    showToast('Cheer sent 🌸');
  };

  const canCheer = (addr: string) => {
    if (cheeredMap[addr]) return false;
    const today = new Date().toDateString();
    return !localStorage.getItem(`proov_cheered_${addr}_${today}`);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 96 }}>

      {/* Accent glow */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 400, height: 200, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(ellipse, var(--accent-bg), transparent)', opacity: 0.4 }} />

      {/* Header */}
      <div style={{ background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/dashboard" style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text3)', textDecoration: 'none', border: '1px solid var(--border2)', background: 'var(--bg2)' }}>←</Link>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, var(--accent), var(--accent2, var(--accent)))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconUsers size={18} color="#fff" stroke={1.8} />
          </div>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15, margin: 0 }}>Circle</p>
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>{accepted.length} member{accepted.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 512, margin: '0 auto', padding: '1.25rem 1.25rem 0' }}>

        {/* Invite input */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>Add Member</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={inviteInput}
              onChange={e => setInviteInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInviteSubmit()}
              placeholder="@username"
              style={{ flex: 1 }}
            />
            <button
              onClick={handleInviteSubmit}
              disabled={inviteLoading || !inviteInput.trim()}
              style={{ padding: '0 18px', borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (inviteLoading || !inviteInput.trim()) ? 0.4 : 1, whiteSpace: 'nowrap' }}
            >
              {inviteLoading ? '…' : 'Invite'}
            </button>
          </div>
          {inviteError && (
            <p style={{ fontSize: 11, color: '#f43f5e', marginBottom: 4 }}>{inviteError}</p>
          )}
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Your circle sees your progress and cheers you on.</p>
        </div>

        {/* SECTION 1: Incoming requests */}
        {received.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-text)', margin: '14px 0 8px' }}>
              {received.length} circle request{received.length !== 1 ? 's' : ''}
            </div>
            {received.map(req => {
              const username = usernameMap[req.from_address] || req.from_address.slice(0, 8);
              return (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1.5px solid var(--accent-border)', background: 'var(--accent-bg)', marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--btn-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--btn-primary-text)', flexShrink: 0 }}>
                    {username[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>@{username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>wants to join your circle</div>
                  </div>
                  <button onClick={() => handleAccept(req.id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Accept</button>
                  <button onClick={() => handleDecline(req.id)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                </div>
              );
            })}
          </div>
        )}

        {/* SECTION 2: Your circle (accepted) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', margin: '14px 0 8px' }}>
            Your circle · {accepted.length}
          </div>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '2rem 0' }}>Loading…</p>
          ) : accepted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text3)', fontSize: 13 }}>
              Your circle is empty. Invite someone who will hold you accountable.
            </div>
          ) : (
            accepted.map(req => {
              const otherAddress = req.from_address === myAddress ? req.to_address : req.from_address;
              const username = usernameMap[otherAddress] || otherAddress.slice(0, 8);
              const cheerAvailable = canCheer(otherAddress);
              return (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card-bg)', marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', flexShrink: 0 }}>
                    {username[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>@{username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>In your circle</div>
                  </div>
                  {cheerAvailable ? (
                    <button onClick={() => handleCheer(otherAddress)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--accent-border)', background: 'transparent', color: 'var(--accent-text)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                      🌸 Cheer
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text3)', padding: '6px 0' }}>Cheered ✓</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* SECTION 3: Pending sent requests */}
        {sent.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', margin: '14px 0 8px' }}>
              Pending · {sent.length}
            </div>
            {sent.map(req => {
              const username = usernameMap[req.to_address] || req.to_address.slice(0, 8);
              return (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card-bg)', opacity: 0.7, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
                    {username[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>@{username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Waiting for them to accept</div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 6 }}>Pending</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      <div style={{ position: 'fixed', bottom: 84, left: '50%', transform: `translateX(-50%) translateY(${toastVisible ? 0 : 16}px)`, opacity: toastVisible ? 1 : 0, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '9px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', pointerEvents: 'none', zIndex: 9999, transition: 'all 0.3s cubic-bezier(.34,1.56,.64,1)', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>
        {toast}
      </div>

      {/* Confirm invite bottom sheet */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 1rem 1.5rem' }} onClick={() => setShowConfirm(false)}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '1.5rem', width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Add to circle?</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>@{resolvedUsername}</strong> will see your habit activity and you'll see theirs.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setShowConfirm(false)} style={{ padding: 11, borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleConfirmInvite} style={{ padding: 11, borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Add them</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
