"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useHabits, useCreateHabit, useDeactivateHabit } from "@/hooks/useHabits";
import { useCircle } from "@/hooks/useCircle";
import { TxToast } from "@/components/shared/TxToast";
import {
  HabitType, HabitTypeLabel, Frequency,
  HABIT_CATEGORIES, getCategoryById, SUGGESTED_HABITS,
} from "@/lib/constants";
import { getHabitMeta, setPendingCategory, reconcilePendingCategory, HabitMeta } from "@/lib/habitMeta";

function humanizeError(error: unknown): string {
  if (!error) return '';
  const msg = String((error as Error)?.message ?? error);
  if (/insufficient[_ ]funds|overshot|balance 0/i.test(msg))
    return 'Insufficient balance. Add cUSD to your account and try again.';
  if (/user rejected|user denied|cancelled/i.test(msg))
    return 'You cancelled that action.';
  if (/execution reverted|reverted/i.test(msg))
    return 'Something went wrong. Please try again.';
  if (/network|fetch|timeout/i.test(msg))
    return 'Network error. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

// Duration stop values in minutes
const STOPS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];
function snapToStop(val: number) {
  return STOPS.reduce((p, c) => Math.abs(c - val) < Math.abs(p - val) ? c : p);
}
function fmtDur(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const CATEGORY_TO_TYPE: Record<string, number> = {
  focus: HabitType.FOCUS, fitness: HabitType.FITNESS, wellness: HabitType.CUSTOM,
  learning: HabitType.READING, nutrition: HabitType.HYDRATION,
  social: HabitType.CUSTOM, creative: HabitType.CUSTOM, custom: HabitType.CUSTOM,
};

// ── Duration Picker ──────────────────────────────────────────────────────
function DurationPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [mode, setMode] = useState<'slider' | 'manual'>('slider');
  const stopIdx = STOPS.indexOf(snapToStop(value));

  const modeBtn = (m: 'slider' | 'manual', label: string) => (
    <button key={m} onClick={() => setMode(m)} style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit',
      border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
      background: mode === m ? 'var(--accent-bg)' : 'transparent',
      color: mode === m ? 'var(--accent-text)' : 'var(--text3)', transition: 'all .15s',
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {modeBtn('slider', '⟷ Slider')}{modeBtn('manual', '✎ Manual')}
      </div>
      {mode === 'slider' ? (
        <div>
          <p style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 12, letterSpacing: -1 }}>
            {fmtDur(value)}
          </p>
          <input type="range" min={0} max={STOPS.length - 1}
            value={stopIdx >= 0 ? stopIdx : 4}
            onChange={e => onChange(STOPS[parseInt(e.target.value)])}
            className="duration-slider" style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {STOPS.map(s => (
              <button key={s} onClick={() => onChange(s)} style={{
                fontSize: 9, padding: '2px 1px', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                color: value === s ? 'var(--accent-text)' : 'var(--text3)',
                fontWeight: value === s ? 700 : 400,
              }}>{s < 60 ? `${s}m` : `${s / 60}h`}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
            <button onClick={() => onChange(Math.max(1, value - 5))} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>−</button>
            <input type="number" value={value} min={1} max={480}
              onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) onChange(Math.min(480, Math.max(1, n))); }}
              style={{ width: 80, textAlign: 'center', padding: 8, fontSize: 24, fontWeight: 700 }}
            />
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>min</span>
            <button onClick={() => onChange(Math.min(480, value + 5))} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDur(value)}</p>
        </div>
      )}
    </div>
  );
}

// ── Multi-step Habit Creation ────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5;

interface CreateFormProps {
  address: string;
  circle: readonly `0x${string}`[];
  onDone: () => void;
  onCancel: () => void;
  prefill?: { name: string; categoryId: string; duration: number; habitType: number };
  createHabit: (name: string, type: number, duration: number, frequency: number) => void;
  isCreating: boolean;
  createError: unknown;
  setPendingMeta: (name: string, catId: string, privacy: HabitMeta['privacy'], visibleTo: HabitMeta['visibleTo'], viewers: string[]) => void;
}

