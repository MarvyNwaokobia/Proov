'use client';
import { useState, useEffect, useRef, useCallback } from 'react'; // useRef kept for intervalRef + glowRef
import { useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useProovTx } from '@/hooks/useProovTx';
import {
  IconBolt,
  IconArrowLeft,
  IconClock,
  IconSearch,
  IconConfetti,
  IconCircleCheck,
} from '@tabler/icons-react';
import {
  getUserHabits, saveHabitCompletion,
  saveTimerSession, updateTimerSession, getCustomSessionHistory,
  type Habit, type TimerSession,
} from '@/lib/supabase';

type TimerView = 'pick' | 'setup' | 'running' | 'done';

const CIRC = 2 * Math.PI * 84;

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
  const { isConnected } = useAccount();
  const proovTx = useProovTx();

  const [view, setView] = useState<TimerView>('pick');
  const [timedHabits, setTimedHabits] = useState<Habit[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [sessionHabitName, setSessionHabitName] = useState('');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [customHistory, setCustomHistory] = useState<TimerSession[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [search, setSearch] = useState('');

  const [duration, setDuration] = useState(25);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const justCompletedRef = useRef(false);

  // Cursor glow
  const glowRef = useRef<HTMLDivElement>(null);
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (glowRef.current) {
      glowRef.current.style.left = e.clientX + 'px';
      glowRef.current.style.top = e.clientY + 'px';
    }
  }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [onMouseMove]);

  // Load habits + restore active timer + load custom session history
  useEffect(() => {
    const address = localStorage.getItem('proov_address') || '';

    // Load timed habits from Supabase
    if (address) {
      getUserHabits(address).then(all => {
        const timed = all.filter(h => h.type === 'timed');
        setTimedHabits(timed);

        // Deep-link: pre-select habit by id from URL
        const habitId = searchParams.get('habitId');
        const autostart = searchParams.get('autostart') === '1';
        if (habitId) {
          const found = timed.find(h => h.id === habitId);
          if (found) {
            const dur = found.duration_minutes || 25;
            setSelectedHabit(found);
            setDuration(dur);
            if (autostart) {
              // Skip setup — start the timer immediately
              const now = Date.now();
              setSessionHabitName(found.name);
              setSessionDuration(dur);
              setSecondsLeft(dur * 60);
              setView('running');
              localStorage.setItem('proov_active_timer', JSON.stringify({
                habitId: found.id,
                startedAt: now,
                duration: dur,
                isCustom: false,
                customLabel: '',
                sessionId: null,
              }));
              proovTx.startSession((found as any)?.on_chain_id || 0, dur);
            } else {
              setView('setup');
            }
          }
        }
      }).catch(() => {
        const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
        setTimedHabits(cached.filter((h: any) => h.type === 'timed'));
      });

      // Load custom session history
      getCustomSessionHistory(address).then(setCustomHistory).catch(() => {});
    }

    // Restore active timer if still running
    const saved = localStorage.getItem('proov_active_timer');
    if (saved) {
      try {
        const { habitId: hId, startedAt, duration: d, isCustom: ic, customLabel: cl, sessionId: sid } = JSON.parse(saved);
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const total = d * 60;
        if (elapsed < total) {
          setSecondsLeft(total - elapsed);
          setDuration(d);
          setIsCustom(ic || false);
          setCustomLabel(cl || '');
          setSessionDuration(d);
          if (sid) setSessionId(sid);
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

  // Request notification permission when page loads
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fire notification + sound when timer completes
  useEffect(() => {
    if (view === 'done' && justCompletedRef.current) {
      justCompletedRef.current = false;

      // Browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Session complete', {
          body: selectedHabit
            ? `${selectedHabit.name} — ${fmtDur(duration)} done`
            : `${fmtDur(duration)} session complete`,
          icon: '/icon-192.png',
        });
      }

      // Subtle completion sound: C5 → E5 → G5 chord
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

      // Silent background endSession
      if (isConnected) {
        proovTx.endSession(0, true);
      }
    }
  }, [view, selectedHabit, duration, isConnected]);

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

  const startTimer = async () => {
    const now = Date.now();
    // Capture for completion message (Fix 4)
    setSessionHabitName(selectedHabit?.name || '');
    setSessionDuration(duration);
    setSecondsLeft(duration * 60);
    setView('running');

    let newSessionId: string | null = null;

    // Save custom session to Supabase (Fix 5)
    if (isCustom) {
      const address = localStorage.getItem('proov_address') || '';
      const saved = await saveTimerSession({
        user_address: address.toLowerCase(),
        habit_id: null,
        label: customLabel || null,
        duration_minutes: duration,
        started_at: new Date(now).toISOString(),
        ended_at: null,
        is_custom: true,
        completed: false,
      }).catch(() => null);
      if (saved) { newSessionId = saved.id; setSessionId(saved.id); }
    }

    localStorage.setItem('proov_active_timer', JSON.stringify({
      habitId: selectedHabit?.id || null,
      startedAt: now,
      duration,
      isCustom,
      customLabel,
      sessionId: newSessionId,
    }));

    if (isConnected && !isCustom && selectedHabit) {
      proovTx.startSession((selectedHabit as any)?.on_chain_id || 0, duration);
    } else if (isConnected && isCustom) {
      proovTx.startCustomSession(customLabel || `${duration}m session`, duration);
    }
  };

  const confirmDone = async () => {
    const address = localStorage.getItem('proov_address') || '';
    const streak = parseInt(localStorage.getItem('proov_streak_count') || '0');

    if (!isCustom && selectedHabit) {
      await saveHabitCompletion(selectedHabit.id, address, streak).catch(() => {});
      if (isConnected) {
        proovTx.completeHabit((selectedHabit as any)?.on_chain_id || 0);
        proovTx.endSession(0, true);
      }
    }

    if (isCustom && sessionId) {
      await updateTimerSession(sessionId, {
        ended_at: new Date().toISOString(),
        completed: true,
      }).catch(() => {});
      if (isConnected) proovTx.endCustomSession(0, true);
      getCustomSessionHistory(address).then(setCustomHistory).catch(() => {});
    }

    setView('pick');
    setSelectedHabit(null);
    setIsCustom(false);
    setCustomLabel('');
    setSecondsLeft(0);
    setSessionId(null);
    setSessionHabitName('');
    setSessionDuration(0);
  };

  const cancelTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    localStorage.removeItem('proov_active_timer');
    if (isConnected) {
      if (isCustom) proovTx.endCustomSession(0, false);
      else proovTx.cancelSession(0);
    }
    setView('pick');
  };

  const totalSeconds = duration * 60;
  const progress = (view === 'running' || view === 'done')
    ? 1 - (secondsLeft / totalSeconds)
    : 0;
  const strokeDashoffset = CIRC * (1 - Math.min(progress, 1));
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
      {/* Cursor glow */}
      <div ref={glowRef} style={{
        position: 'fixed', width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-bg), transparent 70%)',
        transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0, opacity: 0.7,
        transition: 'left 0.08s linear, top 0.08s linear',
      }} />

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '1rem 1.25rem 100px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.2px', display: 'flex', alignItems: 'center', gap: 5 }}><IconBolt size={16} stroke={2} color="var(--accent-text)" /> Grind Timer</div>
        </div>

        {/* Timer ring — always visible */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1.25rem 0 1rem' }}>
          <div style={{ position: 'relative', width: 200, height: 200 }}>
            {/* Pulse glow when running */}
            {(isRunning || isDone) && (
              <div style={{
                position: 'absolute', inset: -24, borderRadius: '50%',
                background: 'radial-gradient(circle, var(--accent-bg), transparent 65%)',
                animation: 'timerPulse 2.5s ease-in-out infinite', pointerEvents: 'none',
              }} />
            )}
            <style>{`
              @keyframes timerPulse {
                0%, 100% { opacity: 0.5; transform: scale(1); }
                50%       { opacity: 1;   transform: scale(1.08); }
              }
            `}</style>

            <svg viewBox="0 0 200 200" width="200" height="200" style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
              {/* Track */}
              <circle cx="100" cy="100" r="84" fill="none" stroke="var(--border2)" strokeWidth="8" />
              {/* Glow layer */}
              {(isRunning || isDone) && (
                <circle cx="100" cy="100" r="84" fill="none" stroke="var(--accent)" strokeWidth="14"
                  strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={strokeDashoffset}
                  opacity="0.2" style={{ filter: 'blur(4px)', transition: 'stroke-dashoffset 1s linear' }} />
              )}
              {/* Progress ring */}
              <circle cx="100" cy="100" r="84" fill="none" stroke="var(--accent)" strokeWidth="12"
                strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>

            {/* Center content */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
              {isDone ? (
                <>
                  <IconConfetti size={32} stroke={1.5} color="var(--accent-text)" />
                  <span style={{ fontSize: 10, color: 'var(--accent-text)', fontWeight: 700, marginTop: 4 }}>Done!</span>
                </>
              ) : isRunning ? (
                <>
                  <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: -1, lineHeight: 1 }}>
                    {fmtTime(secondsLeft)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>remaining</span>
                </>
              ) : (
                <>
                  <IconBolt size={28} stroke={1.8} color="var(--text3)" />
                  <span style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>Grind Timer</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* DONE */}
        {isDone && (
          <div style={{ background: 'var(--accent-bg)', border: '1.5px solid var(--accent-border)', borderRadius: 16, padding: 18, textAlign: 'center', marginTop: 12, marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {sessionHabitName
                ? `${sessionHabitName} · ${fmtDur(sessionDuration)} done`
                : `${fmtDur(sessionDuration)} session complete`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1rem' }}>
              {sessionHabitName ? "Keep showing up. That's the whole game." : 'Good work. Every session counts.'}
            </div>
            <button onClick={confirmDone} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Mark complete
            </button>
          </div>
        )}

        {/* PICK HABIT */}
        {view === 'pick' && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 3, letterSpacing: -0.5 }}>
              Grind Timer
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
              Which habit are you working on?
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg2)', borderRadius: 11, padding: '10px 12px',
              border: '1px solid var(--border)', marginBottom: 14,
            }}>
              <IconSearch size={16} stroke={1.5} color="var(--text3)" />
              <input
                type="text"
                placeholder="Search habits..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            {filteredHabits.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)', fontSize: 13 }}>
                {timedHabits.length === 0 ? (
                  <>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconCircleCheck size={28} stroke={1.5} color="var(--text3)" /></div>
                    <p style={{ marginBottom: 8 }}>No timed habits yet</p>
                    <a href="/habits" className="create-btn" style={{ marginTop: 4 }}>Create one →</a>
                  </>
                ) : 'No habits match your search'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              {filteredHabits.map(habit => (
                <div
                  key={habit.id}
                  onClick={() => selectHabit(habit)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 13, cursor: 'pointer', transition: 'border-color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                >
                  <span style={{ fontSize: 20 }}>{habit.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{habit.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                      {habit.duration_minutes ? `Target: ${fmtDur(habit.duration_minutes)}` : ''}
                      {habit.category ? ` · ${habit.category}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); selectHabit(habit); }}
                    style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    Start
                  </button>
                </div>
              ))}
            </div>

            {/* Custom session — clearly secondary */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8, textAlign: 'center' }}>
                Or start without linking a habit
              </p>
              <button
                onClick={() => { setIsCustom(true); setSelectedHabit(null); setView('setup'); }}
                style={{ width: '100%', padding: 11, borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)'; }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconClock size={16} stroke={1.8} /> Custom session</span>
              </button>
            </div>

            {/* Custom session history */}
            {customHistory.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.75rem' }}>
                  Recent sessions
                </div>
                {customHistory.map(session => {
                  const dur = session.duration_minutes;
                  const label = session.label || `${fmtDur(dur)} session`;
                  const date = new Date(session.started_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
                  return (
                    <div key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg)', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{date}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => {
                            setDuration(session.duration_minutes);
                            setCustomLabel(session.label || '');
                            setIsCustom(true);
                            setView('setup');
                          }}
                          style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDuration(session.duration_minutes);
                            setCustomLabel(session.label || '');
                            setIsCustom(true);
                            setSessionHabitName('');
                            setSessionDuration(session.duration_minutes);
                            setSecondsLeft(session.duration_minutes * 60);
                            setView('running');
                          }}
                          style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Redo
                        </button>
                      </div>
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

            {/* Selected habit badge */}
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

            {/* Custom label */}
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

            {/* Duration — plain slider, label always matches */}
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)',
              textAlign: 'center', marginBottom: 12, letterSpacing: -1 }}>
              {fmtDur(duration)}
            </div>

            <input
              type="range"
              min={1}
              max={240}
              step={1}
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value))}
              style={{ width: '100%', marginBottom: 16, accentColor: 'var(--accent)' }}
            />

            <button
              onClick={startTimer}
              disabled={isCustom && !customLabel.trim()}
              style={{
                width: '100%', padding: 14, borderRadius: 14, border: 'none',
                background: (!isCustom || customLabel.trim()) ? 'var(--btn-primary-bg)' : 'var(--bg3)',
                color: (!isCustom || customLabel.trim()) ? 'var(--btn-primary-text)' : 'var(--text3)',
                fontSize: 15, fontWeight: 700,
                cursor: (!isCustom || customLabel.trim()) ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', boxShadow: '0 4px 20px var(--btn-primary-shadow)',
                transition: 'transform .15s, box-shadow .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = '')}
            >
              Start {fmtDur(duration)} session
            </button>
          </div>
        )}

        {/* RUNNING */}
        {isRunning && (
          <div>
            <button onClick={() => { cancelTimer(); setView('pick'); }} style={{
              fontSize: 12, color: 'var(--accent-text)', fontWeight: 700,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <IconArrowLeft size={13} stroke={2.5} /> Change habit
            </button>

            {selectedHabit && (
              <div style={{
                background: 'var(--bg2)', borderRadius: 13, padding: '10px 14px',
                marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 20 }}>{selectedHabit.emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{selectedHabit.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Target: {selectedHabit.duration_minutes} min</div>
                </div>
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1.25rem', lineHeight: 1.6, textAlign: 'center' }}>
              Timer runs in the background.<br />Come back when you're done.
            </p>
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={cancelTimer}
                style={{ padding: '10px 24px', borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel session
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
