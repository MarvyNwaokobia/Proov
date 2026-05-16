"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useHabits, useCreateHabit, useDeactivateHabit } from "@/hooks/useHabits";
import { TxToast } from "@/components/shared/TxToast";
import { HabitType, HabitTypeLabel, Frequency, STARTER_HABITS } from "@/lib/constants";

const HABIT_TYPES = [
  { value: HabitType.FOCUS,     label: "Focus",     icon: "🧠" },
  { value: HabitType.FITNESS,   label: "Fitness",   icon: "💪" },
  { value: HabitType.READING,   label: "Reading",   icon: "📖" },
  { value: HabitType.HYDRATION, label: "Hydration", icon: "💧" },
  { value: HabitType.SLEEP,     label: "Sleep",     icon: "😴" },
  { value: HabitType.CUSTOM,    label: "Custom",    icon: "◆"  },
];

export default function HabitsPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);

  const { habits, refetch } = useHabits();
  const { createHabit, hash: createHash, isPending: isCreating, isSuccess: createSuccess } = useCreateHabit();
  const { deactivateHabit, hash: deactivateHash, isSuccess: deactivateSuccess } = useDeactivateHabit();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [habitType, setHabitType] = useState<number>(HabitType.FOCUS);
  const [targetMinutes, setTargetMinutes] = useState(0);
  const [frequency, setFrequency] = useState<number>(Frequency.DAILY);

  useEffect(() => {
    if (createSuccess || deactivateSuccess) {
      refetch();
      setShowForm(false);
      setName("");
      setHabitType(HabitType.FOCUS);
      setTargetMinutes(0);
    }
  }, [createSuccess, deactivateSuccess, refetch]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createHabit(name.trim(), habitType, targetMinutes * 60, frequency);
  };

  const activeHabits = habits.filter((h) => h.active);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-[#050508] pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-[0.05] rounded-full"
        style={{ background: "radial-gradient(ellipse, #7c3aed, transparent)" }} />

      {/* Header */}
      <div className="glass border-b border-white/[0.06] px-4 py-4 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-8 h-8 glass rounded-xl flex items-center justify-center
              text-white/50 hover:text-white transition-colors text-sm">←</Link>
            <p className="text-white font-bold">Habits</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="glass rounded-3xl p-5 space-y-4 border border-violet-500/20"
            >
              <p className="text-white font-bold">New Habit</p>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Morning Run"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white
                  placeholder-white/20 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />

              <div>
                <p className="text-white/40 text-xs font-medium mb-2">Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {HABIT_TYPES.map((t) => (
                    <button key={t.value} onClick={() => setHabitType(t.value)}
                      className={`rounded-xl py-3 flex flex-col items-center gap-1 text-sm transition-all duration-150
                        ${habitType === t.value
                          ? "bg-violet-600 border border-violet-400/50 text-white scale-[1.02]"
                          : "bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/8"}`}>
                      <span>{t.icon}</span>
                      <span className="text-[10px]">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-white/40 text-xs font-medium mb-2">
                  Target duration: <span className="text-white/70">{targetMinutes} min</span>
                  {targetMinutes === 0 && " (no timer)"}
                </p>
                <input type="range" min={0} max={120} step={5} value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                  className="w-full accent-violet-500" />
              </div>

              <div className="flex gap-2">
                {[{ value: Frequency.DAILY, label: "Daily" }, { value: Frequency.WEEKLY, label: "Weekly" }].map((f) => (
                  <button key={f.value} onClick={() => setFrequency(f.value)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                      ${frequency === f.value
                        ? "bg-violet-600 text-white"
                        : "bg-white/5 text-white/40 hover:text-white hover:bg-white/8"}`}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/8 text-sm transition-all">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={isCreating || !name.trim()}
                  className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm
                    disabled:opacity-40 transition-all">
                  {isCreating ? "Saving…" : "Create Habit"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Starter habits (empty state) */}
        {activeHabits.length === 0 && !showForm && (
          <div>
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-3">
              Recommended to start
            </p>
            <div className="space-y-2">
              {STARTER_HABITS.map((s, i) => (
                <motion.button
                  key={s.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => createHabit(s.name, s.habitType, s.targetDuration, s.frequency)}
                  disabled={isCreating}
                  className="w-full glass glass-hover rounded-2xl p-4 flex items-center gap-4 text-left disabled:opacity-40"
                >
                  <span className="text-xl">{HABIT_TYPES.find(t => t.value === s.habitType)?.icon}</span>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{s.name}</p>
                    <p className="text-white/30 text-xs">
                      {HabitTypeLabel[s.habitType]}
                      {s.targetDuration > 0 ? ` · ${s.targetDuration / 60} min` : " · No timer"}
                    </p>
                  </div>
                  <span className="text-violet-400 text-sm">+</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Active habits list */}
        {activeHabits.length > 0 && (
          <div>
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-3">
              Active · {activeHabits.length}
            </p>
            <div className="space-y-2">
              {activeHabits.map((habit, i) => (
                <motion.div
                  key={habit.id.toString()}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass glass-hover rounded-2xl p-4 flex items-center gap-4 group"
                >
                  <span className="text-xl flex-shrink-0">
                    {HABIT_TYPES.find(t => t.value === Number(habit.habitType))?.icon ?? "◆"}
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
              ))}
            </div>
          </div>
        )}
      </div>

      <TxToast hash={createHash} pendingText="Creating habit…" successText="Habit created!" />
      <TxToast hash={deactivateHash} pendingText="Removing…" successText="Habit removed." />
    </div>
  );
}
