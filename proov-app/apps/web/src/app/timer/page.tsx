'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { useHabits } from '@/hooks/useHabits';
import { useStartSession, useEndSession } from '@/hooks/useSession';
import { getHabitMeta } from '@/lib/habitMeta';
import { TxToast } from '@/components/shared/TxToast';

// Cursor glow hook for timer page
function useCursorGlow() {
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const el = document.getElementById('timer-cursor-glow');
      if (el) { el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px'; }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);
}

const STOPS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];
const CIRC = 2 * Math.PI * 54;

function snapToStop(val: number) {
  return STOPS.reduce((p, c) => Math.abs(c - val) < Math.abs(p - val) ? c : p);
}

function fmt(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function fmtDur(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type TimerState = 'pick' | 'running' | 'done';

interface PickedHabit { id: string; name: string; emoji: string; duration: number; }

// ── Duration picker — live slider value during drag, snaps on release ────
function DurationPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [mode, setMode] = useState<'slider' | 'manual'>('slider');
  const [sliderDisplay, setSliderDisplay] = useState(value); // exact value while dragging
  const stopIdx = STOPS.indexOf(snapToStop(value));

  const modeBtn = (m: 'slider' | 'manual', label: string) => (
    <button
      key={m}
      onClick={() => setMode(m)}
      style={{
        padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
        background: mode === m ? 'var(--accent-bg)' : 'transparent',
        color: mode === m ? 'var(--accent-text)' : 'var(--text3)',
      }}
    >{label}</button>
  );

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {modeBtn('slider','⟷ Slider')}{modeBtn('manual','✎ Manual')}
      </div>

      {mode === 'slider' ? (
        <div>
          <p style={{ textAlign:'center', fontSize:24, fontWeight:800, color:'var(--text)', marginBottom:12, letterSpacing:-1 }}>
            {fmtDur(sliderDisplay)}
          </p>
          <input
            type="range" min={1} max={240}
            value={sliderDisplay}
            onInput={(e) => setSliderDisplay(parseInt((e.target as HTMLInputElement).value))}
            onChange={(e) => { const s = snapToStop(parseInt(e.target.value)); onChange(s); setSliderDisplay(s); }}
            className="duration-slider" style={{ width:'100%' }}
          />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
            {STOPS.map(s => (
              <button key={s} onClick={() => onChange(s)} style={{
                fontSize:9, padding:'2px 1px', background:'none', border:'none',
                cursor:'pointer', fontFamily:'inherit',
                color: value===s ? 'var(--accent-text)' : 'var(--text3)',
                fontWeight: value===s ? 700 : 400,
              }}>{s < 60 ? `${s}m` : `${s/60}h`}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:6 }}>
            <button onClick={() => onChange(Math.max(1, value - 5))} style={{ width:36, height:36, borderRadius:'50%', border:'1px solid var(--border2)', background:'transparent', color:'var(--text)', fontSize:18, cursor:'pointer', fontFamily:'inherit' }}>−</button>
            <input
              type="number" value={value} min={1} max={480}
              onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) onChange(Math.min(480, Math.max(1, n))); }}
              style={{ width:80, textAlign:'center', padding:8, fontSize:24, fontWeight:700 }}
            />
            <span style={{ fontSize:13, color:'var(--text2)' }}>min</span>
            <button onClick={() => onChange(Math.min(480, value + 5))} style={{ width:36, height:36, borderRadius:'50%', border:'1px solid var(--border2)', background:'transparent', color:'var(--text)', fontSize:18, cursor:'pointer', fontFamily:'inherit' }}>+</button>
          </div>
          <p style={{ fontSize:11, color:'var(--text3)' }}>{fmtDur(value)}</p>
        </div>
      )}
    </div>
  );
}

