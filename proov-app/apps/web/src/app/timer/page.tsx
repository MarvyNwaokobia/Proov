'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, useWriteContract } from 'wagmi';
import { withCeloFee } from '@/lib/constants';
import {
  IconBolt,
  IconPlayerPlay,
  IconArrowLeft,
  IconClock,
} from '@tabler/icons-react';

interface Habit {
  id: string;
  name: string;
  emoji: string;
  hasTimer: boolean;
  targetDuration?: number;
  category?: string;
  active?: boolean;
}

type TimerView = 'pick' | 'setup' | 'running' | 'done';

const STOPS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];
const CIRC = 2 * Math.PI * 54;

const SESSION_ABI = [
  { name: 'startSession', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'habitId', type: 'uint256' }], outputs: [] },
  { name: 'endSession',   type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

function snapToStop(val: number) {
  return STOPS.reduce((p, c) => Math.abs(c - val) < Math.abs(p - val) ? c : p);
}

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
  const { writeContract } = useWriteContract();

  const [view, setView] = useState<TimerView>('pick');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [search, setSearch] = useState('');

  // sliderDisplay: live raw value shown while dragging
  // duration: snapped value committed on release
  const [sliderDisplay, setSliderDisplay] = useState(25);
  const [duration, setDuration] = useState(25);
  const [durationMode, setDurationMode] = useState<'slider' | 'manual'>('slider');
  const sliderRef = useRef<HTMLInputElement>(null);

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

  // Snap-on-release: native mouseup/touchend so live value shows between stops
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const doSnap = () => {
      const raw = parseInt(el.value);
      const snapped = snapToStop(raw);
      setDuration(snapped);
      setSliderDisplay(snapped);
    };
    el.addEventListener('mouseup', doSnap);
    el.addEventListener('touchend', doSnap);
    return () => {
      el.removeEventListener('mouseup', doSnap);
      el.removeEventListener('touchend', doSnap);
    };
  }, [view]); // re-attach when view changes (slider mounts/unmounts)

  // Load habits + restore active timer
  useEffect(() => {
    const raw = localStorage.getItem('proov_habits');
    if (raw) {
      try {
        const all: Habit[] = JSON.parse(raw);
        setHabits(all.filter(h => h.active !== false && h.hasTimer));
      } catch {}
    }

    const habitId = searchParams.get('habitId');
    if (habitId && raw) {
      try {
        const all: Habit[] = JSON.parse(raw);
        const found = all.find(h => h.id === habitId);
        if (found) {
          setSelectedHabit(found);
          const d = found.targetDuration || 25;
          setDuration(d); setSliderDisplay(d);
          setView('setup');
        }
      } catch {}
    }

    const saved = localStorage.getItem('proov_active_timer');
    if (saved) {
      try {
        const { habitId: hId, startedAt, duration: d, isCustom: ic, customLabel: cl } = JSON.parse(saved);
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const total = d * 60;
        if (elapsed < total) {
          setSecondsLeft(total - elapsed);
          setDuration(d); setSliderDisplay(d);
          setIsCustom(ic || false);
          setCustomLabel(cl || '');
          setView('running');
          if (hId && raw) {
            const all: Habit[] = JSON.parse(raw);
            const found = all.find(h => h.id === hId);
            if (found) setSelectedHabit(found);
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
      if (isConnected && process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS) {
        try {
          writeContract(withCeloFee({
            address: process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS as `0x${string}`,
            abi: SESSION_ABI,
            functionName: 'endSession' as const,
            args: [] as [],
          }));
        } catch {}
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

  const startTimer = () => {
    const now = Date.now();
    setSecondsLeft(duration * 60);
    setView('running');
    localStorage.setItem('proov_active_timer', JSON.stringify({
      habitId: selectedHabit?.id || null,
      startedAt: now,
      duration,
      isCustom,
      customLabel,
    }));
    if (isConnected && process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS && !isCustom && selectedHabit) {
      try {
        writeContract(withCeloFee({
          address: process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS as `0x${string}`,
          abi: SESSION_ABI,
          functionName: 'startSession' as const,
          args: [BigInt(selectedHabit.id)] as [bigint],
        }));
      } catch {}
    }
  };

  const confirmDone = () => {
    if (!isCustom && selectedHabit) {
      const today = new Date().toDateString();
      const key = `proov_completions_${today}`;
      const completions: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!completions.includes(selectedHabit.id)) {
        completions.push(selectedHabit.id);
        localStorage.setItem(key, JSON.stringify(completions));
      }
    }
    // endSession already fired silently when timer completed
    setView('pick');
    setSelectedHabit(null);
    setIsCustom(false);
    setCustomLabel('');
    setSecondsLeft(0);
  };

  const cancelTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    localStorage.removeItem('proov_active_timer');
    setView('pick');
  };

  const totalSeconds = duration * 60;
  const progress = (view === 'running' || view === 'done')
    ? 1 - (secondsLeft / totalSeconds)
    : 0;
  const strokeDashoffset = CIRC * (1 - Math.min(progress, 1));
  const isRunning = view === 'running';
  const isDone = view === 'done';

  const filteredHabits = habits.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectHabit = (habit: Habit) => {
    setSelectedHabit(habit);
    const d = habit.targetDuration || 25;
    setDuration(d);
    setSliderDisplay(d);
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
          <div style={{ position: 'relative', width: 160, height: 160 }}>
            {/* Pulse glow when running */}
            {(isRunning || isDone) && (
              <div style={{
                position: 'absolute', inset: -16, borderRadius: '50%',
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

            <svg width="160" height="160" style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
              {/* Track */}
              <circle cx="80" cy="80" r="54" fill="none" stroke="var(--border2)" strokeWidth="8" />
              {/* Glow layer */}
              {(isRunning || isDone) && (
                <circle cx="80" cy="80" r="54" fill="none" stroke="var(--accent)" strokeWidth="14"
                  strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={strokeDashoffset}
                  opacity="0.2" style={{ filter: 'blur(4px)', transition: 'stroke-dashoffset 1s linear' }} />
              )}
              {/* Progress ring */}
              <circle cx="80" cy="80" r="54" fill="none" stroke="var(--accent)" strokeWidth="8"
                strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>

            {/* Center content */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
              {isDone ? (
                <>
                  <span style={{ fontSize: 32 }}>🎉</span>
                  <span style={{ fontSize: 10, color: 'var(--accent-text)', fontWeight: 700, marginTop: 4 }}>Done!</span>
                </>
              ) : isRunning ? (
                <>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: -1, lineHeight: 1 }}>
                    {fmtTime(secondsLeft)}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3, maxWidth: 80, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedHabit ? `${selectedHabit.emoji} ${selectedHabit.name}` : customLabel || 'Session'}
                  </span>
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
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 16, padding: '1.25rem', textAlign: 'center', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--success-text)', marginBottom: 6 }}>
              {isCustom
                ? `${fmtDur(duration)} complete!`
                : `${selectedHabit?.emoji} ${selectedHabit?.name} done!`}
            </p>
            {!isCustom && <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1rem' }}>Tap to save your streak</p>}
            <button onClick={confirmDone} style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px var(--btn-primary-shadow)' }}>
              {isCustom ? 'Nice work ✓. Session saved' : 'Mark complete'}
            </button>
          </div>
        )}

        {/* PICK HABIT */}
        {view === 'pick' && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.75rem' }}>
              Select habit
            </p>
            <input
              type="text"
              placeholder="Search habits..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: '0.75rem' }}
            />

            {filteredHabits.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text3)', fontSize: 13 }}>
                {habits.length === 0 ? (
                  <>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                    <p style={{ marginBottom: 8 }}>No timed habits yet</p>
                    <a href="/habits" style={{ color: 'var(--accent-text)', fontSize: 12, fontWeight: 600 }}>Create one →</a>
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
                      {habit.targetDuration ? `Target: ${fmtDur(habit.targetDuration)}` : ''}
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
                  {selectedHabit.targetDuration && (
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>Target: {fmtDur(selectedHabit.targetDuration)}</div>
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

            {/* Duration mode toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
              {(['slider', 'manual'] as const).map(m => (
                <button key={m} onClick={() => setDurationMode(m)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${durationMode === m ? 'var(--accent)' : 'var(--border)'}`,
                  background: durationMode === m ? 'var(--accent-bg)' : 'transparent',
                  color: durationMode === m ? 'var(--accent-text)' : 'var(--text3)',
                  transition: 'all .15s',
                }}>
                  {m === 'slider' ? '⟷ Slider' : '✎ Manual'}
                </button>
              ))}
            </div>

            {/* Live duration display — updates every frame while dragging */}
            <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: -1.5, marginBottom: '0.875rem' }}>
              {fmtDur(sliderDisplay)}
            </div>

            {durationMode === 'slider' ? (
              <div style={{ marginBottom: '1.25rem' }}>
                {/* The slider: onChange = live display only; native mouseup/touchend = snap */}
                <input
                  ref={sliderRef}
                  type="range"
                  min={1}
                  max={240}
                  value={sliderDisplay}
                  onChange={e => setSliderDisplay(parseInt(e.target.value))}
                  style={{
                    WebkitAppearance: 'none', width: '100%', height: 4, borderRadius: 2,
                    background: `linear-gradient(to right, var(--accent) ${(sliderDisplay / 240) * 100}%, var(--border2) ${(sliderDisplay / 240) * 100}%)`,
                    outline: 'none', cursor: 'pointer',
                  }}
                />
                <style>{`
                  input[type='range']::-webkit-slider-thumb {
                    -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%;
                    background: var(--btn-primary-bg); cursor: pointer;
                    box-shadow: 0 2px 8px var(--btn-primary-shadow); transition: transform .15s;
                  }
                  input[type='range']::-webkit-slider-thumb:hover { transform: scale(1.2); }
                  input[type='range']::-moz-range-thumb {
                    width: 20px; height: 20px; border-radius: 50%;
                    background: var(--btn-primary-bg); cursor: pointer; border: none;
                  }
                `}</style>
                {/* Stop labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  {STOPS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setSliderDisplay(s); setDuration(s); }}
                      style={{
                        fontSize: 8, padding: '2px 1px', background: 'none', border: 'none',
                        cursor: 'pointer', fontFamily: 'inherit',
                        color: sliderDisplay === s ? 'var(--accent-text)' : 'var(--text3)',
                        fontWeight: sliderDisplay === s ? 700 : 400,
                        transition: 'color .1s',
                      }}
                    >
                      {s < 60 ? `${s}m` : `${s / 60}h`}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: '1.25rem' }}>
                <button
                  onClick={() => { const n = Math.max(1, sliderDisplay - 5); setSliderDisplay(n); setDuration(n); }}
                  style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >−</button>
                <input
                  type="number"
                  value={sliderDisplay}
                  min={1}
                  max={480}
                  onChange={e => { const n = Math.min(480, Math.max(1, parseInt(e.target.value) || 1)); setSliderDisplay(n); setDuration(n); }}
                  style={{ width: 80, textAlign: 'center', fontSize: 24, fontWeight: 700, padding: '8px 4px' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>min</span>
                <button
                  onClick={() => { const n = Math.min(480, sliderDisplay + 5); setSliderDisplay(n); setDuration(n); }}
                  style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >+</button>
              </div>
            )}

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
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Timer runs in the background.<br />Come back when you're done.
            </p>
            <button
              onClick={cancelTimer}
              style={{ padding: '10px 24px', borderRadius: 12, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel session
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
