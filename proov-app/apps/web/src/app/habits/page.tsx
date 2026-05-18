"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useHabits, useCreateHabit, useDeactivateHabit } from "@/hooks/useHabits";
import { TxToast } from "@/components/shared/TxToast";
import {
  HabitType, HabitTypeLabel, Frequency,
  HABIT_CATEGORIES, getCategoryById, SUGGESTED_HABITS,
} from "@/lib/constants";
import { getHabitMeta, setPendingCategory, reconcilePendingCategory } from "@/lib/habitMeta";

// Converts raw viem/contract errors into human-friendly one-liners
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
  if (/not connected|no account/i.test(msg))
    return 'Please sign in first.';
  return 'Something went wrong. Please try again.';
}

const HABIT_TYPES = [
  { value: HabitType.FOCUS,     label: "Focus",     icon: "🧠" },
  { value: HabitType.FITNESS,   label: "Fitness",   icon: "💪" },
  { value: HabitType.READING,   label: "Reading",   icon: "📖" },
  { value: HabitType.HYDRATION, label: "Hydration", icon: "💧" },
  { value: HabitType.SLEEP,     label: "Sleep",     icon: "😴" },
  { value: HabitType.CUSTOM,    label: "Custom",    icon: "◆"  },
];

// Map category id → HabitType for pre-fill
const CATEGORY_TO_TYPE: Record<string, number> = {
  focus: HabitType.FOCUS,
  fitness: HabitType.FITNESS,
  wellness: HabitType.CUSTOM,
  learning: HabitType.READING,
  nutrition: HabitType.HYDRATION,
  social: HabitType.CUSTOM,
  creative: HabitType.CUSTOM,
  custom: HabitType.CUSTOM,
};

