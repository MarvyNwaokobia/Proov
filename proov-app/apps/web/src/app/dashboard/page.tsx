'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getUsernameForAddress, getUserHabits, getTodayCompletions, saveHabitCompletion,
  getStreakData, updateDailyStreak, getAllHabitStreaks,
  getCircleRequests, getUsernamesForAddresses, getLatestActivityForAddress,
  sendNudge, getTodayNudgesSent, getGlobalLeaderboard,
  getVerifiedHabitsToday, getAvatarUrl, getNotifications,
  getDailyCompletionCounts,
  saveMood, getTodayMood,
  type Habit, type MoodValue,
} from '@/lib/supabase';
import { useProovTx } from '@/hooks/useProovTx';
import { isMiniPay } from '@/lib/minipay';
import type { TankStatus } from '@/lib/fuel';
import { Walkthrough } from '@/components/shared/Walkthrough';
import { ProofSheet } from '@/components/shared/ProofSheet';
import { ConfettiBurst } from '@/components/shared/ConfettiBurst';
import { StreakMilestoneModal } from '@/components/shared/StreakMilestoneModal';
import { isMilestone } from '@/lib/shareCard';
import {
  IconFlame,
  IconUsers,
  IconPlus,
  IconPlayerPlay,
  IconTarget,
  IconHeart,
  IconBell,
  IconCheck,
  IconShieldCheck,
  IconTrendingUp,
  IconRefresh,
  IconQuote,
} from '@tabler/icons-react';
import { getDailyQuote, getRandomQuote } from '@/lib/quotes';

const STREAK_MILESTONES = [7, 14, 21, 30, 60, 90];
function getNextGoal(s: number) {
  for (const m of STREAK_MILESTONES) if (s < m) return m;
  return 120;
}
function getPrevGoal(s: number) {
  let p = 0;
  for (const m of STREAK_MILESTONES) { if (s < m) return p; p = m; }
  return STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
}