function CreateHabitForm({ address, circle, onDone, onCancel, prefill, createHabit, isCreating, createError, setPendingMeta }: CreateFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(prefill?.name ?? '');
  const [categoryId, setCategoryId] = useState(prefill?.categoryId ?? 'custom');
  const [hasTimer, setHasTimer] = useState(true);
  const [duration, setDuration] = useState(prefill?.duration ?? 25);
  const [habitType, setHabitType] = useState(prefill?.habitType ?? HabitType.FOCUS);
  const [frequency, setFrequency] = useState<number>(Frequency.DAILY);
  const [privacy, setPrivacy] = useState<HabitMeta['privacy']>('private');
  const [visibleTo, setVisibleTo] = useState<HabitMeta['visibleTo']>('none');
  const [selectedViewers, setSelectedViewers] = useState<string[]>([]);
  const [viewerInput, setViewerInput] = useState('');
  const [formError, setFormError] = useState('');

  const cat = getCategoryById(categoryId);

  const nextStep = () => {
    if (step === 1 && !name.trim()) { setFormError('Enter a habit name'); return; }
    setFormError('');
    if (step === 2 && !hasTimer) { setStep(3); return; }
    setStep(s => (s + 1) as Step);
  };
  const prevStep = () => setStep(s => Math.max(1, s - 1) as Step);

  const handleCreate = () => {
    if (!name.trim()) { setFormError('Enter a habit name'); return; }
    if (!process.env.NEXT_PUBLIC_PROOV_CORE_ADDRESS) { setFormError('App not configured yet — contract address missing'); return; }
    setFormError('');
    setPendingMeta(name.trim(), categoryId, privacy, visibleTo, selectedViewers);
    createHabit(name.trim(), habitType, hasTimer ? duration * 60 : 0, frequency);
  };

  const stepLabel = ['Name', 'Type', 'Schedule', 'Privacy', 'Confirm'];

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '1.25rem' }}>
      {/* Step progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem' }}>
        {stepLabel.map((l, i) => (
          <div key={l} style={{ flex: 1, height: 3, borderRadius: 2, background: step > i ? 'var(--accent)' : 'var(--border2)', transition: 'background .2s' }} />
        ))}
      </div>

      {/* Step 1: Name + Category */}
      {step === 1 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Name your habit</p>
          <input autoFocus value={name}
            onChange={e => { setName(e.target.value); setFormError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') nextStep(); }}
            placeholder="e.g. Morning Run, Deep Work..."
            style={{ marginBottom: 14 }}
          />
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.2px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Category</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            {HABIT_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => {
                setCategoryId(c.id);
                setHabitType(CATEGORY_TO_TYPE[c.id] ?? HabitType.CUSTOM);
              }} style={{
                borderRadius: 12, padding: '10px 4px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${categoryId === c.id ? c.color + '80' : 'var(--border)'}`,
                background: categoryId === c.id ? c.color + '18' : 'transparent',
                color: categoryId === c.id ? c.color : 'var(--text3)',
                transform: categoryId === c.id ? 'scale(1.04)' : 'none', transition: 'all .15s',
              }}>
                <span style={{ fontSize: 16 }}>{c.emoji}</span>
                <span>{c.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Timer or Tick */}
      {step === 2 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>How do you complete it?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: hasTimer ? 20 : 0 }}>
            {[
              { id: true, emoji: '⏱', title: 'Timed habit', desc: 'Set a duration. Timer auto-marks it done.' },
              { id: false, emoji: '✅', title: 'Tap to complete', desc: 'No timer needed. Just tick it each day.' },
            ].map(opt => (
              <button key={String(opt.id)} onClick={() => setHasTimer(opt.id)} style={{
                padding: '1.25rem .875rem', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${hasTimer === opt.id ? 'var(--accent)' : 'var(--border)'}`,
                background: hasTimer === opt.id ? 'var(--accent-bg)' : 'transparent',
                textAlign: 'center', transition: 'all .15s',
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{opt.emoji}</div>
                <p style={{ fontSize: 12, fontWeight: 600, color: hasTimer === opt.id ? 'var(--accent-text)' : 'var(--text)', marginBottom: 4 }}>{opt.title}</p>
                <p style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>{opt.desc}</p>
              </button>
            ))}
          </div>
          {hasTimer && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.2px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 12 }}>Duration</p>
              <DurationPicker value={duration} onChange={setDuration} />
            </div>
          )}
        </div>
      )}

      {/* Step 3: Frequency */}
      {step === 3 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>How often?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[{ val: Frequency.DAILY, label: 'Daily', emoji: '📅', desc: 'Every day' }, { val: Frequency.WEEKLY, label: 'Weekly', emoji: '📆', desc: 'Once a week' }].map(f => (
              <button key={f.val} onClick={() => setFrequency(f.val)} style={{
                padding: '1rem', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                border: `1px solid ${frequency === f.val ? 'var(--accent)' : 'var(--border)'}`,
                background: frequency === f.val ? 'var(--accent-bg)' : 'transparent', transition: 'all .15s',
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{f.emoji}</div>
                <p style={{ fontSize: 13, fontWeight: 600, color: frequency === f.val ? 'var(--accent-text)' : 'var(--text)' }}>{f.label}</p>
                <p style={{ fontSize: 10, color: 'var(--text3)' }}>{f.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Privacy */}
      {step === 4 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Who can see this habit?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {[
              { key: 'none' as const, emoji: '🔒', label: 'Private', desc: 'Only you can see this.' },
              { key: 'all_circle' as const, emoji: '👥', label: 'Everyone in my circle', desc: 'All circle members see your progress.' },
              { key: 'selected' as const, emoji: '🎯', label: 'Choose who sees it', desc: 'Pick specific people.' },
            ].map(opt => (
              <button key={opt.key} onClick={() => {
                setVisibleTo(opt.key);
                setPrivacy(opt.key === 'none' ? 'private' : 'public');
              }} style={{
                padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                border: `1px solid ${visibleTo === opt.key ? 'var(--accent)' : 'var(--border)'}`,
                background: visibleTo === opt.key ? 'var(--accent-bg)' : 'transparent', transition: 'all .15s',
              }}>
                <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: visibleTo === opt.key ? 'var(--accent-text)' : 'var(--text)', margin: 0 }}>{opt.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
          {visibleTo === 'selected' && (
            <div>
              <input placeholder="Add by username..." value={viewerInput}
                onChange={e => setViewerInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && viewerInput.trim()) {
                    const u = viewerInput.replace(/^@/, '').trim();
                    if (!selectedViewers.includes(u)) setSelectedViewers(v => [...v, u]);
                    setViewerInput('');
                  }
                }}
                style={{ marginBottom: 8 }}
              />
              {selectedViewers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedViewers.map(u => (
                    <span key={u} style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      @{u}
                      <button onClick={() => setSelectedViewers(v => v.filter(x => x !== u))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Confirm */}
      {step === 5 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Confirm your habit</p>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{cat?.emoji ?? '◆'}</span>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{name}</p>
                <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{cat?.label}</p>
              </div>
            </div>
            {[
              ['Type', hasTimer ? `⏱ Timed — ${fmtDur(duration)}` : '✅ Tap to complete'],
              ['Schedule', frequency === Frequency.DAILY ? '📅 Daily' : '📆 Weekly'],
              ['Visible to', visibleTo === 'none' ? '🔒 Private' : visibleTo === 'all_circle' ? '👥 Everyone in circle' : `🎯 ${selectedViewers.map(u => '@' + u).join(', ') || 'Selected people'}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <span style={{ color: 'var(--text3)' }}>{label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
          {(formError || !!createError) && (
            <p style={{ color: '#f43f5e', fontSize: 12, marginBottom: 8 }}>
              {formError || humanizeError(createError)}
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={step === 1 ? onCancel : prevStep} style={{
          flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {step === 1 ? 'Cancel' : '← Back'}
        </button>
        {step < 5 ? (
          <button onClick={nextStep} style={{
            flex: 2, padding: '11px', borderRadius: 12, border: 'none',
            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Next →
          </button>
        ) : (
          <button onClick={handleCreate} disabled={isCreating} style={{
            flex: 2, padding: '11px', borderRadius: 12, border: 'none',
            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
            fontSize: 13, fontWeight: 600, cursor: isCreating ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: isCreating ? 0.6 : 1,
          }}>
            {isCreating ? 'Saving…' : 'Create habit'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function HabitsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push('/'); }, [isConnected, router]);

  const { habits, refetch } = useHabits();
  const { circle } = useCircle();
  const { createHabit, hash: createHash, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateHabit();
  const { deactivateHabit, hash: deactivateHash, isSuccess: deactivateSuccess } = useDeactivateHabit();

  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; categoryId: string; duration: number; habitType: number } | undefined>();
  const [savedFlash, setSavedFlash] = useState(false);

  const habitMeta = address ? getHabitMeta(address) : {};
  const activeHabits = habits.filter(h => h.active);

  useEffect(() => {
    if (createSuccess) {
      if (address) reconcilePendingCategory(address, habits as unknown as Array<{ id: bigint; name: string; createdAt: bigint }>);
      refetch();
      setShowForm(false);
      setPrefill(undefined);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    }
  }, [createSuccess, address, habits, refetch]);

  useEffect(() => {
    if (deactivateSuccess) refetch();
  }, [deactivateSuccess, refetch]);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen app-bg pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-[0.05] rounded-full"
        style={{ background: 'radial-gradient(ellipse, var(--accent), transparent)' }} />

      {/* Header */}
      <div className="px-4 py-4 sticky top-0 z-30" style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors text-sm">←</Link>
            <p style={{ color: 'var(--text)', fontWeight: 700 }}>Habits</p>
          </div>
          {!showForm && (
            <button onClick={() => { setPrefill(undefined); setShowForm(true); }}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
              + New
            </button>
          )}
        </div>
      </div>

      {/* Saved flash */}
      <AnimatePresence>
        {savedFlash && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-lg flex items-center gap-2 text-sm font-medium"
            style={{ background: 'var(--success)', color: '#fff' }}>
            <span>✓</span><span>Habit saved!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Multi-step creation form */}
        <AnimatePresence>
          {showForm && address && (
            <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.2 }}>
              <CreateHabitForm
                address={address}
                circle={circle}
                onDone={() => setShowForm(false)}
                onCancel={() => { setShowForm(false); setPrefill(undefined); }}
                prefill={prefill}
                createHabit={createHabit}
                isCreating={isCreating}
                createError={createError}
                setPendingMeta={(name, catId, privacy, visibleTo, viewers) => {
                  if (address) setPendingCategory(address, name, catId, privacy, visibleTo, viewers);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggested habits */}
        {!showForm && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 10 }}>Suggestions</p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
              {SUGGESTED_HABITS.map(s => (
                <motion.button key={s.name} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setPrefill({ name: s.name, categoryId: s.category, duration: s.duration, habitType: CATEGORY_TO_TYPE[s.category] ?? HabitType.CUSTOM });
                    setShowForm(true);
                  }}
                  style={{
                    flexShrink: 0, width: 136, padding: '12px', borderRadius: 14, cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                    transition: 'all .15s',
                  }}>
                  <span style={{ fontSize: 22, display: 'block', marginBottom: 6 }}>{s.emoji}</span>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{s.name}</p>
                  <p style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4, marginBottom: 6 }}>{s.description}</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-text)' }}>Customise →</p>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Active habits — 2-column grid (Section 9) */}
        {activeHabits.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 10 }}>
              Active · {activeHabits.length}
            </p>
            {/* 2-column grid — minWidth: 0 on cards prevents overflow */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              width: '100%',
              maxWidth: '100%',
            }}>
              {activeHabits.map((habit) => {
                const meta = habitMeta[habit.id.toString()];
                const cat = meta ? getCategoryById(meta.categoryId) : null;
                const hasTimer = Number(habit.targetDuration) > 0;
                return (
                  <motion.div key={habit.id.toString()} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{
                      width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
                      background: 'var(--card-bg)',
                      border: `1px solid ${cat ? cat.color + '50' : 'var(--card-border)'}`,
                      borderRadius: 14, padding: '.875rem',
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 20 }}>{cat ? cat.emoji : '◆'}</span>
                      <span style={{ fontSize: 10, color: meta?.privacy === 'private' ? 'var(--text3)' : 'var(--accent-text)' }}>
                        {meta?.privacy === 'private' ? '🔒' : '👥'}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {habit.name}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                        {hasTimer ? `⏱ ${Math.round(Number(habit.targetDuration) / 60)} min` : '✅ Tap to complete'}
                        {' · '}{Number(habit.frequency) === 0 ? 'Daily' : 'Weekly'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      {hasTimer && (
                        <Link href={`/timer?habitId=${habit.id.toString()}`} style={{
                          flex: 1, padding: '5px', borderRadius: 8, border: '1px solid var(--accent-border)',
                          background: 'var(--accent-bg)', color: 'var(--accent-text)',
                          fontSize: 10, fontWeight: 600, textDecoration: 'none', textAlign: 'center',
                        }}>▶ Start</Link>
                      )}
                      <button onClick={() => deactivateHabit(Number(habit.id))} style={{
                        flex: hasTimer ? 0 : 1, padding: '5px 8px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--text3)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                      }}>Remove</button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {activeHabits.length === 0 && !showForm && (
          <div className="glass rounded-2xl p-8 text-center">
            <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 12 }}>No habits yet.</p>
            <button onClick={() => setShowForm(true)} style={{
              padding: '10px 20px', borderRadius: 12, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>+ Create your first habit</button>
          </div>
        )}
      </div>

      <TxToast hash={createHash}    pendingText="Saving habit…"  successText="Habit saved! ✓" />
      <TxToast hash={deactivateHash} pendingText="Removing…"     successText="Removed." />
    </div>
  );
}
