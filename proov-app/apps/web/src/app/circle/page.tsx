"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft, IconFlame, IconHeart, IconBell, IconCheck, IconSend,
  IconAlertTriangle, IconSparkles,
} from "@tabler/icons-react";
import {
  getAddressForUsername,
  sendCircleRequest,
  getCircleRequests,
  respondToCircleRequest,
  getUsernamesForAddresses,
  getStreakData,
  getLatestActivityForAddress,
  sendNudge,
  getTodayNudgesSent,
  type CircleRequest,
} from "@/lib/supabase";
import { useProovTx } from "@/hooks/useProovTx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent-bg)', border: '1.5px solid var(--accent-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--accent-text)', fontWeight: 800,
      fontSize: Math.round(size * 0.38), fontFamily: 'inherit',
    }}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberInfo = {
  streak: number;
  lastCompletionDate: string | null;
  activityName: string | null;
  activityTime: string | null;
  habitVisibility: string;
  habitVisibleTo: string[];
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CirclePage() {
  const router = useRouter();
  const proovTx = useProovTx();

  const [tab, setTab] = useState<'members' | 'requests'>('members');

  const [sent, setSent] = useState<CircleRequest[]>([]);
  const [received, setReceived] = useState<CircleRequest[]>([]);
  const [accepted, setAccepted] = useState<CircleRequest[]>([]);
  const [usernameMap, setUsernameMap] = useState<Record<string, string>>({});
  const [memberData, setMemberData] = useState<Record<string, MemberInfo>>({});
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
  const [nudgedMap, setNudgedMap] = useState<Record<string, boolean>>({});

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightGeneratedAt, setInsightGeneratedAt] = useState<string | null>(null);
  const hasFetchedInsight = useRef(false);

  const myAddress = typeof window !== 'undefined'
    ? (localStorage.getItem('proov_address') || '').toLowerCase()
    : '';

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  // ── Load circle data ──────────────────────────────────────────────────────
  const loadCircleData = useCallback(async () => {
    const address = localStorage.getItem('proov_address') || '';
    if (!address) { setLoading(false); return; }

    const { sent: s, received: r, accepted: a } = await getCircleRequests(address);
    setSent(s);
    setReceived(r);
    setAccepted(a);

    const memberAddrs = a.map(req =>
      req.from_address === address.toLowerCase() ? req.to_address : req.from_address
    );

    const allAddresses = [
      ...s.map(x => x.to_address),
      ...r.map(x => x.from_address),
      ...memberAddrs,
    ];
    if (allAddresses.length > 0) {
      const map = await getUsernamesForAddresses(allAddresses).catch(() => ({}));
      setUsernameMap(map);
    }

    // Load streak + activity for each accepted member
    if (memberAddrs.length > 0) {
      const [streaks, activities] = await Promise.all([
        Promise.all(memberAddrs.map(addr => getStreakData(addr).catch(() => null))),
        Promise.all(memberAddrs.map(addr => getLatestActivityForAddress(addr).catch(() => null))),
      ]);
      const infoMap: Record<string, MemberInfo> = {};
      memberAddrs.forEach((addr, i) => {
        const s = streaks[i];
        const act = activities[i];
        infoMap[addr] = {
          streak: s?.currentStreak ?? 0,
          lastCompletionDate: s?.lastCompletionDate ?? null,
          activityName: act?.habitName ?? null,
          activityTime: act?.completedAt ?? null,
          habitVisibility: act?.habitVisibility ?? 'private',
          habitVisibleTo: act?.habitVisibleTo ?? [],
        };
      });
      setMemberData(infoMap);
    }

    // Restore today's nudge state from the database
    const nudgedToday = await getTodayNudgesSent(address).catch(() => [] as string[]);
    if (nudgedToday.length > 0) {
      setNudgedMap(prev => {
        const next = { ...prev };
        nudgedToday.forEach(addr => { next[addr] = true; });
        return next;
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadCircleData();
    const interval = setInterval(loadCircleData, 30000);
    return () => clearInterval(interval);
  }, [loadCircleData]);

  useEffect(() => {
    setInviteError(''); setResolvedAddress(''); setResolvedUsername('');
  }, [inviteInput]);

  // ── Invite ────────────────────────────────────────────────────────────────
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
    proovTx.sendCircleRequest(resolvedAddress as `0x${string}`);
    setInviteInput(''); setResolvedAddress(''); setResolvedUsername('');
    setShowConfirm(false);
    showToast('Invite sent ✓');
    loadCircleData();
  };

  const handleAccept = async (requestId: string, fromAddress?: string) => {
    await respondToCircleRequest(requestId, 'accepted').catch(() => {});
    if (fromAddress) proovTx.acceptCircleRequest(fromAddress as `0x${string}`);
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
    proovTx.sendCheer(addr as `0x${string}`);
    showToast('Cheer sent!');
  };

  const handleNudge = async (addr: string, username: string) => {
    // Optimistic update so the button changes immediately
    setNudgedMap(m => ({ ...m, [addr]: true }));
    const ok = await sendNudge(myAddress, addr).catch(() => false);
    if (ok) {
      showToast(`Nudge sent to @${username}!`);
    } else {
      // Rollback on failure and let the user try again
      setNudgedMap(m => { const next = { ...m }; delete next[addr]; return next; });
      showToast('Could not send nudge — try again');
    }
  };

  const wasCheerAlready = (addr: string) => {
    if (cheeredMap[addr]) return true;
    const today = new Date().toDateString();
    return !!localStorage.getItem(`proov_cheered_${addr}_${today}`);
  };

  const fetchInsight = useCallback(async (forceRefresh = false) => {
    if (accepted.length === 0) return;
    const address = localStorage.getItem('proov_address') || '';
    if (!address) return;

    setInsightLoading(true);
    const todayIso = new Date().toISOString().split('T')[0];
    const circleMembersData = accepted.map(req => {
      const addr = req.from_address === address.toLowerCase() ? req.to_address : req.from_address;
      const username = usernameMap[addr] || addr.slice(0, 8);
      const info = memberData[addr];
      return {
        username,
        currentStreak: info?.streak ?? 0,
        completedToday: info?.lastCompletionDate === todayIso,
        totalCompletions: 0,
        lastActive: info?.activityTime || info?.lastCompletionDate || 'unknown',
      };
    });

    try {
      const res = await fetch('/api/circle-insight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userAddress: address, circleMembersData, forceRefresh }),
      });
      const data = await res.json();
      if (data.insight) {
        setInsight(data.insight);
        setInsightGeneratedAt(data.generatedAt || new Date().toISOString());
      }
    } catch {}
    setInsightLoading(false);
  }, [accepted, usernameMap, memberData]);

  // Fetch insight once after members load — not on every 30s poll
  useEffect(() => {
    if (loading || accepted.length === 0 || hasFetchedInsight.current) return;
    const hasData = accepted.every(req => {
      const addr = req.from_address === myAddress ? req.to_address : req.from_address;
      return memberData[addr] !== undefined;
    });
    if (!hasData) return;
    hasFetchedInsight.current = true;
    fetchInsight();
  }, [loading, accepted, memberData, myAddress, fetchInsight]);

  const handleRefreshInsight = () => {
    const lastRefreshKey = 'proov_circle_insight_last_refresh';
    const last = parseInt(localStorage.getItem(lastRefreshKey) || '0');
    if (Date.now() - last < 60 * 60 * 1000) {
      showToast('Refresh available once per hour');
      return;
    }
    localStorage.setItem(lastRefreshKey, String(Date.now()));
    fetchInsight(true);
  };

  const insightIsStale = insightGeneratedAt
    ? Date.now() - new Date(insightGeneratedAt).getTime() > 6 * 60 * 60 * 1000
    : false;

  // ── Render ────────────────────────────────────────────────────────────────
  const today = todayStr();
  const yesterday = yesterdayStr();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 96 }}>

      {/* Accent glow */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 400, height: 200, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(ellipse, var(--accent-bg), transparent)', opacity: 0.4, zIndex: 0 }} />

      {/* Header */}
      <div style={{ background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 512, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', border: '1px solid var(--border2)', background: 'var(--bg2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <IconArrowLeft size={16} stroke={2} />
          </button>
          <div>
            <p style={{ fontWeight: 800, color: 'var(--text)', fontSize: 16, margin: 0, letterSpacing: '-.3px' }}>Circle</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>Your accountability crew</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 512, margin: '0 auto', padding: '1rem 1.25rem 0', position: 'relative', zIndex: 1 }}>

        {/* Tab toggle */}
        <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 12, padding: 4, gap: 3, marginBottom: 18 }}>
          {/* Members tab */}
          <button onClick={() => setTab('members')} style={{
            flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
            background: tab === 'members' ? 'var(--card-bg)' : 'transparent',
            color: tab === 'members' ? 'var(--text)' : 'var(--text3)',
            fontWeight: tab === 'members' ? 700 : 500,
            boxShadow: tab === 'members' ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
            transition: 'all 0.2s',
          }}>
            Members · {accepted.length}
          </button>
          {/* Requests tab */}
          <button onClick={() => setTab('requests')} style={{
            flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
            background: tab === 'requests' ? 'var(--card-bg)' : 'transparent',
            color: tab === 'requests' ? 'var(--text)' : 'var(--text3)',
            fontWeight: tab === 'requests' ? 700 : 500,
            boxShadow: tab === 'requests' ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
            transition: 'all 0.2s',
            position: 'relative',
          }}>
            Requests{received.length > 0 ? ` · ${received.length}` : ''}
            {received.length > 0 && (
              <span style={{ position: 'absolute', top: 5, right: 8, width: 7, height: 7, borderRadius: '50%', background: '#f43f5e', flexShrink: 0 }} />
            )}
          </button>
        </div>

        {/* ── MEMBERS TAB ─────────────────────────────────────────────── */}
        {tab === 'members' && (
          <>
            {/* Insight card */}
            {insightLoading && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '14px 16px', marginBottom: 14,
                animation: 'insight-pulse 1.5s ease-in-out infinite',
              }}>
                <div style={{ height: 10, background: 'var(--border)', borderRadius: 6, width: '40%', marginBottom: 10 }} />
                <div style={{ height: 13, background: 'var(--border)', borderRadius: 6, width: '100%', marginBottom: 6 }} />
                <div style={{ height: 13, background: 'var(--border)', borderRadius: 6, width: '75%' }} />
                <style>{`@keyframes insight-pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>
              </div>
            )}
            {!insightLoading && insight && (
              <div style={{
                background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                borderRadius: 14, padding: '14px 16px', marginBottom: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <IconSparkles size={13} stroke={2} color="var(--accent-text)" />
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)' }}>Today</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{insight}</p>
                {insightIsStale && (
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    <button
                      onClick={handleRefreshInsight}
                      style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            )}

            {loading && (
              <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: '2rem 0' }}>Loading…</p>
            )}

            {!loading && accepted.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
                <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No members yet</p>
                <p style={{ fontSize: 12 }}>Invite someone who will hold you accountable.</p>
              </div>
            )}

            {!loading && accepted.map(req => {
              const otherAddr = req.from_address === myAddress ? req.to_address : req.from_address;
              const username = usernameMap[otherAddr] || otherAddr.slice(0, 8);
              const info = memberData[otherAddr];
              const activeToday = info?.lastCompletionDate === today;
              const activeYesterday = info?.lastCompletionDate === yesterday;
              const brokenStreak = (info?.streak ?? 0) > 1 && !activeToday && !activeYesterday && !!info?.lastCompletionDate;
              const alreadyCheered = wasCheerAlready(otherAddr);
              const alreadyNudged = nudgedMap[otherAddr];

              // Determine if the completed habit's name is visible to the current user
              const habitIsVisible = info?.habitVisibility === 'public'
                || (info?.habitVisibility === 'circle'
                  && (info.habitVisibleTo.length === 0 || info.habitVisibleTo.includes(myAddress)));

              // Activity line — show habit name only if the habit is visible to viewer
              let activityLine = 'No activity yet today';
              if (activeToday) {
                if (habitIsVisible && info?.activityName) {
                  activityLine = `${info.activityName} done · ${info.activityTime ? timeAgo(info.activityTime) : 'today'}`;
                } else {
                  activityLine = 'Completed their habits today';
                }
              } else if (info?.activityTime) {
                const actDate = info.activityTime.split('T')[0];
                if (actDate === yesterday && habitIsVisible && info?.activityName) {
                  activityLine = `${info.activityName} done · ${timeAgo(info.activityTime)}`;
                }
              }

              return (
                <div key={req.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '14px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Avatar name={username} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>@{username}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <IconFlame size={13} stroke={2} color="#f59e0b" />
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{info?.streak ?? '—'}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: activeToday ? 'var(--accent-text)' : 'var(--text3)', marginBottom: brokenStreak ? 6 : 0 }}>
                        {activityLine}
                      </div>
                      {brokenStreak && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
                          <IconAlertTriangle size={11} stroke={2} color="#f59e0b" />
                          Streak at risk — needs to complete something
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Action button row — cheer if streak completed today, nudge if not */}
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    {activeToday ? (
                      alreadyCheered ? (
                        <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 0' }}>
                          <IconCheck size={12} stroke={2.5} /> Cheered
                        </span>
                      ) : (
                        <button onClick={() => handleCheer(otherAddr)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 20, border: '1.5px solid rgba(244,63,94,0.4)', background: 'rgba(244,63,94,0.06)', color: '#f43f5e', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.12)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.06)'; }}>
                          <IconHeart size={13} stroke={2} /> Cheer
                        </button>
                      )
                    ) : (
                      alreadyNudged ? (
                        <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 0' }}>
                          <IconCheck size={12} stroke={2.5} /> Nudged
                        </span>
                      ) : (
                        <button onClick={() => handleNudge(otherAddr, username)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 20, border: '1.5px solid var(--border2)', background: 'transparent', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text2)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; }}>
                          <IconBell size={13} stroke={1.8} /> Nudge
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {/* Invite someone — bottom of members tab */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '1rem', marginTop: accepted.length > 0 ? 8 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>Invite Someone</p>
              <div style={{ display: 'flex', gap: 8 }}>
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
                  style={{ padding: '0 16px', borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (inviteLoading || !inviteInput.trim()) ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                >
                  <IconSend size={14} stroke={2} />{inviteLoading ? '…' : 'Send'}
                </button>
              </div>
              {inviteError && <p style={{ fontSize: 11, color: '#f43f5e', marginTop: 6 }}>{inviteError}</p>}
            </div>
          </>
        )}

        {/* ── REQUESTS TAB ────────────────────────────────────────────── */}
        {tab === 'requests' && (
          <>
            {/* Incoming */}
            {received.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
                  Incoming · {received.length}
                </p>
                {received.map(req => {
                  const username = usernameMap[req.from_address] || req.from_address.slice(0, 8);
                  return (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1.5px solid var(--accent-border)', background: 'var(--accent-bg)', marginBottom: 8 }}>
                      <Avatar name={username} size={38} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{username}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>wants to join your circle</div>
                      </div>
                      <button onClick={() => handleDecline(req.id)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                      <button onClick={() => handleAccept(req.id, req.from_address)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Accept</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sent / Pending */}
            {sent.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
                  Sent · {sent.length}
                </p>
                {sent.map(req => {
                  const username = usernameMap[req.to_address] || req.to_address.slice(0, 8);
                  return (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card-bg)', marginBottom: 8, opacity: 0.75 }}>
                      <Avatar name={username} size={38} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{username}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Waiting for them to accept</div>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>Pending</span>
                    </div>
                  );
                })}
              </div>
            )}

            {received.length === 0 && sent.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, color: 'var(--text3)', fontSize: 13 }}>
                <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No pending requests</p>
                <p style={{ fontSize: 12 }}>Invite someone from the Members tab.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      <div style={{ position: 'fixed', bottom: 84, left: '50%', transform: `translateX(-50%) translateY(${toastVisible ? 0 : 16}px)`, opacity: toastVisible ? 1 : 0, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '9px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', pointerEvents: 'none', zIndex: 9999, transition: 'all 0.3s cubic-bezier(.34,1.56,.64,1)', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>
        {toast}
      </div>

      {/* Confirm invite sheet */}
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