export default function HabitsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  const { habits, refetch } = useHabits();
  const { createHabit, hash: createHash, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateHabit();
  const { deactivateHabit, hash: deactivateHash, isSuccess: deactivateSuccess } = useDeactivateHabit();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [habitType, setHabitType] = useState<number>(HabitType.FOCUS);
  const [categoryId, setCategoryId] = useState<string>("focus");
  const [targetMinutes, setTargetMinutes] = useState(0);
  const [frequency, setFrequency] = useState<number>(Frequency.DAILY);
  const [formError, setFormError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const habitMeta = address ? getHabitMeta(address) : {};

  useEffect(() => {
    if (createSuccess) {
      if (address) {
        reconcilePendingCategory(address, habits as unknown as Array<{ id: bigint; name: string; createdAt: bigint }>);
      }
      refetch();
      setShowForm(false);
      setName("");
      setHabitType(HabitType.FOCUS);
      setCategoryId("focus");
      setTargetMinutes(0);
      setFormError("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    }
  }, [createSuccess, address, habits, refetch]);

  useEffect(() => {
    if (deactivateSuccess) refetch();
  }, [deactivateSuccess, refetch]);

  const handleCreate = () => {
    if (!name.trim()) { setFormError("Enter a habit name"); return; }
    if (!address) { setFormError("Sign in first"); return; }
    if (!process.env.NEXT_PUBLIC_PROOV_CORE_ADDRESS) {
      setFormError("App not configured — contract address missing");
      return;
    }
    setFormError("");
    if (address) setPendingCategory(address, name.trim(), categoryId);
    createHabit(name.trim(), habitType, targetMinutes * 60, frequency);
  };

  // Pre-fill form from a suggested habit
  const prefillFromSuggestion = (s: typeof SUGGESTED_HABITS[number]) => {
    setName(s.name);
    setCategoryId(s.category);
    setHabitType(CATEGORY_TO_TYPE[s.category] ?? HabitType.CUSTOM);
    setTargetMinutes(s.duration);
    setShowForm(true);
  };

  const activeHabits = habits.filter((h) => h.active);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen app-bg pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-[0.05] rounded-full"
        style={{ background: "radial-gradient(ellipse, var(--accent), transparent)" }} />

      {/* Header */}
      <div className="glass border-b border-white/[0.06] px-4 py-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center
              text-white/50 hover:text-white transition-colors text-sm">←</Link>
            <p className="text-white font-bold">Habits</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setFormError(""); }}
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
          >
            + New
          </button>
        </div>
      </div>

      {/* Success flash */}
      <AnimatePresence>
        {savedFlash && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-lg flex items-center gap-2 text-sm font-medium"
            style={{ background: 'var(--success)', color: '#fff' }}
          >
            <span>✓</span><span>Habit saved!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="glass rounded-3xl p-5 space-y-4" style={{ borderColor: 'var(--accent-border)' }}
            >
              <p className="text-white font-bold">New Habit</p>

              <input
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setFormError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                placeholder="Habit name..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white
                  placeholder-white/20 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />

              {/* Category selector */}
              <div>
                <p className="text-white/40 text-xs font-medium mb-2">Category</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {HABIT_CATEGORIES.map((cat) => (
                    <button key={cat.id}
                      onClick={() => {
                        setCategoryId(cat.id);
                        setHabitType(CATEGORY_TO_TYPE[cat.id] ?? HabitType.CUSTOM);
                      }}
                      className={`rounded-xl py-2.5 flex flex-col items-center gap-1 transition-all duration-150 border
                        ${categoryId === cat.id
                          ? "scale-[1.04] text-white"
                          : "bg-white/5 border-white/8 text-white/50 hover:text-white hover:bg-white/8"
                        }`}
                      style={categoryId === cat.id ? { backgroundColor: cat.color + "33", borderColor: cat.color + "66" } : undefined}
                    >
                      <span className="text-base">{cat.emoji}</span>
                      <span className="text-[9px] leading-tight text-center px-0.5">{cat.label.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Habit type */}
              <div>
                <p className="text-white/40 text-xs font-medium mb-2">Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {HABIT_TYPES.map((t) => (
                    <button key={t.value} onClick={() => setHabitType(t.value)}
                      className={`rounded-xl py-3 flex flex-col items-center gap-1 text-sm transition-all duration-150 ${habitType === t.value ? "scale-[1.02]" : ""}`}
                      style={habitType === t.value ? { background: 'var(--accent)', border: '1px solid var(--accent-border)', color: 'var(--btn-primary-text)' } : { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: 'var(--text3)' }}>
                      <span>{t.icon}</span>
                      <span className="text-[10px]">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <p className="text-white/40 text-xs font-medium mb-2">
                  Duration: <span className="text-white/70">{targetMinutes === 0 ? "No timer" : `${targetMinutes} min`}</span>
                </p>
                <input type="range" min={0} max={120} step={5} value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                  className="w-full accent-violet-500" />
              </div>

              {/* Frequency */}
              <div className="flex gap-2">
                {[{ value: Frequency.DAILY, label: "Daily" }, { value: Frequency.WEEKLY, label: "Weekly" }].map((f) => (
                  <button key={f.value} onClick={() => setFrequency(f.value)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                    style={frequency === f.value ? { background: 'var(--accent)', color: 'var(--btn-primary-text)' } : { background: 'rgba(255,255,255,.05)', color: 'var(--text3)' }}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Errors */}
              {(formError || createError) && (
                <p className="text-red-400 text-xs">
                  {formError || humanizeError(createError)}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowForm(false); setFormError(""); }}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/8 text-sm transition-all">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={isCreating || !name.trim()}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-40 transition-all"
                  style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
                  {isCreating ? "Saving…" : "Create Habit"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggested habits */}
        {!showForm && (
          <div>
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-3">Suggestions</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {SUGGESTED_HABITS.map((s) => {
                const cat = getCategoryById(s.category);
                return (
                  <motion.button
                    key={s.name}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => prefillFromSuggestion(s)}
                    className="flex-shrink-0 glass rounded-2xl p-3 text-left w-36 space-y-1 border border-white/5 hover:border-violet-500/30 transition-all"
                  >
                    <span className="text-xl block">{s.emoji}</span>
                    <p className="text-white text-xs font-semibold leading-snug">{s.name}</p>
                    <p className="text-white/30 text-[10px] leading-relaxed">{s.description}</p>
                    <p className="text-violet-400 text-[10px] font-medium">Customise →</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active habits */}
        {activeHabits.length > 0 && (
          <div>
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-3">
              Active · {activeHabits.length}
            </p>
            <div className="space-y-2">
              {activeHabits.map((habit, i) => {
                const meta = habitMeta[habit.id.toString()];
                const cat = meta ? getCategoryById(meta.categoryId) : null;
                return (
                  <motion.div
                    key={habit.id.toString()}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="glass glass-hover rounded-2xl p-4 flex items-center gap-4 group"
                    style={cat ? { borderLeft: `3px solid ${cat.color}50` } : undefined}
                  >
                    <span className="text-xl flex-shrink-0">
                      {cat ? cat.emoji : (HABIT_TYPES.find(t => t.value === Number(habit.habitType))?.icon ?? "◆")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{habit.name}</p>
                      <p className="text-white/30 text-xs">
                        {HabitTypeLabel[Number(habit.habitType)]}
                        {Number(habit.targetDuration) > 0
                          ? ` · ${Math.round(Number(habit.targetDuration) / 60)} min` : ""}
                        {" · "}{Number(habit.frequency) === 0 ? "Daily" : "Weekly"}
                      </p>
                    </div>
                    <button
                      onClick={() => deactivateHabit(Number(habit.id))}
                      className="text-white/20 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TxToast hash={createHash}    pendingText="Saving habit…"  successText="Habit saved! ✓" />
      <TxToast hash={deactivateHash} pendingText="Removing…"     successText="Removed." />
    </div>
  );
}
