'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { withCeloFee } from '@/lib/constants';
import { useStartSession, useEndSession } from '@/hooks/useSession';
import { TxToast } from '@/components/shared/TxToast';

const PRESETS = [
  { label: '5m',  minutes: 5   },
  { label: '15m', minutes: 15  },
  { label: '25m', minutes: 25  },
  { label: '45m', minutes: 45  },
  { label: '1h',  minutes: 60  },
  { label: '90m', minutes: 90  },
  { label: '2h',  minutes: 120 },
  { label: '4h',  minutes: 240 },
] as const;

const MIN_MINUTES = 1;
const MAX_MINUTES = 480;
const MIN_FOR_CREDIT = 25; // contract minimum for streak credit
const CIRC = 2 * Math.PI * 54;

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function TimerPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push('/'); }, [isConnected, router]);

  const [minutes, setMinutes] = useState(25);
  const [inputVal, setInputVal] = useState('25');
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { startSession, hash: startHash, isPending: isStarting } = useStartSession();
  const { endSession, hash: endHash, isPending: isEnding } = useEndSession();

  // Reconstruct timer from localStorage (survives page refresh)
  useEffect(() => {
    const savedStart = localStorage.getItem('proov_timer_start');
    const savedDuration = localStorage.getItem('proov_timer_duration');
    if (savedStart && savedDuration) {
      const start = parseInt(savedStart);
      const duration = parseInt(savedDuration);
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = duration * 60 - elapsed;
      if (remaining > 0) {
        setMinutes(duration);
        setInputVal(String(duration));
        setSecondsLeft(remaining);
        setRunning(true);
      } else {
        localStorage.removeItem('proov_timer_start');
        localStorage.removeItem('proov_timer_duration');
        setMinutes(duration);
        setCompleted(true);
      }
    }
  }, []);

  // Countdown tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          setCompleted(true);
          localStorage.removeItem('proov_timer_start');
          localStorage.removeItem('proov_timer_duration');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [running]);

  const totalSeconds = minutes * 60;
  const progress = (running || completed)
    ? 1 - secondsLeft / totalSeconds
    : 0;

  const handleStart = () => {
    setError('');
    if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
      setError(`Duration must be between ${MIN_MINUTES} and ${MAX_MINUTES} minutes`);
      return;
    }
    const now = Date.now();
    localStorage.setItem('proov_timer_start', String(now));
    localStorage.setItem('proov_timer_duration', String(minutes));
    setSecondsLeft(minutes * 60);
    setRunning(true);
    setCompleted(false);

    // Try to record onchain — timer still runs even if this fails
    if (process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS) {
      try { startSession(0); } catch {}
    }
  };

  const handleEnd = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setCompleted(false);
    setSecondsLeft(0);
    localStorage.removeItem('proov_timer_start');
    localStorage.removeItem('proov_timer_duration');

    if (process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS) {
      try { endSession(); } catch {}
    }
  };

  const setMin = (n: number) => {
    const clamped = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, n));
    setMinutes(clamped);
    setInputVal(String(clamped));
  };

  if (!isConnected) return null;

  return (
    <div className="min-h-screen app-bg pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-[0.08]"
        style={{ background: `radial-gradient(circle, var(--accent), transparent 70%)` }} />

      {/* Header */}
      <div className="px-4 py-4 sticky top-0 z-10" style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors text-sm">←</Link>
          <p style={{ color: 'var(--text)', fontWeight: 700 }}>Focus Timer</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 relative z-10" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>

        {/* Completed flash */}
        {completed && (
          <div style={{
            width: '100%', background: 'var(--success-bg)', border: '1px solid var(--success)',
            borderRadius: 16, padding: '1.25rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--success-text)', marginBottom: 12 }}>
              {fmtDuration(minutes)} complete!
            </p>
            <button onClick={handleEnd} style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Done ✓
            </button>
          </div>
        )}

        {/* Ring */}
        <div style={{ position: 'relative', width: 160, height: 160 }}>
          <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="80" cy="80" r="54" fill="none" stroke="var(--border2)" strokeWidth="9" />
            <circle
              cx="80" cy="80" r="54"
              fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 6px var(--accent))' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: running ? 26 : 20, fontWeight: 800, color: 'var(--text)', letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>
              {running ? fmt(secondsLeft) : fmtDuration(minutes)}
            </span>
            {running && (
              <span style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>remaining</span>
            )}
            {!running && !completed && minutes < MIN_FOR_CREDIT && (
              <span style={{ fontSize: 9, color: 'var(--amber)', marginTop: 2 }}>no streak credit</span>
            )}
          </div>
        </div>

        {/* Duration picker — idle only */}
        {!running && !completed && (
          <div style={{ width: '100%', maxWidth: 360 }}>
            {/* Preset chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1rem' }}>
              {PRESETS.map(p => (
                <button
                  key={p.minutes}
                  onClick={() => setMin(p.minutes)}
                  style={{
                    padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${minutes === p.minutes ? 'var(--accent)' : 'var(--border)'}`,
                    background: minutes === p.minutes ? 'var(--accent-bg)' : 'transparent',
                    color: minutes === p.minutes ? 'var(--accent-text)' : 'var(--text3)',
                    transition: 'all .15s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* +/- stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
              <button
                onClick={() => setMin(minutes - 5)}
                style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}
              >−</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" value={inputVal} min={MIN_MINUTES} max={MAX_MINUTES}
                  onChange={e => { setInputVal(e.target.value); const n = parseInt(e.target.value); if (!isNaN(n)) setMin(n); }}
                  style={{ width: 70, textAlign: 'center', padding: 8, fontSize: 16, fontWeight: 700, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>min</span>
              </div>
              <button
                onClick={() => setMin(minutes + 5)}
                style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}
              >+</button>
            </div>

            {error && <p style={{ color: '#f43f5e', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{error}</p>}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!running && !completed && (
            <button
              onClick={handleStart}
              disabled={isStarting}
              style={{
                width: '100%', padding: 14, borderRadius: 14, border: 'none',
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 20px var(--btn-primary-shadow)',
                transition: 'transform .15s, box-shadow .15s, opacity .15s',
                opacity: isStarting ? 0.7 : 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {isStarting ? 'Starting…' : `▶ Start ${fmtDuration(minutes)} session`}
            </button>
          )}

          {running && (
            <button
              onClick={handleEnd}
              disabled={isEnding}
              style={{
                width: '100%', padding: 14, borderRadius: 14,
                border: '1px solid var(--border2)', background: 'transparent',
                color: 'var(--text2)', fontSize: 14, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              }}
            >
              {isEnding ? 'Saving…' : 'End session early'}
            </button>
          )}
        </div>
      </div>

      <TxToast hash={startHash} pendingText="Starting session…" successText="Session started!" />
      <TxToast hash={endHash}   pendingText="Saving progress…"  successText="Streak updated! 🔥" />
    </div>
  );
}