interface CircleMember {
  address: string;
  username: string;
  streak: number;
  lastCompletionDate: string | null;
  activityName: string | null;
  activityTime: string | null;
  habitVisibility: string;
  habitVisibleTo: string[];
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Hey';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [lastCompletionDate, setLastCompletionDate] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);
  const [cheered, setCheered] = useState<Record<string, boolean>>({});
  const [nudgedMap, setNudgedMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lbEntries, setLbEntries] = useState<{ address: string; username: string; streak: number }[]>([]);
  const [userRank, setUserRank] = useState(0);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [streakFlipped, setStreakFlipped] = useState(false);
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});
  const [fuelBalance, setFuelBalance] = useState(0);
  const [tankStatus, setTankStatus] = useState<TankStatus>('healthy');
  const [isExtWallet, setIsExtWallet] = useState(false);
  const [verifiedHabits, setVerifiedHabits] = useState<string[]>([]);
  const [proofSheet, setProofSheet] = useState<{ habitId: string; habitName: string; habitCategory?: string } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [pendingHabits, setPendingHabits] = useState<Set<string>>(new Set());
  const [weeklyData, setWeeklyData] = useState<{ day: string; count: number }[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());
  const [quote, setQuote] = useState(getDailyQuote);
  const [todayMood, setTodayMood] = useState<MoodValue | null>(null);
  const [milestoneStreak, setMilestoneStreak] = useState<number | null>(null);
  const proovTx = useProovTx();

  useEffect(() => {
    const isAuth = localStorage.getItem('proov_authenticated') === 'true';
    if (!isAuth) router.replace('/');
  }, [router]);


  useEffect(() => {
    const timer = setTimeout(() => {
      const alreadyDone = localStorage.getItem('proov_walkthrough_done') || localStorage.getItem('proov_tutorial_done');
      const isNewUser = localStorage.getItem('proov_is_new_user') === 'true';
      if (!alreadyDone && isNewUser) setShowWalkthrough(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    getUsernameForAddress(addr).then(remote => {
      if (remote) { setUsername(remote); localStorage.setItem('proov_username', remote); }
      else {
        const local = localStorage.getItem('proov_username') ||
          (() => { try { const r = localStorage.getItem(`proov_username_${addr.toLowerCase()}`); return r ? JSON.parse(r).username : null; } catch { return null; } })();
        if (local) setUsername(local);
      }
    }).catch(() => { const l = localStorage.getItem('proov_username'); if (l) setUsername(l); });
  }, []);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;
    getStreakData(addr).then(data => {
      if (data.currentStreak > 0 || data.longestStreak > 0) {
        setCurrentStreak(data.currentStreak);
        setLongestStreak(data.longestStreak);
      }
      if (data.lastCompletionDate) setLastCompletionDate(data.lastCompletionDate.split('T')[0]);
    }).catch(() => {});
  }, []);

  // Load global leaderboard from Supabase
  useEffect(() => {
    const addr = (localStorage.getItem('proov_address') || '').toLowerCase();
    if (!addr) return;
    getGlobalLeaderboard(50).then(async rows => {
      const addrs = rows.map(r => r.address);
      const usernameMap = addrs.length > 0
        ? await getUsernamesForAddresses(addrs).catch(() => ({} as Record<string, string>))
        : {};
      const entries = rows.map(r => ({ address: r.address, username: usernameMap[r.address] || r.address.slice(0, 8), streak: r.streak }));
      setLbEntries(entries);
      const myIdx = entries.findIndex(e => e.address === addr);
      if (myIdx >= 0) { setUserRank(myIdx + 1); localStorage.setItem('proov_leaderboard_rank', String(myIdx + 1)); }
    }).catch(() => {});
  }, []);

  // Load circle members
  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;
    const addrLower = addr.toLowerCase();
    const today = new Date().toDateString();
    const load = async () => {
      const { accepted } = await getCircleRequests(addr).catch(() => ({ sent: [], received: [], accepted: [] }));
      if (accepted.length === 0) return;
      const memberAddrs = accepted.map(req => req.from_address === addrLower ? req.to_address : req.from_address);
      const [usernameMap, streaks, activities, nudgedToday] = await Promise.all([
        getUsernamesForAddresses(memberAddrs).catch(() => ({} as Record<string, string>)),
        Promise.all(memberAddrs.map(a => getStreakData(a).catch(() => null))),
        Promise.all(memberAddrs.map(a => getLatestActivityForAddress(a).catch(() => null))),
        getTodayNudgesSent(addr).catch(() => [] as string[]),
      ]);
      setCircleMembers(memberAddrs.map((a, i) => ({
        address: a,
        username: usernameMap[a] || a.slice(0, 8),
        streak: streaks[i]?.currentStreak ?? 0,
        lastCompletionDate: streaks[i]?.lastCompletionDate ?? null,
        activityName: activities[i]?.habitName ?? null,
        activityTime: activities[i]?.completedAt ?? null,
        habitVisibility: activities[i]?.habitVisibility ?? 'private',
        habitVisibleTo: activities[i]?.habitVisibleTo ?? [],
      })));
      if (nudgedToday.length > 0) {
        setNudgedMap(prev => { const n = { ...prev }; nudgedToday.forEach(a => { n[a] = true; }); return n; });
      }
      const cheeredState: Record<string, boolean> = {};
      memberAddrs.forEach(a => { if (localStorage.getItem(`proov_cheered_${a}_${today}`)) cheeredState[a] = true; });
      if (Object.keys(cheeredState).length > 0) setCheered(cheeredState);
    };
    load();
  }, []);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr || habits.length === 0) return;
    getAllHabitStreaks(habits.map(h => h.id), addr).then(setHabitStreaks).catch(() => {});
  }, [habits]);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;
    getDailyCompletionCounts(addr).then(counts => {
      const days: { day: string; count: number }[] = [];
      const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        days.push({ day: dayLabels[d.getDay()], count: counts[iso] || 0 });
      }
      setWeeklyData(days);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;
    const onVisible = () => { if (!document.hidden) getTodayCompletions(addr).then(setCompletedToday).catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) return;
    getTodayMood(addr).then(m => { if (m) setTodayMood(m); }).catch(() => {});
  }, []);

  useEffect(() => {
    const addr = (localStorage.getItem('proov_address') || '').toLowerCase();
    if (!addr) return;
    const lastRead = localStorage.getItem('proov_notif_last_read');
    getNotifications(addr, 20).then(notifs => {
      const unread = lastRead
        ? notifs.filter(n => new Date(n.created_at) > new Date(lastRead)).length
        : notifs.length;
      window.dispatchEvent(new CustomEvent('proov-notif-update', { detail: { count: unread } }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setMounted(true);
    const addr = localStorage.getItem('proov_address') || '';
    // Load avatar — localStorage first, then Supabase
    const storedAvatar = localStorage.getItem('proov_avatar');
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    } else if (addr) {
      getAvatarUrl(addr).then(url => {
        if (url) { setAvatarUrl(url); localStorage.setItem('proov_avatar', url); }
      }).catch(() => {});
    }
    if (addr) {
      Promise.all([getUserHabits(addr), getTodayCompletions(addr), getVerifiedHabitsToday(addr)])
        .then(([userHabits, todayDone, verifiedIds]) => {
          setHabits(userHabits);
          setCompletedToday(todayDone);
          setVerifiedHabits(verifiedIds);
          localStorage.setItem('proov_habits_cache', JSON.stringify(userHabits));
          // If every habit was already completed today (e.g. via timer / habits page),
          // fire the streak update now so the daily streak accumulates correctly.
          if (userHabits.length > 0 && userHabits.every((h: any) => todayDone.includes(h.id))) {
            const todayStr = new Date().toISOString().split('T')[0];
            updateDailyStreak(addr).then(newStreak => {
              setCurrentStreak(newStreak);
              setLongestStreak(prev => Math.max(prev, newStreak));
              setLastCompletionDate(todayStr);
            }).catch(() => {});
          }
        })
        .catch(() => {
          const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
          setHabits(cached);
        });
    }
    const streakRaw = localStorage.getItem('proov_streak_global');
    if (streakRaw) {
      try { const s = JSON.parse(streakRaw); setCurrentStreak(prev => prev || s.current || 0); setLongestStreak(prev => prev || s.longest || 0); } catch {}
    }
    // Load fuel balance (cached from settings page visits)
    const bal = parseFloat(localStorage.getItem('proov_fuel_balance') || '0');
    if (bal > 0) setFuelBalance(bal);
    // Detect external wallet
    try {
      const raw = localStorage.getItem(`proov_identity_${addr.toLowerCase()}`);
      if (raw) {
        const identity = JSON.parse(raw);
        if (identity.walletType === 'injected') setIsExtWallet(true);
      }
    } catch {}
    // Try to load it fresh
    import('@/lib/fuel').then(({ getUserCeloBalance, getGasPriceWei, getTankStatus }) => {
      Promise.all([getUserCeloBalance(addr), getGasPriceWei()]).then(([b, gasPriceWei]) => {
        setFuelBalance(b);
        localStorage.setItem('proov_fuel_balance', String(b));
        setTankStatus(getTankStatus(b, gasPriceWei));
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const completedCount = completedToday.length;
  const totalHabits = habits.length;
  const progressPercent = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0;

  // Build last 7 days for streak card.
  // A day is filled only if it falls within [lastCompletionDate - (streak-1), lastCompletionDate].
  // This prevents yesterday from appearing filled when the user's first-ever day is today.
  const last7 = (() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yesterdayStr = yd.toISOString().split('T')[0];
    const lcd = lastCompletionDate ? lastCompletionDate.split('T')[0] : null;
    // How many days ago was the last completion? Only trust 0 (today) or 1 (yesterday).
    const daysAgoLast = lcd === todayStr ? 0 : lcd === yesterdayStr ? 1 : null;

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const isToday = i === 6;
      let filled: boolean;
      if (isToday) {
        filled = totalHabits > 0 && completedToday.length >= totalHabits;
      } else if (daysAgoLast === null || currentStreak === 0) {
        filled = false;
      } else {
        const daysAgo = 6 - i;
        filled = daysAgo >= daysAgoLast && daysAgo < daysAgoLast + currentStreak;
      }
      return { label: dayNames[d.getDay()], isToday, filled };
    });
  })();

  const handleToggleHabit = async (habitId: string) => {
    if (completedToday.includes(habitId)) return;
    if (pendingHabits.has(habitId)) return;
    const addr = localStorage.getItem('proov_address') || '';
    const habit = habits.find(h => h.id === habitId);

    // Tx first — each habit fires its own on-chain proof.
    // Nonce conflicts are handled in useBackgroundTx via the sequential nonce chain:
    // each rapid-fire tx gets a unique nonce (16, 17, 18…) allocated before submission.
    setPendingHabits(prev => new Set(prev).add(habitId));
    const txOk = await proovTx.completeHabit((habit as any)?.on_chain_id ?? undefined);
    setPendingHabits(prev => { const s = new Set(prev); s.delete(habitId); return s; });

    if (!txOk) return;

    const newCompleted = [...completedToday, habitId];
    setCompletedToday(newCompleted);
    setHabitStreaks(prev => ({ ...prev, [habitId]: (prev[habitId] || 0) + 1 }));
    setJustCompleted(prev => new Set(prev).add(habitId));
    setTimeout(() => setJustCompleted(prev => { const s = new Set(prev); s.delete(habitId); return s; }), 800);
    showToast('Habit done ✓');
    await saveHabitCompletion(habitId, addr, currentStreak).catch(() => {});

    const allDone = habits.every(h => newCompleted.includes(h.id));
    if (allDone && habits.length > 0) {
      setShowConfetti(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const newStreak = await updateDailyStreak(addr).catch(() => currentStreak + 1);
      setCurrentStreak(newStreak);
      setLongestStreak(prev => Math.max(prev, newStreak));
      setLastCompletionDate(todayStr);
      proovTx.recordStreakIncrement(newStreak);
      if (isMilestone(newStreak)) {
        setMilestoneStreak(newStreak);
      } else {
        showToast(`${newStreak} day streak! 🔥`);
      }
    }
  };

  const handleCheer = async (memberAddress: string) => {
    const today = new Date().toDateString();
    localStorage.setItem(`proov_cheered_${memberAddress}_${today}`, '1');
    setCheered(prev => ({ ...prev, [memberAddress]: true }));
    showToast('Sending cheer...');
    const hash = await proovTx.sendCheer(memberAddress as `0x${string}`);
    if (hash) {
      showToast('Cheer sent!');
    } else {
      localStorage.removeItem(`proov_cheered_${memberAddress}_${today}`);
      setCheered(prev => { const next = { ...prev }; delete next[memberAddress]; return next; });
      showToast('Could not send cheer');
    }
  };

  const handleNudge = async (memberAddress: string, memberUsername: string) => {
    const myAddr = localStorage.getItem('proov_address') || '';
    setNudgedMap(prev => ({ ...prev, [memberAddress]: true }));
    showToast('Sending nudge...');
    const hash = await proovTx.sendNudge(memberAddress as `0x${string}`);
    if (hash) {
      const ok = await sendNudge(myAddr, memberAddress).catch(() => false);
      if (ok) showToast(`Nudge sent to @${memberUsername}!`);
    } else {
      setNudgedMap(prev => { const n = { ...prev }; delete n[memberAddress]; return n; });
      showToast('Could not send nudge');
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  const displayName = username ? username.charAt(0).toUpperCase() + username.slice(1) : 'there';

  if (!mounted) return null;

  return (
    <>
      <div className="blobs"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /></div>
      <div className="top-bar" />
      <div className="page-wrap" style={{ paddingTop: 18, paddingBottom: 100 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {getGreeting()}, {displayName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDate()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {fuelBalance > 0 && !isMiniPay() && (() => {
              const fillPct = Math.min(100, Math.max(3, (fuelBalance / 0.2) * 100));
              const isLow = tankStatus === 'critical';
              const isAmber = tankStatus === 'low';
              const borderCol = isLow ? 'rgba(244,63,94,.4)' : isAmber ? 'rgba(217,119,6,.4)' : 'rgba(5,150,105,.3)';
              const nozzleCol = isLow ? 'rgba(244,63,94,.5)' : isAmber ? 'rgba(217,119,6,.5)' : 'rgba(5,150,105,.45)';
              const fillGrad = isLow
                ? 'linear-gradient(to top,rgba(244,63,94,.82),rgba(244,63,94,.36))'
                : isAmber
                  ? 'linear-gradient(to top,rgba(217,119,6,.78),rgba(217,119,6,.32))'
                  : 'linear-gradient(to top,rgba(5,150,105,.72),rgba(5,150,105,.3))';
              const labelCol = isLow ? '#f43f5e' : isAmber ? '#d97706' : 'var(--accent-text)';
              return (
                <div
                  onClick={() => router.push('/settings')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer', flexShrink: 0 }}
                >
                  <div style={{ width: 5, height: 4, background: nozzleCol, borderRadius: '1.5px 1.5px 0 0', flexShrink: 0 }} />
                  <div style={{ width: 13, height: 28, borderRadius: 3, border: `1.5px solid ${borderCol}`, background: 'rgba(255,255,255,.04)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                    <div className="fuel-wave" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${fillPct}%`, background: fillGrad, borderRadius: '50% 50% 0 0 / 3px 3px 0 0' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,255,255,.14) 0%,transparent 60%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', right: 1, top: '33%', width: 2, height: 1, background: 'rgba(255,255,255,.22)' }} />
                    <div style={{ position: 'absolute', right: 1, top: '66%', width: 2, height: 1, background: 'rgba(255,255,255,.22)' }} />
                  </div>
                  <div style={{ fontSize: 7, fontWeight: 700, color: labelCol, letterSpacing: '.1px', marginTop: 1 }}>{fuelBalance.toFixed(2)}{isExtWallet ? '' : ''}</div>
                </div>
              );
            })()}
            <button
              onClick={() => { const addr = localStorage.getItem('proov_address'); if (addr) router.push(`/profile/${addr}`); }}
              style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent-border)', overflow: 'hidden', cursor: 'pointer', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-text)', lineHeight: 1 }}>{(username || 'P').slice(0, 1).toUpperCase()}</span>
              }
            </button>
          </div>
        </div>

        {/* ── Mood check-in ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 12, padding: '8px 12px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginRight: 'auto', whiteSpace: 'nowrap' }}>
            {todayMood ? 'Feeling' : 'How are you?'}
          </span>
          {([
            { value: 1 as MoodValue, emoji: '😣', label: 'Rough' },
            { value: 2 as MoodValue, emoji: '😕', label: 'Meh' },
            { value: 3 as MoodValue, emoji: '😐', label: 'Okay' },
            { value: 4 as MoodValue, emoji: '🙂', label: 'Good' },
            { value: 5 as MoodValue, emoji: '😄', label: 'Great' },
          ]).map(m => (
            <button
              key={m.value}
              onClick={() => {
                setTodayMood(m.value);
                const addr = localStorage.getItem('proov_address') || '';
                saveMood(addr, m.value).catch(() => {});
                showToast(`Mood logged: ${m.label}`);
              }}
              style={{
                background: todayMood === m.value ? 'var(--accent-bg)' : 'transparent',
                border: todayMood === m.value ? '1.5px solid var(--accent-border)' : '1.5px solid transparent',
                borderRadius: 10, padding: '4px 6px', cursor: 'pointer',
                fontSize: 20, lineHeight: 1, transition: 'all .2s ease',
                transform: todayMood === m.value ? 'scale(1.15)' : 'scale(1)',
              }}
              title={m.label}
            >
              {m.emoji}
            </button>
          ))}
        </div>

        {/* ── Streak flip card ── */}
        <div style={{ marginBottom: 16, borderRadius: 18, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setStreakFlipped(f => !f)}>
          {!streakFlipped ? (
            /* Front: current streak + week grid */
            <div style={{ background: 'var(--streak-hero-bg, var(--btn-primary-bg))', padding: '16px 18px', color: '#fff', borderRadius: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Current streak</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>{currentStreak}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                      <IconFlame size={15} stroke={2} />days
                    </span>
                  </div>
                </div>
                {/* Daily progress ring */}
                {(() => {
                  const size = 56;
                  const sw = 4.5;
                  const r = (size - sw) / 2;
                  const circ = 2 * Math.PI * r;
                  const pct = totalHabits > 0 ? completedCount / totalHabits : 0;
                  const offset = circ * (1 - pct);
                  const allDone = totalHabits > 0 && completedCount >= totalHabits;
                  return (
                    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
                      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={sw} />
                        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                          stroke={allDone ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)'}
                          strokeWidth={sw} strokeLinecap="round"
                          strokeDasharray={circ} strokeDashoffset={offset}
                          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                        />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{completedCount}/{totalHabits}</span>
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>today</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {/* Thin progress bar (mirrors ring below text) */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${progressPercent}%`, background: 'rgba(255,255,255,0.7)', borderRadius: 2, transition: 'width .5s ease' }} />
                </div>
              </div>
              {/* 7-day week dots */}
              <div style={{ display: 'flex', gap: 4 }}>
                {last7.map((day, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{day.label}</div>
                    <div style={{
                      width: '100%', aspectRatio: '1', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                      background: day.filled ? 'rgba(255,255,255,0.85)' : day.isToday ? 'transparent' : 'rgba(255,255,255,0.12)',
                      border: day.isToday && !day.filled ? '2px solid rgba(255,255,255,0.5)' : 'none',
                      color: day.filled ? 'var(--btn-primary-bg)' : day.isToday ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
                    }}>
                      {day.filled ? '✓' : day.isToday ? '·' : ''}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 6, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                ↺ Tap for goal
              </div>
            </div>
          ) : (
            /* Back: goal milestones */
            <div style={{ background: 'var(--streak-hero-bg, var(--btn-primary-bg))', padding: '16px 18px', color: '#fff', borderRadius: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                <IconTarget size={13} stroke={2} color="rgba(255,255,255,0.6)" /> Goal Progress
              </div>
              {(() => {
                const goal = getNextGoal(currentStreak);
                const prev = getPrevGoal(currentStreak);
                const range = goal - prev;
                const elapsed = currentStreak - prev;
                const pct = range > 0 ? Math.min(100, (elapsed / range) * 100) : 100;
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
                      <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>{goal}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>day milestone</span>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 5 }}>
                        <span>Day {currentStreak} of {goal}</span>
                        <span>{Math.max(0, goal - currentStreak)} days to go</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(255,255,255,0.9)', borderRadius: 3, transition: 'width .4s ease' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                      {[7, 14, 21, 30].map(m => {
                        const done = currentStreak >= m;
                        const isCurrent = m === goal;
                        return (
                          <div key={m} style={{
                            flex: 1, textAlign: 'center', padding: '6px 2px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                            background: done ? 'rgba(255,255,255,0.9)' : isCurrent ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                            border: isCurrent && !done ? '1.5px solid rgba(255,255,255,0.5)' : 'none',
                            color: done ? 'var(--btn-primary-bg)' : 'rgba(255,255,255,0.85)',
                          }}>
                            {done ? '✓ ' : ''}{m}d
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                      Hit {goal} days → next goal becomes {getNextGoal(goal)}d
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>↺ Tap to go back</div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Motivational quote ── */}
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14,
          padding: '14px 16px', marginBottom: 16, position: 'relative',
        }}>
          <IconQuote size={14} stroke={1.5} color="var(--accent)" style={{ opacity: 0.5, marginBottom: 4 }} />
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
            &ldquo;{quote.text}&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>— {quote.author}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setQuote(getRandomQuote()); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: 'var(--text3)', display: 'flex', alignItems: 'center',
              }}
              aria-label="New quote"
            >
              <IconRefresh size={13} stroke={2} />
            </button>
          </div>
        </div>

        {/* ── TODAY habits 2-col grid ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)' }}>TODAY</span>
          <Link href="/habits" style={{ fontSize: 11, color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>Manage →</Link>
        </div>

        {habits.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '28px 20px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10, lineHeight: 1 }}>🌱</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Every journey starts with one step</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16, lineHeight: 1.7, maxWidth: 220, margin: '0 auto 16px' }}>
              Create your first habit and watch your streak grow day by day.
            </p>
            <Link href="/habits" style={{ padding: '10px 22px', borderRadius: 22, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px var(--btn-primary-shadow, rgba(0,0,0,0.1))' }}>
              <IconPlus size={14} stroke={2.5} /> Create first habit
            </Link>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              {habits.map(habit => {
                const isDone = completedToday.includes(habit.id);
                const isPending = pendingHabits.has(habit.id);
                const isVerified = verifiedHabits.includes(habit.id);
                const habitStreak = habitStreaks[habit.id] || 0;
                const isCelebrating = justCompleted.has(habit.id);
                return (
                  <div
                    key={habit.id}
                    onClick={() => {
                      if (habit.type === 'checkbox') { if (!isDone && !isPending) handleToggleHabit(habit.id); }
                      else { isDone ? router.push(`/habits/${habit.id}`) : router.push(`/timer?habitId=${habit.id}&autostart=1`); }
                    }}
                    style={{
                      background: 'var(--card-bg)',
                      border: `1px solid ${isVerified ? 'rgba(5,150,105,0.35)' : isDone ? 'var(--accent-border)' : 'var(--card-border)'}`,
                      borderRadius: 14, padding: 11,
                      cursor: (isDone || isPending) && habit.type === 'checkbox' ? 'default' : 'pointer',
                      opacity: isDone ? 0.78 : 1,
                      display: 'flex', flexDirection: 'column',
                      transform: isCelebrating ? 'scale(1.04)' : 'scale(1)',
                      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
                    }}>
                    {/* Emoji + verified badge row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 22, color: 'var(--accent-text)', lineHeight: 1 }}>{habit.emoji}</span>
                      {isVerified && <IconShieldCheck size={13} stroke={2} color="#059669" />}
                    </div>
                    {/* Name */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {habit.name}
                    </div>
                    {/* Detail */}
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 3 }}>
                      {habit.type === 'timed' ? `${habit.duration_minutes}m` : 'Checkbox'}
                      {habitStreak > 0 && <> · <IconFlame size={8} stroke={2} color="#f59e0b" />{habitStreak}d</>}
                      {isDone && ' · Done'}
                    </div>
                    {/* Action buttons — pushed to card bottom */}
                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (habit.type === 'checkbox') { if (!isDone && !isPending) handleToggleHabit(habit.id); }
                          else { isDone ? router.push(`/habits/${habit.id}`) : router.push(`/timer?habitId=${habit.id}&autostart=1`); }
                        }}
                        style={{
                          width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 10, fontWeight: 700,
                          cursor: (isDone || isPending) && habit.type === 'checkbox' ? 'default' : 'pointer',
                          border: isDone ? 'none' : isPending ? 'none' : '1.5px solid var(--border2)',
                          background: isDone ? 'var(--accent)' : isPending ? 'var(--bg3)' : 'transparent',
                          color: isDone ? '#fff' : isPending ? 'var(--text3)' : 'var(--text2)',
                          fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}
                      >
                        {isDone ? (
                          <><IconCheck size={11} stroke={2.5} /> Done</>
                        ) : isPending ? (
                          <>Submitting…</>
                        ) : habit.type === 'timed' ? (
                          <><IconPlayerPlay size={11} stroke={2} /> Start</>
                        ) : (
                          'Mark done'
                        )}
                      </button>
                      {!isDone && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setProofSheet({ habitId: habit.id, habitName: habit.name, habitCategory: habit.category });
                          }}
                          style={{
                            width: '100%', padding: '5px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                            border: '1px solid var(--accent-border)', background: 'var(--accent-bg)',
                            color: 'var(--accent-text)', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                          }}
                        >
                          <IconShieldCheck size={9} stroke={2} /> Proov it
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Add habit — full width */}
            <button
              onClick={() => router.push('/habits')}
              style={{
                width: '100%', padding: 12, borderRadius: 13,
                border: '2px dashed var(--border2)', background: 'transparent',
                cursor: 'pointer', color: 'var(--text3)', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <IconPlus size={14} stroke={2} /> Add habit
            </button>
          </div>
        )}

        {/* ── WEEKLY SUMMARY ── */}
        {weeklyData.length > 0 && habits.length > 0 && (() => {
          const weekTotal = weeklyData.reduce((s, d) => s + d.count, 0);
          const weekTarget = habits.length * 7;
          const weekPct = weekTarget > 0 ? Math.round((weekTotal / weekTarget) * 100) : 0;
          const maxCount = Math.max(...weeklyData.map(d => d.count), 1);
          return (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconTrendingUp size={14} stroke={2} color="var(--accent-text)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>This week</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent-text)', lineHeight: 1 }}>{weekPct}%</span>
                  <span style={{ fontSize: 9, color: 'var(--text3)' }}>completed</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 40 }}>
                {weeklyData.map((d, i) => {
                  const h = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                  const isToday = i === weeklyData.length - 1;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: '100%', borderRadius: 4, minHeight: 3,
                        height: `${Math.max(h, 8)}%`,
                        background: d.count > 0
                          ? isToday ? 'var(--accent)' : 'var(--accent-bg)'
                          : 'var(--bg3)',
                        border: d.count > 0 ? '1px solid var(--accent-border)' : 'none',
                        transition: 'height 0.4s ease',
                      }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {weeklyData.map((d, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, fontWeight: 600, color: i === weeklyData.length - 1 ? 'var(--accent-text)' : 'var(--text3)' }}>
                    {d.day}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
                {weekTotal} of {weekTarget} habits this week
              </div>
            </div>
          );
        })()}

        {/* ── CIRCLE ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)' }}>CIRCLE</span>
          <Link href="/circle" style={{ fontSize: 11, color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>Manage →</Link>
        </div>

        {circleMembers.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '28px 20px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 10, lineHeight: 1 }}>🤝</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Accountability is a superpower</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16, lineHeight: 1.7, maxWidth: 220, margin: '0 auto 16px' }}>
              Invite a friend to your circle. Cheer each other on and stay consistent together.
            </p>
            <Link href="/circle" style={{ padding: '10px 22px', borderRadius: 22, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px var(--btn-primary-shadow, rgba(0,0,0,0.1))' }}>
              <IconUsers size={14} stroke={2} /> Invite someone
            </Link>
          </div>
        ) : (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
            {circleMembers.slice(0, 3).map((member, i) => {
              const todayIso = new Date().toISOString().split('T')[0];
              const activeToday = member.lastCompletionDate === todayIso;
              const alreadyCheered = cheered[member.address];
              const alreadyNudged = nudgedMap[member.address];
              const myAddress = (localStorage.getItem('proov_address') || '').toLowerCase();
              const habitIsVisible = member.habitVisibility === 'public'
                || (member.habitVisibility === 'circle'
                  && (member.habitVisibleTo.length === 0 || member.habitVisibleTo.includes(myAddress)));
              return (
                <div key={member.address} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                  borderBottom: i < Math.min(circleMembers.length, 3) - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--accent-text)',
                  }}>
                    {(member.username || '?').slice(0, 2).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      @{member.username}
                    </div>
                    <div style={{ fontSize: 10, color: activeToday ? 'var(--accent-text)' : 'var(--text3)', marginTop: 1 }}>
                      {activeToday
                        ? (habitIsVisible && member.activityName ? `${member.activityName} done` : 'Completed their habits today')
                        : 'No activity yet today'}
                    </div>
                  </div>
                  {/* Action */}
                  {activeToday ? (
                    alreadyCheered ? (
                      <span style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <IconCheck size={10} stroke={2.5} /> Cheered
                      </span>
                    ) : (
                      <button onClick={() => handleCheer(member.address)} style={{ flexShrink: 0, padding: '5px 9px', borderRadius: 8, border: '1px solid var(--pink-text, #f43f5e)', background: 'var(--pink-bg, rgba(244,63,94,0.08))', color: 'var(--pink-text, #f43f5e)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                        <IconHeart size={10} stroke={2} /> Cheer
                      </button>
                    )
                  ) : (
                    alreadyNudged ? (
                      <span style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <IconCheck size={10} stroke={2.5} /> Nudged
                      </span>
                    ) : (
                      <button onClick={() => handleNudge(member.address, member.username)} style={{ flexShrink: 0, padding: '5px 9px', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text3)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                        <IconBell size={10} stroke={1.8} /> Nudge
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── LEADERBOARD snippet ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)' }}>LEADERBOARD</span>
          <Link href="/leaderboard" style={{ fontSize: 11, color: 'var(--accent-text)', fontWeight: 600, textDecoration: 'none' }}>See all →</Link>
        </div>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
          {[
            lbEntries[0] ?? { username: '—', streak: 0, address: '' },
            lbEntries[1] ?? { username: '—', streak: 0, address: '' },
          ].map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 800, minWidth: 22, color: i === 0 ? '#f59e0b' : '#9ca3af' }}>#{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>@{entry.username}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
                <IconFlame size={12} stroke={2} /> {entry.streak}
              </span>
            </div>
          ))}
          {/* Current user row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--accent-bg)' }}>
            <span style={{ fontSize: 11, fontWeight: 800, minWidth: 22, color: 'var(--accent-text)' }}>
              {userRank > 0 ? `#${userRank}` : '—'}
            </span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              You · @{username || displayName}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
              <IconFlame size={12} stroke={2} /> {currentStreak}
            </span>
          </div>
        </div>

      </div>

      {/* Confetti on all habits done */}
      <ConfettiBurst active={showConfetti} onDone={() => setShowConfetti(false)} />

      {/* Toast */}
      <div className={`toast ${toastVisible ? 'show' : ''}`}>{toast}</div>

      {showWalkthrough && (
        <Walkthrough onComplete={() => { setShowWalkthrough(false); localStorage.removeItem('proov_is_new_user'); }} />
      )}

      {proofSheet && (
        <ProofSheet
          habitId={proofSheet.habitId}
          habitName={proofSheet.habitName}
          habitCategory={proofSheet.habitCategory}
          userAddress={localStorage.getItem('proov_address') || ''}
          onVerified={async (verificationHash) => {
            const addr = localStorage.getItem('proov_address') || '';
            const habit = habits.find(h => h.id === proofSheet.habitId);
            setPendingHabits(prev => new Set(prev).add(proofSheet.habitId));
            const txOk = await proovTx.completeHabit((habit as any)?.on_chain_id ?? undefined, verificationHash);
            setPendingHabits(prev => { const s = new Set(prev); s.delete(proofSheet.habitId); return s; });
            if (!txOk) return;
            setVerifiedHabits(prev => [...prev, proofSheet.habitId]);
            const newCompleted = completedToday.includes(proofSheet.habitId) ? completedToday : [...completedToday, proofSheet.habitId];
            setCompletedToday(newCompleted);
            setHabitStreaks(prev => ({ ...prev, [proofSheet.habitId]: (prev[proofSheet.habitId] || 0) + 1 }));
            await saveHabitCompletion(proofSheet.habitId, addr, currentStreak).catch(() => {});
            const allDone = habits.every(h => newCompleted.includes(h.id));
            if (allDone && habits.length > 0) {
              const newStreak = await updateDailyStreak(addr).catch(() => currentStreak + 1);
              setCurrentStreak(newStreak);
              setLongestStreak(prev => Math.max(prev, newStreak));
              showToast(`${newStreak} day streak! 🔥`);
            }
          }}
          onSelfReport={() => handleToggleHabit(proofSheet.habitId)}
          onClose={() => setProofSheet(null)}
        />
      )}

      {milestoneStreak !== null && (
        <StreakMilestoneModal
          streak={milestoneStreak}
          username={username || displayName}
          categories={habits.map(h => h.category)}
          onClose={() => setMilestoneStreak(null)}
        />
      )}
    </>
  );
}