// ── Habit picker sub-component ───────────────────────────────────────────
function HabitPicker({ habits, habitMeta, address, onStart }: {
  habits: readonly { id: bigint; name: string; habitType: number; targetDuration: bigint; active: boolean }[];
  habitMeta: Record<string, { categoryId: string }>;
  address: string | undefined;
  onStart: (h: PickedHabit | null, dur: number, isCustom: boolean, label: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<PickedHabit | null>(null);
  const [dur, setDur] = useState(25);
  const [showCustom, setShowCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');

  const active = habits.filter(h => h.active);
  const filtered = active.filter(h => h.name.toLowerCase().includes(search.toLowerCase()));

  if (showCustom) return (
    <div>
      <button onClick={() => setShowCustom(false)} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:13, cursor:'pointer', marginBottom:12, fontFamily:'inherit' }}>← Back</button>
      <p style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:8 }}>What are you working on?</p>
      <input type="text" placeholder="e.g. Writing, Study, Deep work..." value={customLabel} onChange={e => setCustomLabel(e.target.value)} style={{ marginBottom:12 }} />
      <p style={{ fontSize:11, color:'var(--text3)', marginBottom:14 }}>Custom sessions don&apos;t count toward habit streaks.</p>
      <DurationPicker value={dur} onChange={setDur} />
      <button
        onClick={() => onStart(null, dur, true, customLabel || 'Custom session')}
        disabled={!customLabel.trim()}
        style={{
          width:'100%', padding:13, borderRadius:14, border:'none', marginTop:16,
          background: customLabel.trim() ? 'var(--btn-primary-bg)' : 'var(--bg3)',
          color: customLabel.trim() ? 'var(--btn-primary-text)' : 'var(--text3)',
          fontSize:14, fontWeight:600, cursor: customLabel.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit',
        }}
      >Start custom session</button>
    </div>
  );

  if (picked) return (
    <div>
      <button onClick={() => setPicked(null)} style={{ background:'none', border:'none', color:'var(--text3)', fontSize:13, cursor:'pointer', marginBottom:12, fontFamily:'inherit' }}>← Back</button>

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:12, marginBottom:'1.25rem' }}>
        <span style={{ fontSize:24 }}>{picked.emoji}</span>
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:'var(--accent-text)', margin:0 }}>{picked.name}</p>
          <p style={{ fontSize:11, color:'var(--text3)', margin:0 }}>Target: {picked.duration} min</p>
        </div>
      </div>

      <DurationPicker value={dur} onChange={setDur} />

      <button
        onClick={() => onStart(picked, dur, false, '')}
        style={{
          width:'100%', padding:14, borderRadius:14, border:'none', marginTop:16,
          background:'var(--btn-primary-bg)', color:'var(--btn-primary-text)',
          fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          boxShadow:'0 4px 20px var(--btn-primary-shadow)',
          transition:'transform .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
        onMouseLeave={e => (e.currentTarget.style.transform='translateY(0)')}
      >
        ▶ Start {fmtDur(dur)} session
      </button>
    </div>
  );

  return (
    <div>
      <p style={{ fontSize:11, fontWeight:600, letterSpacing:'1.2px', color:'var(--text3)', textTransform:'uppercase', marginBottom:10 }}>
        Which habit?
      </p>

      {active.length > 3 && (
        <input type="text" placeholder="Search habits..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom:10 }} />
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:'1rem' }}>
        {filtered.length === 0 && (
          <p style={{ fontSize:13, color:'var(--text3)', textAlign:'center', padding:'1rem' }}>
            {active.length === 0 ? 'No habits yet — create one first' : 'No matches'}
          </p>
        )}
        {filtered.map(habit => {
          const meta = address ? habitMeta[habit.id.toString()] : null;
          const emoji = meta ? '🔥' : '◆';
          const targetMins = Number(habit.targetDuration) / 60 || 25;
          const h: PickedHabit = { id: habit.id.toString(), name: habit.name, emoji, duration: targetMins };
          return (
            <div key={habit.id.toString()}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:12, cursor:'pointer', transition:'all .15s' }}
              onClick={() => { setPicked(h); setDur(targetMins); }}
              onMouseEnter={e => (e.currentTarget.style.borderColor='var(--accent-border)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor='var(--card-border)')}
            >
              <span style={{ fontSize:20 }}>{emoji}</span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:500, color:'var(--text)', margin:0 }}>{habit.name}</p>
                <p style={{ fontSize:11, color:'var(--text3)', margin:0 }}>{targetMins} min</p>
              </div>
              <button
                style={{ padding:'6px 14px', borderRadius:20, border:'none', background:'var(--btn-primary-bg)', color:'var(--btn-primary-text)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
                onClick={e => { e.stopPropagation(); onStart(h, targetMins, false, ''); }}
              >Start</button>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop:'1px solid var(--border)', paddingTop:'1rem' }}>
        <button
          onClick={() => setShowCustom(true)}
          style={{ width:'100%', padding:11, borderRadius:12, border:'1px solid var(--border2)', background:'transparent', color:'var(--text2)', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.background='var(--bg3)'; e.currentTarget.style.borderColor='var(--accent-border)'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--border2)'; }}
        >
          ⏱ Custom session (no habit link)
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function GrindTimerPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push('/'); }, [isConnected, router]);
  useCursorGlow();

  const { habits } = useHabits();
  const habitMeta = address ? getHabitMeta(address) : {};
  const { startSession, hash: startHash } = useStartSession();
  const { endSession, hash: endHash } = useEndSession();

  const [state, setState] = useState<TimerState>('pick');
  const [picked, setPicked] = useState<PickedHabit | null>(null);
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isCustom, setIsCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [glowing, setGlowing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('proov_active_timer');
    if (!saved) return;
    try {
      const { habitId, startedAt, duration: d, isCustom: ic, customLabel: cl } = JSON.parse(saved);
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const total = d * 60;
      if (elapsed < total) {
        setSecondsLeft(total - elapsed);
        setDuration(d);
        setIsCustom(ic || false);
        setCustomLabel(cl || '');
        setState('running');
        setGlowing(true);
        if (habitId) {
          const h = habits.find(h => h.id.toString() === habitId);
          if (h) setPicked({ id: h.id.toString(), name: h.name, emoji: '🔥', duration: d });
        }
      } else {
        localStorage.removeItem('proov_active_timer');
        setState('done');
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown tick
  useEffect(() => {
    if (state !== 'running') return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          localStorage.removeItem('proov_active_timer');
          setState('done');
          setGlowing(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [state]);

  const handleStart = (h: PickedHabit | null, dur: number, custom: boolean, label: string) => {
    const now = Date.now();
    setPicked(h);
    setDuration(dur);
    setIsCustom(custom);
    setCustomLabel(label);
    setSecondsLeft(dur * 60);
    setState('running');
    setGlowing(true);
    localStorage.setItem('proov_active_timer', JSON.stringify({
      habitId: h?.id || null, startedAt: now, duration: dur, isCustom: custom, customLabel: label,
    }));
    if (isConnected && !custom && process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS) {
      try { startSession(parseInt(h?.id || '0')); } catch {}
    }
  };

  const handleConfirmDone = () => {
    if (isConnected && process.env.NEXT_PUBLIC_SESSION_MANAGER_ADDRESS) {
      try { endSession(); } catch {}
    }
    setState('pick');
    setPicked(null);
    setGlowing(false);
  };

  const handleCancel = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    localStorage.removeItem('proov_active_timer');
    setState('pick');
    setGlowing(false);
  };

  const totalSecs = duration * 60;
  const progress = (state === 'running' || state === 'done') ? 1 - secondsLeft / totalSecs : 0;
  const strokeDashoffset = CIRC * (1 - progress);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen app-bg pb-24 relative overflow-hidden">
      {/* Cursor glow — follows mouse on desktop */}
      <div id="timer-cursor-glow" style={{ position: 'fixed', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-bg), transparent 70%)', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0, transition: 'left .1s ease, top .1s ease', opacity: 0.6 }} />
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-[0.07]"
        style={{ background:'radial-gradient(circle,var(--accent),transparent 70%)' }} />

      {/* Header */}
      <div className="px-4 py-4 sticky top-0 z-10" style={{ background:'var(--nav-bg)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:'1px solid var(--border)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors text-sm">←</Link>
          <p style={{ color:'var(--text)', fontWeight:700 }}>⚡ Grind Timer</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 relative z-10">

        {/* Progress ring */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'1.5rem' }}>
          <div style={{
            position:'relative', width:160, height:160,
            filter: glowing ? 'drop-shadow(0 0 20px var(--accent)) drop-shadow(0 0 40px var(--accent-bg))' : 'none',
            transition:'filter .5s ease',
          }}>
            <svg width="160" height="160" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="80" cy="80" r="54" fill="none" stroke="var(--border2)" strokeWidth="8" />
              {glowing && (
                <circle cx="80" cy="80" r="54" fill="none" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={strokeDashoffset} opacity="0.18"
                  style={{ transition:'stroke-dashoffset 1s linear' }} />
              )}
              <circle cx="80" cy="80" r="54" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={strokeDashoffset}
                style={{ transition:'stroke-dashoffset 1s linear' }} />
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              {state === 'running' ? (
                <>
                  <span style={{ fontSize:24, fontWeight:700, color:'var(--text)', letterSpacing:-1 }}>{fmt(secondsLeft)}</span>
                  <span style={{ fontSize:10, color:'var(--text3)', marginTop:2, textAlign:'center', maxWidth:100 }}>
                    {picked ? `${picked.emoji} ${picked.name}` : customLabel || 'Session'}
                  </span>
                </>
              ) : state === 'done' ? (
                <>
                  <span style={{ fontSize:34 }}>🎉</span>
                  <span style={{ fontSize:11, color:'var(--accent-text)', fontWeight:600, marginTop:4 }}>Done!</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize:28, color:'var(--text3)' }}>⚡</span>
                  <span style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Grind Timer</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Done state */}
        {state === 'done' && (
          <div style={{ background:'var(--success-bg)', border:'1px solid var(--success)', borderRadius:16, padding:'1.25rem', textAlign:'center', marginBottom:'1.25rem' }}>
            <p style={{ fontSize:16, fontWeight:700, color:'var(--success-text)', marginBottom:4 }}>
              {isCustom ? `${fmtDur(duration)} session complete!` : `${picked?.emoji} ${picked?.name} done!`}
            </p>
            {!isCustom && <p style={{ fontSize:13, color:'var(--text2)', marginBottom:'1rem' }}>Tap to save your progress</p>}
            <button onClick={handleConfirmDone} style={{
              padding:'11px 28px', borderRadius:12, border:'none',
              background:'var(--btn-primary-bg)', color:'var(--btn-primary-text)',
              fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              boxShadow:'0 4px 16px var(--btn-primary-shadow)',
            }}>
              {isCustom ? 'Nice work ✓' : 'Save to streak →'}
            </button>
          </div>
        )}

        {/* Running state */}
        {state === 'running' && (
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:13, color:'var(--text3)', marginBottom:'1rem' }}>
              Timer runs in the background — come back when done
            </p>
            <button onClick={handleCancel} style={{
              padding:'10px 24px', borderRadius:12, border:'1px solid var(--border2)',
              background:'transparent', color:'var(--text3)', fontSize:13, cursor:'pointer', fontFamily:'inherit',
            }}>
              Cancel session
            </button>
          </div>
        )}

        {/* Habit picker */}
        {state === 'pick' && (
          <HabitPicker habits={habits} habitMeta={habitMeta} address={address} onStart={handleStart} />
        )}
      </div>

      <TxToast hash={startHash} pendingText="Starting session…" successText="Session started!" />
      <TxToast hash={endHash}   pendingText="Saving progress…"  successText="Streak updated! 🔥" />
    </div>
  );
}
