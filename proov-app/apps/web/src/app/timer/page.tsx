'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProovTx } from '@/hooks/useProovTx';
import {
  IconArrowLeft,
  IconClock,
  IconSearch,
  IconCircleCheck,
  IconCheck,
  IconRotate,
  IconArchive,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import {
  getUserHabits, saveHabitCompletion, getTodayCompletions,
  saveTimerSession, updateTimerSession, getAllSessionHistory, archiveTimerSession,
  saveHabit,
  type Habit, type TimerSession,
} from '@/lib/supabase';

type TimerView = 'pick' | 'setup' | 'running' | 'done';

const CIRC = 2 * Math.PI * 84;
const CIRC_220 = 2 * Math.PI * 94;

function fmtDur(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function GrindTimerPage() {
  const searchParams = useSearchParams();
  const proovTx = useProovTx();

  const [view, setView] = useState<TimerView>('pick');
  const [timedHabits, setTimedHabits] = useState<Habit[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [sessionHabitName, setSessionHabitName] = useState('');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<TimerSession[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [search, setSearch] = useState('');

  const [userAddress, setUserAddress] = useState('');
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [streakCount, setStreakCount] = useState(0);
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
  const [duration, setDuration] = useState(25);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const justCompletedRef = useRef(false);

  // On-chain session tracking
  const [onChainSessionId, setOnChainSessionId] = useState<bigint | null>(null);
  const [txPending, setTxPending] = useState<'starting' | 'ending' | null>(null);
  const progressFiredRef = useRef(false);

  // Session editing state
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [redoDuration, setRedoDuration] = useState<number>(25);
  const [convertSessionId, setConvertSessionId] = useState<string | null>(null);
  const [convertName, setConvertName] = useState('');
  const [convertEmoji, setConvertEmoji] = useState('⏱');
  const [convertDuration, setConvertDuration] = useState(25);
  const [convertSaving, setConvertSaving] = useState(false);

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (addr) setUserAddress(addr);
    const streak = parseInt(localStorage.getItem('proov_streak_count') || '0');
    if (streak > 0) setStreakCount(streak);
    const rank = parseInt(localStorage.getItem('proov_leaderboard_rank') || '0');
    if (rank > 0) setLeaderboardRank(rank);
  }, []);

  useEffect(() => {
    if (!userAddress) return;
    getAllSessionHistory(userAddress).then(setSessionHistory).catch(() => {});
    getTodayCompletions(userAddress).then(setCompletedToday).catch(() => {});
  }, [userAddress]);

  // Load habits + restore active timer
  useEffect(() => {
    const address = localStorage.getItem('proov_address') || '';

    if (address) {
      getUserHabits(address).then(async (all) => {
        const timed = all.filter(h => h.type === 'timed');
        setTimedHabits(timed);

        const habitId = searchParams.get('habitId');
        const autostart = searchParams.get('autostart') === '1';
        if (habitId) {
          const found = timed.find(h => h.id === habitId);
          if (found) {
            const dur = found.duration_minutes || 25;
            setSelectedHabit(found);
            setDuration(dur);
            if (autostart) {
              setTxPending('starting');
              const { ok, result } = await proovTx.startSession(
                (found as any)?.on_chain_id || 0, dur
              );
              if (!ok) { setTxPending(null); return; }
              const newOnChainId = result ?? null;
              setOnChainSessionId(newOnChainId);
              progressFiredRef.current = false;

              const now = Date.now();
              const saved = await saveTimerSession({
                user_address: address.toLowerCase(),
                habit_id: found.id,
                label: found.name,
                duration_minutes: dur,
                started_at: new Date(now).toISOString(),
                ended_at: null,
                is_custom: false,
                completed: false,
                on_chain_session_id: newOnChainId !== null ? newOnChainId.toString() : null,
              }).catch(() => null);
              localStorage.setItem('proov_active_timer', JSON.stringify({
                habitId: found.id,
                startedAt: now,
                duration: dur,
                isCustom: false,
                customLabel: '',
                sessionId: saved?.id || null,
                onChainSessionId: newOnChainId !== null ? newOnChainId.toString() : null,
              }));
              if (saved) setSessionId(saved.id);
              setSessionHabitName(found.name);
              setSessionDuration(dur);
              setSecondsLeft(dur * 60);
              setTxPending(null);
              setView('running');
            } else {
              setView('setup');
            }
          }
        }
      }).catch(() => {
        const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
        setTimedHabits(cached.filter((h: any) => h.type === 'timed'));
      });
    }

    // Restore active timer if still running
    const saved = localStorage.getItem('proov_active_timer');
    if (saved) {
      try {
        const { habitId: hId, startedAt, duration: d, isCustom: ic, customLabel: cl, sessionId: sid, onChainSessionId: ociStr } = JSON.parse(saved);
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const total = d * 60;
        if (elapsed < total) {
          setSecondsLeft(total - elapsed);
          setDuration(d);
          setIsCustom(ic || false);
          setCustomLabel(cl || '');
          setSessionDuration(d);
          if (sid) setSessionId(sid);
          if (ociStr) setOnChainSessionId(BigInt(ociStr));
          setView('running');
          if (hId) {
            const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
            const found = (cached as Habit[]).find(h => h.id === hId);
            if (found) { setSelectedHabit(found); setSessionHabitName(found.name); }
          }
        } else {
          localStorage.removeItem('proov_active_timer');
          setView('done');
        }
      } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Notification + sound when timer completes naturally — no on-chain call here
  useEffect(() => {
    if (view === 'done' && justCompletedRef.current) {
      justCompletedRef.current = false;

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Session complete', {
          body: selectedHabit
            ? `${selectedHabit.name} — ${fmtDur(duration)} done`
            : `${fmtDur(duration)} session complete`,
          icon: '/icon-192.png',
        });
      }

      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.8);
      } catch {}
    }
  }, [view, selectedHabit, duration]);

  // Countdown
  useEffect(() => {
    if (view !== 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          localStorage.removeItem('proov_active_timer');
          justCompletedRef.current = true;
          setView('done');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [view]);

  // recordProgress at the halfway point for sessions longer than 30 minutes
  const totalSeconds = duration * 60;
  useEffect(() => {
    if (view !== 'running' || !onChainSessionId) return;
    if (duration <= 30) return;
    const midpoint = Math.floor(totalSeconds / 2);
    if (secondsLeft === midpoint && !progressFiredRef.current) {
      progressFiredRef.current = true;
      proovTx.recordProgress(onChainSessionId); // fire-and-forget
    }
  }, [secondsLeft, view, onChainSessionId, duration, totalSeconds]);

  const startTimer = async () => {
    const address = localStorage.getItem('proov_address') || '';
    setTxPending('starting');

    // Fire on-chain FIRST — timer does not start until this confirms
    let newOnChainId: bigint | null = null;
    if (!isCustom && selectedHabit) {
      const { ok, result } = await proovTx.startSession(
        (selectedHabit as any)?.on_chain_id || 0, duration
      );
      if (!ok) { setTxPending(null); return; }
      newOnChainId = result ?? null;
    } else if (isCustom) {
      const { ok, result } = await proovTx.startCustomSession(
        customLabel || `${duration}m session`, duration
      );
      if (!ok) { setTxPending(null); return; }
      newOnChainId = result ?? null;
    }

    setOnChainSessionId(newOnChainId);
    progressFiredRef.current = false;

    const now = Date.now();
    setSessionHabitName(selectedHabit?.name || '');
    setSessionDuration(duration);
    setSecondsLeft(duration * 60);

    const saved = await saveTimerSession({
      user_address: address.toLowerCase(),
      habit_id: selectedHabit?.id || null,
      label: isCustom ? (customLabel || null) : (selectedHabit?.name || null),
      duration_minutes: duration,
      started_at: new Date(now).toISOString(),
      ended_at: null,
      is_custom: isCustom,
      completed: false,
      on_chain_session_id: newOnChainId !== null ? newOnChainId.toString() : null,
    }).catch(() => null);

    if (saved) setSessionId(saved.id);

    localStorage.setItem('proov_active_timer', JSON.stringify({
      habitId: selectedHabit?.id || null,
      startedAt: now,
      duration,
      isCustom,
      customLabel,
      sessionId: saved?.id || null,
      onChainSessionId: newOnChainId !== null ? newOnChainId.toString() : null,
    }));

    setTxPending(null);
    setView('running');
  };

  const confirmDone = async () => {
    const address = userAddress || localStorage.getItem('proov_address') || '';
    const streak = parseInt(localStorage.getItem('proov_streak_count') || '0');
    const sessionOCId = onChainSessionId ?? 0n;

    setTxPending('ending');

    if (!isCustom && selectedHabit) {
      // 1. End the on-chain session record
      const endOk = await proovTx.endSession(sessionOCId, true);
      if (!endOk) { setTxPending(null); return; }

      // 2. Mark the habit complete on-chain
      const completeOk = await proovTx.completeHabit((selectedHabit as any)?.on_chain_id || 0);
      if (!completeOk) { setTxPending(null); return; }

      // 3. Both confirmed — now write to Supabase
      await saveHabitCompletion(selectedHabit.id, address, streak).catch(() => {});
      setCompletedToday(prev => prev.includes(selectedHabit.id) ? prev : [...prev, selectedHabit.id]);
    }

    if (isCustom) {
      const endOk = await proovTx.endCustomSession(sessionOCId, true);
      if (!endOk) { setTxPending(null); return; }
    }

    // Mark session complete in Supabase only after on-chain tx confirmed
    if (sessionId) {
      await updateTimerSession(sessionId, {
        ended_at: new Date().toISOString(),
        completed: true,
      }).catch(() => {});
    }

    await getAllSessionHistory(address).then(setSessionHistory).catch(() => {});

    setTxPending(null);
    setView('pick');
    setSelectedHabit(null);
    setIsCustom(false);
    setCustomLabel('');
    setSecondsLeft(0);
    setSessionId(null);
    setSessionHabitName('');
    setSessionDuration(0);
    setOnChainSessionId(null);
  };

  const cancelTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    localStorage.removeItem('proov_active_timer');

    const sessionOCId = onChainSessionId ?? 0n;

    // Fire cancel in background — user is not blocked waiting for this
    if (isCustom) proovTx.endCustomSession(sessionOCId, false);
    else proovTx.cancelSession(sessionOCId);

    setView('pick');
    setOnChainSessionId(null);
  };

  const handleRedo = (session: TimerSession) => {
    const dur = redoDuration || session.duration_minutes;
    if (session.habit_id) {
      const found = timedHabits.find(h => h.id === session.habit_id);
      if (found) {
        setSelectedHabit(found);
        setDuration(dur);
        setIsCustom(false);
        setView('setup');
        return;
      }
    }
    setIsCustom(true);
    setSelectedHabit(null);
    setCustomLabel(session.label || '');
    setDuration(dur);
    setView('setup');
  };

  const handleArchive = async (sessionId: string) => {
    await archiveTimerSession(sessionId).catch(() => {});
    setSessionHistory(prev => prev.filter(s => s.id !== sessionId));
    if (expandedSessionId === sessionId) setExpandedSessionId(null);
  };

  const handleConvertToHabit = async (session: TimerSession) => {
    if (!convertName.trim()) return;
    setConvertSaving(true);
    const address = userAddress || localStorage.getItem('proov_address') || '';
    await saveHabit({
      user_address: address.toLowerCase(),
      name: convertName.trim(),
      emoji: convertEmoji,
      category: 'Other',
      type: 'timed',
      duration_minutes: convertDuration,
      schedule: 'daily',
      visibility: 'private',
      visible_to: [],
      active: true,
    }).catch(() => {});
    setConvertSaving(false);
    setConvertSessionId(null);
    setExpandedSessionId(null);
  };

  const progress = (view === 'running' || view === 'done')
    ? 1 - (secondsLeft / totalSeconds)
    : 0;
  const strokeDashoffset = CIRC * (1 - Math.min(progress, 1));
  const strokeDashoffset220 = CIRC_220 * (1 - Math.min(progress, 1));
  const isRunning = view === 'running';
  const isDone = view === 'done';

  const filteredHabits = timedHabits.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectHabit = (habit: Habit) => {
    setSelectedHabit(habit);
    setDuration(habit.duration_minutes || 25);
    setView('setup');
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── TX PENDING OVERLAY ── */}
      {txPending && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 18, padding: '22px 32px', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid var(--accent-border)',
              borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 14px',
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {txPending === 'starting' ? 'Starting session on-chain…' : 'Recording on-chain…'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Gasless · Powered by Pimlico</div>
          </div>
        </div>
      )}

      {/* ── RUNNING — full-page centered focus mode ── */}
      {isRunning && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 'calc(100vh - 130px)',
          padding: 24, position: 'relative',
        }}>
          <style>{`@keyframes tpulse{0%,100%{opacity:.4;transform:translate(-50%,-50%) scale(1)}50%{opacity:.9;transform:translate(-50%,-50%) scale(1.08)}}`}</style>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 340, height: 340, borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-bg), transparent 70%)',
            pointerEvents: 'none', animation: 'tpulse 2.5s ease-in-out infinite',
          }} />
          <button onClick={cancelTimer} style={{
            position: 'absolute', top: 14, left: 0,
            background: 'none', border: 'none', color: 'var(--accent-text)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <IconArrowLeft size={13} stroke={2} /> Change habit
          </button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 26,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            borderRadius: 12, padding: '8px 14px', position: 'relative', zIndex: 1,
          }}>
            <span style={{ fontSize: 18 }}>{selectedHabit?.emoji || '⏱'}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-text)' }}>
                {sessionHabitName || 'Custom session'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Target: {fmtDur(sessionDuration)}</div>
            </div>
          </div>
          <div style={{ position: 'relative', width: 220, height: 220, marginBottom: 26, zIndex: 1 }}>
            <svg viewBox="0 0 220 220" width="220" height="220" style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
              <circle cx="110" cy="110" r="94" fill="none" stroke="var(--border2)" strokeWidth="8" />
              <circle cx="110" cy="110" r="94" fill="none" stroke="var(--accent)" strokeWidth="12"
                strokeLinecap="round" strokeDasharray={CIRC_220} strokeDashoffset={strokeDashoffset220}
                style={{ filter: 'drop-shadow(0 0 8px var(--accent))', transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', letterSpacing: -2, lineHeight: 1 }}>
                {fmtTime(secondsLeft)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>remaining</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6, marginBottom: 22, position: 'relative', zIndex: 1 }}>
            Timer runs in the background.<br />Come back when you're done.
          </p>
          <button onClick={cancelTimer} style={{
            padding: '11px 28px', borderRadius: 12, background: 'transparent',
            border: '1px solid var(--border2)', color: 'var(--text2)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            position: 'relative', zIndex: 1,
          }}>
            Cancel session
          </button>
        </div>
      )}

      {/* ── DONE — full-page completion screen ── */}
      {isDone && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 'calc(100vh - 130px)',
          padding: 24,
        }}>
          <style>{`@keyframes pop{0%{transform:scale(.5);opacity:0}80%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}`}</style>
          <div style={{ marginBottom: 12, animation: 'pop .4s ease', color: 'var(--accent-text)' }}>
            <IconCircleCheck size={56} stroke={1.5} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', textAlign: 'center', letterSpacing: '-.5px', margin: '0 0 6px' }}>
            {sessionHabitName
              ? `${sessionHabitName} · ${fmtDur(sessionDuration)} done`
              : `Custom session · ${fmtDur(sessionDuration)} done`}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
            "Keep showing up. That's the whole game."
          </p>
          <button
            onClick={confirmDone}
            disabled={txPending === 'ending'}
            style={{
              width: '100%', maxWidth: 360, padding: 14, borderRadius: 14,
              background: txPending === 'ending' ? 'var(--bg3)' : 'var(--btn-primary-bg)',
              color: txPending === 'ending' ? 'var(--text3)' : 'var(--btn-primary-text)',
              border: 'none', fontSize: 14, fontWeight: 700,
              cursor: txPending === 'ending' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <IconCheck size={15} stroke={2} />
            {txPending === 'ending' ? 'Recording on-chain…' : 'Mark complete'}
          </button>
        </div>
      )}

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.25rem 1.25rem 100px', position: 'relative', zIndex: 1 }}>

        {/* Header — only on pick/setup */}
        {(view === 'pick' || view === 'setup') && (
          <div style={{ marginBottom: 20, paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 3 }}>
              <IconClock size={22} stroke={1.8} color="var(--accent-text)" />
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>Grind Timer</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', paddingLeft: 31 }}>
              Pick a habit or start a custom session
            </div>
          </div>
        )}

        {/* PICK HABIT */}
        {view === 'pick' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg2)', borderRadius: 11, padding: '10px 12px',
              border: '1px solid var(--border)', marginBottom: 18,
            }}>
              <IconSearch size={16} stroke={1.5} color="var(--text3)" />
              <input
                type="text"
                placeholder="Search timed habits..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
                Your Timed Habits
              </p>

              {timedHabits.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)', fontSize: 13 }}>
                  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconCircleCheck size={28} stroke={1.5} color="var(--text3)" /></div>
                  <p style={{ marginBottom: 8 }}>No timed habits yet</p>
                  <a href="/habits" style={{ fontSize: 12, color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}>Create one →</a>
                </div>
              )}

              {timedHabits.length > 0 && filteredHabits.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text3)', fontSize: 13 }}>
                  No habits match your search
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredHabits.map(habit => {
                  const isDone = completedToday.includes(habit.id);
                  return (
                    <div
                      key={habit.id}
                      onClick={() => !isDone && selectHabit(habit)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px',
                        background: isDone ? 'var(--bg2)' : 'var(--card-bg)',
                        border: `1px solid ${isDone ? 'var(--accent-border)' : 'var(--card-border)'}`,
                        borderRadius: 13,
                        cursor: isDone ? 'default' : 'pointer',
                        opacity: isDone ? 0.72 : 1,
                        transition: 'border-color .15s',
                      }}
                      onMouseEnter={e => { if (!isDone) e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
                      onMouseLeave={e => { if (!isDone) e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                    >
                      <span style={{ fontSize: 20 }}>{habit.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{habit.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                          {habit.duration_minutes ? fmtDur(habit.duration_minutes) : ''}
                          {habit.category ? ` · ${habit.category}` : ''}
                        </div>
                      </div>
                      {isDone ? (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '6px 12px', borderRadius: 20, flexShrink: 0,
                          background: 'var(--accent-bg)', color: 'var(--accent-text)',
                          fontSize: 11, fontWeight: 700,
                        }}>
                          <IconCircleCheck size={13} stroke={2} /> Done
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); selectHabit(habit); }}
                          style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                        >
                          Start
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom session */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
                Custom session
              </p>
              <button
                onClick={() => { setIsCustom(true); setSelectedHabit(null); setView('setup'); }}
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 13,
                  border: '1px solid var(--border2)', background: 'var(--card-bg)',
                  color: 'var(--text2)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)'; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconClock size={17} stroke={1.8} color="var(--text3)" />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>Custom session</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>Set any duration — no habit linked</div>
                </div>
              </button>
            </div>

            {/* Recent Sessions */}
            {sessionHistory.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>
                  Recent Sessions
                </p>
                {sessionHistory.map(session => {
                  const label = session.label || `${fmtDur(session.duration_minutes)} session`;
                  const date = new Date(session.started_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
                  const isExpanded = expandedSessionId === session.id;
                  const isConverting = convertSessionId === session.id;
                  return (
                    <div key={session.id} style={{
                      borderRadius: 13, border: `1px solid ${isExpanded ? 'var(--accent-border)' : 'var(--border)'}`,
                      background: 'var(--card-bg)', marginBottom: 8, overflow: 'hidden',
                      transition: 'border-color .15s',
                    }}>
                      <div
                        onClick={() => {
                          setExpandedSessionId(isExpanded ? null : session.id);
                          setRedoDuration(session.duration_minutes);
                          setConvertSessionId(null);
                          setConvertName(session.label || '');
                          setConvertEmoji('⏱');
                          setConvertDuration(session.duration_minutes);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconCircleCheck size={17} stroke={1.6} color="var(--accent-text)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{fmtDur(session.duration_minutes)} · {date}</div>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {isExpanded && !isConverting && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1 }}>Redo duration (min)</span>
                            <input
                              type="number"
                              min={1}
                              max={240}
                              value={redoDuration}
                              onChange={e => {
                                const v = parseInt(e.target.value);
                                if (!isNaN(v)) setRedoDuration(Math.min(240, Math.max(1, v)));
                              }}
                              onClick={e => e.stopPropagation()}
                              style={{
                                width: 60, fontSize: 13, fontWeight: 700, color: 'var(--text)',
                                background: 'var(--bg2)', border: '1px solid var(--border2)',
                                borderRadius: 8, textAlign: 'center', outline: 'none',
                                fontFamily: 'inherit', padding: '4px 6px',
                              }}
                            />
                            <button
                              onClick={e => { e.stopPropagation(); handleRedo(session); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 14px', borderRadius: 9, border: 'none',
                                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              <IconRotate size={12} stroke={2} /> Redo
                            </button>
                          </div>
                          {session.is_custom && (
                            <button
                              onClick={e => { e.stopPropagation(); setConvertSessionId(session.id); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '7px 14px', borderRadius: 9,
                                border: '1px solid var(--accent-border)', background: 'var(--accent-bg)',
                                color: 'var(--accent-text)', fontSize: 11, fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'inherit', width: 'fit-content',
                              }}
                            >
                              <IconPlus size={12} stroke={2.5} /> Save as Habit
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); handleArchive(session.id); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '7px 14px', borderRadius: 9,
                              border: '1px solid var(--border2)', background: 'transparent',
                              color: 'var(--text3)', fontSize: 11, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'inherit', width: 'fit-content',
                            }}
                          >
                            <IconArchive size={12} stroke={1.8} /> Archive session
                          </button>
                        </div>
                      )}

                      {isExpanded && isConverting && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-text)' }}>Save as Habit</span>
                            <button onClick={e => { e.stopPropagation(); setConvertSessionId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                              <IconX size={14} stroke={2} />
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <input
                              type="text"
                              placeholder="Emoji"
                              value={convertEmoji}
                              onChange={e => setConvertEmoji(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{
                                width: 48, fontSize: 18, textAlign: 'center', border: '1px solid var(--border2)',
                                borderRadius: 9, background: 'var(--bg2)', outline: 'none', fontFamily: 'inherit', padding: '6px 4px',
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Habit name"
                              value={convertName}
                              onChange={e => setConvertName(e.target.value)}
                              onClick={e => e.stopPropagation()}
                              style={{
                                flex: 1, fontSize: 13, border: '1px solid var(--border2)',
                                borderRadius: 9, background: 'var(--bg2)', color: 'var(--text)',
                                outline: 'none', fontFamily: 'inherit', padding: '6px 10px',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Duration (min)</span>
                            <input
                              type="number"
                              min={1}
                              max={240}
                              value={convertDuration}
                              onChange={e => {
                                const v = parseInt(e.target.value);
                                if (!isNaN(v)) setConvertDuration(Math.min(240, Math.max(1, v)));
                              }}
                              onClick={e => e.stopPropagation()}
                              style={{
                                width: 60, fontSize: 13, fontWeight: 700, color: 'var(--text)',
                                background: 'var(--bg2)', border: '1px solid var(--border2)',
                                borderRadius: 8, textAlign: 'center', outline: 'none',
                                fontFamily: 'inherit', padding: '4px 6px',
                              }}
                            />
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleConvertToHabit(session); }}
                            disabled={!convertName.trim() || convertSaving}
                            style={{
                              width: '100%', padding: '9px', borderRadius: 10, border: 'none',
                              background: convertName.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)',
                              color: convertName.trim() ? 'var(--btn-primary-text)' : 'var(--text3)',
                              fontSize: 12, fontWeight: 700, cursor: convertName.trim() ? 'pointer' : 'not-allowed',
                              fontFamily: 'inherit',
                            }}
                          >
                            {convertSaving ? 'Saving…' : 'Create Habit'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SETUP */}
        {view === 'setup' && (
          <div>
            <button
              onClick={() => { setView('pick'); setIsCustom(false); }}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <IconArrowLeft size={16} stroke={2} /> Back
            </button>

            {selectedHabit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 12, marginBottom: '1.25rem' }}>
                <span style={{ fontSize: 22 }}>{selectedHabit.emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-text)' }}>{selectedHabit.name}</div>
                  {selectedHabit.duration_minutes > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>Target: {fmtDur(selectedHabit.duration_minutes)}</div>
                  )}
                </div>
              </div>
            )}

            {isCustom && (
              <div style={{ marginBottom: '1.25rem' }}>
                <input
                  type="text"
                  placeholder="What habit are you building today?"
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                />
                <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>
                  Custom sessions don't count toward habit streaks.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <input
                type="number"
                min={1}
                max={240}
                value={duration}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) setDuration(Math.min(240, Math.max(1, val)));
                }}
                onBlur={e => {
                  const val = parseInt(e.target.value);
                  setDuration(isNaN(val) || val < 1 ? 1 : Math.min(240, val));
                }}
                onFocus={e => e.target.select()}
                style={{
                  width: 80, fontSize: 28, fontWeight: 800, color: 'var(--text)',
                  background: 'var(--bg2)', border: '1.5px solid var(--accent-border)',
                  borderRadius: 10, textAlign: 'center', outline: 'none',
                  fontFamily: 'inherit', letterSpacing: -1, padding: '4px 8px',
                }}
              />
              <span style={{ fontSize: 16, color: 'var(--text3)', fontWeight: 600 }}>min</span>
            </div>

            <input
              type="range"
              min={1}
              max={240}
              step={1}
              value={duration}
              onChange={e => {
                const v = parseInt(e.target.value);
                const stops = [1, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];
                setDuration(stops.reduce((p, c) => Math.abs(c - v) < Math.abs(p - v) ? c : p));
              }}
              style={{ width: '100%', marginBottom: 16, accentColor: 'var(--accent)' }}
            />

            <button
              onClick={startTimer}
              disabled={txPending === 'starting' || (isCustom && !customLabel.trim())}
              style={{
                width: '100%', padding: 14, borderRadius: 14, border: 'none',
                background: (txPending === 'starting' || (isCustom && !customLabel.trim())) ? 'var(--bg3)' : 'var(--btn-primary-bg)',
                color: (txPending === 'starting' || (isCustom && !customLabel.trim())) ? 'var(--text3)' : 'var(--btn-primary-text)',
                fontSize: 15, fontWeight: 700,
                cursor: (txPending === 'starting' || (isCustom && !customLabel.trim())) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', boxShadow: '0 4px 20px var(--btn-primary-shadow)',
                transition: 'transform .15s, box-shadow .15s',
              }}
              onMouseEnter={e => { if (!txPending) e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => (e.currentTarget.style.transform = '')}
            >
              {txPending === 'starting' ? 'Starting on-chain…' : `Start ${fmtDur(duration)} session`}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
