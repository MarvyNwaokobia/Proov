"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconBrain, IconRun, IconYoga, IconBook, IconSalad, IconPalette,
  IconArrowLeft, type Icon as TablerIcon,
} from '@tabler/icons-react';
import {
  getUserHabits, saveHabit, deactivateHabit as supabaseDeactivate,
  getTodayCompletions, saveHabitCompletion, getAllHabitStreaks, type Habit,
} from "@/lib/supabase";
import { useProovTx } from "@/hooks/useProovTx";
import { HABIT_CATEGORIES, getCategoryById, Frequency } from "@/lib/constants";
import { HABIT_TEMPLATES, ARCHETYPE_LABELS, type Archetype } from "@/lib/habitTemplates";

// ── Suggestions data ─────────────────────────────────────────────────────────

type SuggestionItem = { name: string; emoji: string; type: 'checkbox' | 'timed'; duration?: number };
const SUGGESTIONS: Record<string, SuggestionItem[]> = {
  Focus: [
    { name: 'Deep Work',        emoji: '🧠', type: 'timed',    duration: 90 },
    { name: 'Read',             emoji: '📚', type: 'checkbox' },
    { name: 'No Phone Morning', emoji: '📵', type: 'checkbox' },
    { name: 'Journaling',       emoji: '✍️', type: 'timed',    duration: 15 },
    { name: 'Meditation',       emoji: '🧘', type: 'timed',    duration: 10 },
    { name: 'Plan Your Day',    emoji: '📋', type: 'checkbox' },
  ],
  Fitness: [
    { name: 'Morning Run',    emoji: '🏃', type: 'timed',    duration: 30 },
    { name: 'Workout',        emoji: '💪', type: 'timed',    duration: 45 },
    { name: 'Walk 10k Steps', emoji: '👟', type: 'checkbox' },
    { name: 'Stretch',        emoji: '🤸', type: 'timed',    duration: 10 },
    { name: 'Swim',           emoji: '🏊', type: 'timed',    duration: 30 },
    { name: 'Cycling',        emoji: '🚴', type: 'timed',    duration: 45 },
  ],
  Wellness: [
    { name: 'Drink 2L Water', emoji: '💧', type: 'checkbox' },
    { name: 'Sleep by 10pm',  emoji: '😴', type: 'checkbox' },
    { name: 'No Sugar',       emoji: '🚫', type: 'checkbox' },
    { name: 'Cold Shower',    emoji: '🚿', type: 'checkbox' },
    { name: 'Breathwork',     emoji: '🫁', type: 'timed',    duration: 10 },
    { name: 'Gratitude',      emoji: '🙏', type: 'checkbox' },
  ],
  Learning: [
    { name: 'Read a Book',       emoji: '📖', type: 'timed', duration: 30 },
    { name: 'Learn a Language',  emoji: '🗣️', type: 'timed', duration: 20 },
    { name: 'Watch a Lecture',   emoji: '🎓', type: 'timed', duration: 30 },
    { name: 'Practice Coding',   emoji: '💻', type: 'timed', duration: 60 },
    { name: 'Listen to Podcast', emoji: '🎧', type: 'timed', duration: 30 },
    { name: 'Take Notes',        emoji: '📝', type: 'checkbox' },
  ],
  Nutrition: [
    { name: 'Eat Vegetables',     emoji: '🥦', type: 'checkbox' },
    { name: 'No Junk Food',       emoji: '🚫', type: 'checkbox' },
    { name: 'Cook at Home',       emoji: '🍳', type: 'checkbox' },
    { name: 'Intermittent Fast',  emoji: '⏰', type: 'checkbox' },
    { name: 'No Alcohol',         emoji: '🚫', type: 'checkbox' },
    { name: 'Meal Prep',          emoji: '🥗', type: 'timed',    duration: 60 },
  ],
};
const SUGGESTION_CATS = ['Focus', 'Fitness', 'Wellness', 'Learning', 'Nutrition'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const STOPS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];
function snapToStop(val: number) { return STOPS.reduce((p, c) => Math.abs(c - val) < Math.abs(p - val) ? c : p); }
function fmtDur(m: number) { return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ""}`; }

type FilterEntry = { value: string; label: string; Icon: TablerIcon | null };
const CATEGORY_FILTERS: FilterEntry[] = [
  { value: "All",          label: "All",       Icon: null        },
  { value: "focus",        label: "Focus",     Icon: IconBrain   },
  { value: "fitness",      label: "Fitness",   Icon: IconRun     },
  { value: "wellness",     label: "Wellness",  Icon: IconYoga    },
  { value: "learning",     label: "Learning",  Icon: IconBook    },
  { value: "nutrition",    label: "Nutrition", Icon: IconSalad   },
  { value: "creative",     label: "Creative",  Icon: IconPalette },
];

// ── DurationPicker ────────────────────────────────────────────────────────────

function DurationPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [mode, setMode] = useState<"slider" | "manual">("slider");
  const [live, setLive] = useState(value);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["slider", "manual"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: "5px 12px", borderRadius: 14, fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${mode === m ? "var(--accent)" : "var(--border)"}`, background: mode === m ? "var(--accent-bg)" : "transparent", color: mode === m ? "var(--accent-text)" : "var(--text3)" }}>
            {m === "slider" ? "⟷ Slider" : "✎ Manual"}
          </button>
        ))}
      </div>
      {mode === "slider" ? (
        <div>
          <p style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -1, marginBottom: 10 }}>{fmtDur(live)}</p>
          <input type="range" min={1} max={240} value={live}
            onInput={(e) => setLive(parseInt((e.target as HTMLInputElement).value))}
            onChange={(e) => { const s = snapToStop(parseInt(e.target.value)); onChange(s); setLive(s); }}
            className="duration-slider" style={{ width: "100%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {STOPS.map(s => (
              <button key={s} onClick={() => { onChange(s); setLive(s); }} style={{ fontSize: 9, padding: "2px 1px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: value === s ? "var(--accent-text)" : "var(--text3)", fontWeight: value === s ? 700 : 400 }}>
                {s < 60 ? `${s}m` : `${s / 60}h`}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 6 }}>
            <button onClick={() => onChange(Math.max(1, value - 5))} style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", fontSize: 18, cursor: "pointer", fontFamily: "inherit" }}>−</button>
            <input type="number" value={value} min={1} max={480} onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) onChange(Math.min(480, Math.max(1, n))); }} style={{ width: 80, textAlign: "center", fontSize: 24, fontWeight: 800 }} />
            <span style={{ fontSize: 13, color: "var(--text2)" }}>min</span>
            <button onClick={() => onChange(Math.min(480, value + 5))} style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", fontSize: 18, cursor: "pointer", fontFamily: "inherit" }}>+</button>
          </div>
          <p style={{ fontSize: 11, color: "var(--text3)" }}>{fmtDur(value)}</p>
        </div>
      )}
    </div>
  );
}

// ── CreateForm ─────────────────────────────────────────────────────────────────

type SaveData = {
  name: string; catId: string; emoji: string;
  hasTimer: boolean; duration: number;
  frequency: number;
  privacy: 'private' | 'public';
  viewers: string[];
};

type Step = 1 | 2 | 3 | 4 | 5;

function CreateForm({ onSave, isSaving, onCancel, prefill }: {
  onSave: (data: SaveData) => Promise<void>;
  isSaving: boolean;
  onCancel: () => void;
  prefill?: { name: string; categoryId: string; duration: number };
}) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(prefill?.name ?? "");
  const [catId, setCatId] = useState(prefill?.categoryId ?? "custom");
  const [hasTimer, setHasTimer] = useState(true);
  const [duration, setDuration] = useState(prefill?.duration ?? 25);
  const [frequency, setFrequency] = useState<number>(Frequency.DAILY);
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');
  const [viewers, setViewers] = useState<string[]>([]);
  const [viewerInput, setViewerInput] = useState("");
  const [formError, setFormError] = useState("");

  const cat = getCategoryById(catId);
  const steps = ["Name", "Type", "Schedule", "Privacy", "Confirm"];

  const next = () => {
    if (step === 1 && !name.trim()) { setFormError("Enter a habit name"); return; }
    setFormError("");
    if (step === 2 && !hasTimer) { setStep(3); return; }
    setStep(s => Math.min(5, s + 1) as Step);
  };
  const back = () => setStep(s => Math.max(1, s - 1) as Step);

  const doCreate = async () => {
    if (!name.trim()) { setFormError("Enter a habit name"); return; }
    await onSave({
      name: name.trim(),
      catId,
      emoji: cat?.emoji || '⭐',
      hasTimer,
      duration,
      frequency,
      privacy,
      viewers,
    });
  };

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--accent-border)", borderRadius: 20, padding: "1.25rem" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: "1.25rem" }}>
        {steps.map((_, i) => (<div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: step > i ? "var(--accent)" : "var(--border2)", transition: "background .2s" }} />))}
      </div>

      {step === 1 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Name your habit</p>
          <input autoFocus value={name} onChange={e => { setName(e.target.value); setFormError(""); }} onKeyDown={e => e.key === "Enter" && next()} placeholder="e.g. Morning Run, Deep Work..." style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>Category</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {HABIT_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCatId(c.id)} style={{ borderRadius: 12, padding: "10px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 10, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${catId === c.id ? c.color + "80" : "var(--border)"}`, background: catId === c.id ? c.color + "18" : "transparent", color: catId === c.id ? c.color : "var(--text3)" }}>
                <span style={{ fontSize: 16 }}>{c.emoji}</span><span>{c.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>How do you complete it?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: hasTimer ? 18 : 0 }}>
            {[{ id: true, emoji: "⏱", title: "Timed habit", desc: "Set a duration." }, { id: false, emoji: "✅", title: "Tap to complete", desc: "No timer needed." }].map(opt => (
              <button key={String(opt.id)} onClick={() => setHasTimer(opt.id)} style={{ padding: "1rem .875rem", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "center", border: `1px solid ${hasTimer === opt.id ? "var(--accent)" : "var(--border)"}`, background: hasTimer === opt.id ? "var(--accent-bg)" : "transparent" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{opt.emoji}</div>
                <p style={{ fontSize: 11, fontWeight: 600, color: hasTimer === opt.id ? "var(--accent-text)" : "var(--text)", marginBottom: 3 }}>{opt.title}</p>
                <p style={{ fontSize: 9, color: "var(--text3)" }}>{opt.desc}</p>
              </button>
            ))}
          </div>
          {hasTimer && <div style={{ marginTop: 14 }}><DurationPicker value={duration} onChange={setDuration} /></div>}
        </div>
      )}

      {step === 3 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>How often?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[{ val: Frequency.DAILY, label: "Daily", emoji: "📅", desc: "Every day" }, { val: Frequency.WEEKLY, label: "Weekly", emoji: "📆", desc: "Once a week" }].map(f => (
              <button key={f.val} onClick={() => setFrequency(f.val)} style={{ padding: "1rem", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "center", border: `1px solid ${frequency === f.val ? "var(--accent)" : "var(--border)"}`, background: frequency === f.val ? "var(--accent-bg)" : "transparent" }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{f.emoji}</div>
                <p style={{ fontSize: 13, fontWeight: 600, color: frequency === f.val ? "var(--accent-text)" : "var(--text)" }}>{f.label}</p>
                <p style={{ fontSize: 10, color: "var(--text3)" }}>{f.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Who can see this habit?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {[{ key: "private" as const, emoji: "🔒", label: "Private", desc: "Only you." }, { key: "public" as const, emoji: "👥", label: "Circle", desc: "All circle members see your progress." }].map(opt => (
              <button key={opt.key} onClick={() => setPrivacy(opt.key)} style={{ padding: "11px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12, textAlign: "left", border: `1px solid ${privacy === opt.key ? "var(--accent)" : "var(--border)"}`, background: privacy === opt.key ? "var(--accent-bg)" : "transparent" }}>
                <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: privacy === opt.key ? "var(--accent-text)" : "var(--text)", margin: 0 }}>{opt.label}</p>
                  <p style={{ fontSize: 10, color: "var(--text3)", margin: 0 }}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
          {privacy === 'public' && (
            <div>
              <input placeholder="Add by username..." value={viewerInput} onChange={e => setViewerInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && viewerInput.trim()) { const u = viewerInput.replace(/^@/, "").trim(); if (!viewers.includes(u)) setViewers(v => [...v, u]); setViewerInput(""); } }}
                style={{ marginBottom: 8 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {viewers.map(u => (
                  <span key={u} style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "var(--accent-text)", display: "flex", alignItems: "center", gap: 6 }}>
                    @{u}<button onClick={() => setViewers(v => v.filter(x => x !== u))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 14, fontFamily: "inherit" }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Confirm</p>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 24 }}>{cat?.emoji ?? "◆"}</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{name}</p>
                <p style={{ fontSize: 11, color: "var(--text3)", margin: 0 }}>{cat?.label}</p>
              </div>
            </div>
            {[
              ["Type", hasTimer ? `⏱ ${fmtDur(duration)}` : "✅ Tap to complete"],
              ["Schedule", frequency === Frequency.DAILY ? "📅 Daily" : "📆 Weekly"],
              ["Visible to", privacy === 'private' ? "🔒 Private" : "👥 Circle"],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 6 }}>
                <span style={{ color: "var(--text3)" }}>{label}</span>
                <span style={{ color: "var(--text)", fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
          {formError && <p style={{ color: "#f43f5e", fontSize: 11, marginBottom: 8 }}>{formError}</p>}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={step === 1 ? onCancel : back} style={{ flex: 1, padding: 11, borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          {step === 1 ? "Cancel" : "← Back"}
        </button>
        {step < 5 ? (
          <button onClick={next} style={{ flex: 2, padding: 11, borderRadius: 12, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Next →</button>
        ) : (
          <button onClick={doCreate} disabled={isSaving} style={{ flex: 2, padding: 11, borderRadius: 12, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 600, cursor: isSaving ? "default" : "pointer", fontFamily: "inherit", opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? "Saving…" : "Create habit"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── TemplatesTab ──────────────────────────────────────────────────────────────

function TemplatesTab({ onUseTemplate }: { onUseTemplate: (t: typeof HABIT_TEMPLATES[0]) => void }) {
  const archetypes: Archetype[] = ["builder", "achiever", "creative", "nurturer"];
  const [selected, setSelected] = useState<typeof HABIT_TEMPLATES[0] | null>(null);

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}>
          <IconArrowLeft size={16} stroke={2.5} /> Back
        </button>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 16, padding: "1.25rem", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 28 }}>{selected.emoji}</span>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{selected.name}</p>
              <p style={{ fontSize: 10, color: "var(--accent-text)", margin: 0 }}>{ARCHETYPE_LABELS[selected.archetype]}</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10, lineHeight: 1.6 }}>{selected.description}</p>
          <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 12 }}>{selected.audience}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {selected.habits.map(h => (
              <div key={h.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <span style={{ fontSize: 16 }}>{h.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", margin: 0 }}>{h.name}</p>
                  <p style={{ fontSize: 10, color: "var(--text3)", margin: 0 }}>{h.duration > 0 ? fmtDur(h.duration) : "Tap to complete"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => onUseTemplate(selected)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Use this template
        </button>
      </div>
    );
  }

  return (
    <div>
      {archetypes.map(arch => (
        <div key={arch} style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 10 }}>{ARCHETYPE_LABELS[arch]}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {HABIT_TEMPLATES.filter(t => t.archetype === arch).map(tpl => (
              <button key={tpl.id} onClick={() => setSelected(tpl)} style={{ padding: ".875rem", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <span style={{ fontSize: 20, display: "block", marginBottom: 6 }}>{tpl.emoji}</span>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", margin: 0, marginBottom: 3 }}>{tpl.name}</p>
                <p style={{ fontSize: 9, color: "var(--text3)", lineHeight: 1.4, margin: 0 }}>{tpl.description}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HabitsPage() {
  const router = useRouter();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedToday, setCompletedToday] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const [activeTab, setActiveTab] = useState<"my" | "all" | "templates">("my");
  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; categoryId: string; duration: number } | undefined>();
  const [catFilter, setCatFilter] = useState("All");
  const [suggestionCategory, setSuggestionCategory] = useState('Focus');
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});
  const proovTx = useProovTx();

  // ── Load from Supabase ──────────────────────────────────────────────────────
  useEffect(() => {
    const address = localStorage.getItem('proov_address') || '';
    if (!address) { setLoading(false); return; }
    Promise.all([getUserHabits(address), getTodayCompletions(address)])
      .then(([userHabits, todayDone]) => {
        setHabits(userHabits);
        setCompletedToday(todayDone);
        localStorage.setItem('proov_habits_cache', JSON.stringify(userHabits));
        setLoading(false);
      })
      .catch(() => {
        const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
        setHabits(cached);
        setLoading(false);
      });
  }, []);

  // Load per-habit streaks whenever the habits list changes
  useEffect(() => {
    const address = localStorage.getItem('proov_address') || '';
    if (!address || habits.length === 0) return;
    getAllHabitStreaks(habits.map(h => h.id), address).then(setHabitStreaks).catch(() => {});
  }, [habits]);

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  // ── Create habit ────────────────────────────────────────────────────────────
  const handleSave = async (data: SaveData) => {
    setIsSaving(true);
    const address = localStorage.getItem('proov_address') || '';
    const saved = await saveHabit({
      user_address: address.toLowerCase(),
      name: data.name,
      emoji: data.emoji,
      category: data.catId,
      type: data.hasTimer ? 'timed' : 'checkbox',
      duration_minutes: data.hasTimer ? data.duration : 0,
      schedule: data.frequency === Frequency.WEEKLY ? 'weekly' : 'daily',
      visibility: data.privacy,
      visible_to: data.viewers,
      active: true,
    });
    if (saved) {
      proovTx.createHabit(data.name, data.catId, data.hasTimer, data.hasTimer ? data.duration : 0);
      setHabits(prev => [...prev, saved]);
      const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
      localStorage.setItem('proov_habits_cache', JSON.stringify([...cached, saved]));
      showToast('✓ Habit saved!');
      setShowForm(false);
      setPrefill(undefined);
    }
    setIsSaving(false);
  };

  // ── Remove habit ────────────────────────────────────────────────────────────
  const handleRemove = async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    await supabaseDeactivate(habitId);
    proovTx.removeHabit((habit as any)?.on_chain_id || 0);
    setHabits(prev => prev.filter(h => h.id !== habitId));
    const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
    localStorage.setItem('proov_habits_cache', JSON.stringify(cached.filter((h: any) => h.id !== habitId)));
  };

  // ── Use template ────────────────────────────────────────────────────────────
  const handleUseTemplate = async (tpl: typeof HABIT_TEMPLATES[0]) => {
    setIsSaving(true);
    const address = localStorage.getItem('proov_address') || '';
    const results = await Promise.all(tpl.habits.map(h => saveHabit({
      user_address: address.toLowerCase(),
      name: h.name,
      emoji: h.emoji,
      category: h.category,
      type: h.duration > 0 ? 'timed' : 'checkbox',
      duration_minutes: h.duration,
      schedule: 'daily',
      visibility: 'private',
      visible_to: [],
      active: true,
    })));
    const saved = results.filter(Boolean) as Habit[];
    if (saved.length) {
      setHabits(prev => [...prev, ...saved]);
      const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
      localStorage.setItem('proov_habits_cache', JSON.stringify([...cached, ...saved]));
      showToast(`✓ ${saved.length} habits added`);
      setActiveTab('my');
    }
    setIsSaving(false);
  };

  // ── Add from suggestion ─────────────────────────────────────────────────────
  const handleAddSuggestion = async (s: SuggestionItem) => {
    setIsSaving(true);
    const address = localStorage.getItem('proov_address') || '';
    const saved = await saveHabit({
      user_address: address.toLowerCase(),
      name: s.name,
      emoji: s.emoji,
      category: suggestionCategory.toLowerCase(),
      type: s.type,
      duration_minutes: s.duration || 0,
      schedule: 'daily',
      visibility: 'private',
      visible_to: [],
      active: true,
    });
    if (saved) {
      proovTx.createHabit(s.name, suggestionCategory.toLowerCase(), s.type === 'timed', s.duration || 0);
      setHabits(prev => [...prev, saved]);
      const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
      localStorage.setItem('proov_habits_cache', JSON.stringify([...cached, saved]));
      showToast(`${s.emoji} ${s.name} added`);
    }
    setIsSaving(false);
  };

  // ── Toggle completion ───────────────────────────────────────────────────────
  const handleToggleCompletion = async (habitId: string) => {
    if (completedToday.includes(habitId)) return;
    setCompletedToday(prev => [...prev, habitId]);
    showToast('Saved ✓');
    const address = localStorage.getItem('proov_address') || '';
    const streak = parseInt(localStorage.getItem('proov_streak_count') || '0');
    await saveHabitCompletion(habitId, address, streak).catch(() => {});
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filteredHabits = catFilter === "All"
    ? habits
    : habits.filter(h => h.category === catFilter);

  const existingNames = habits.map(h => h.name.toLowerCase());
  const filteredSuggestions = SUGGESTIONS[suggestionCategory].filter(
    s => !existingNames.includes(s.name.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div className="top-bar" />

      {toastVisible && (
        <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 50, background: "var(--success, #059669)", color: "#fff", padding: "10px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "var(--nav-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)", padding: "1rem 1.25rem", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 16 }}>Habits</p>
          <button onClick={() => { setPrefill(undefined); setShowForm(true); setActiveTab("all"); }} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            + New
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "1rem 1.25rem 3rem" }}>

        {/* Create form */}
        {showForm && (
          <div style={{ marginBottom: 16 }}>
            <CreateForm
              onSave={handleSave}
              isSaving={isSaving}
              onCancel={() => { setShowForm(false); setPrefill(undefined); }}
              prefill={prefill}
            />
          </div>
        )}

        {/* Tab switcher */}
        {!showForm && (
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 12, padding: 4, gap: 3, marginBottom: 14 }}>
            {([['my', 'My habits'], ['all', 'All habits'], ['templates', 'Templates']] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, textAlign: 'center', padding: '7px 0',
                borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12,
                background: activeTab === tab ? 'var(--card-bg)' : 'transparent',
                color: activeTab === tab ? 'var(--text)' : 'var(--text3)',
                fontWeight: activeTab === tab ? 700 : 500,
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                transition: 'all 0.2s',
              }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* All habits / My habits tab */}
        {(activeTab === "my" || activeTab === "all") && !showForm && (
          <>
            {/* Category filter */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
              {CATEGORY_FILTERS.map(({ value, label, Icon }) => (
                <button key={value} onClick={() => setCatFilter(value)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 14, fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${catFilter === value ? "var(--accent)" : "var(--border)"}`, background: catFilter === value ? "var(--accent-bg)" : "transparent", color: catFilter === value ? "var(--accent-text)" : "var(--text3)", display: "flex", alignItems: "center", gap: 4 }}>
                  {Icon && <Icon size={14} stroke={1.8} />}{label}
                </button>
              ))}
            </div>

            {/* Loading */}
            {loading && (
              <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "2rem 0" }}>Loading habits…</p>
            )}

            {/* Habits grid */}
            {!loading && filteredHabits.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>
                  Active · {filteredHabits.length}
                </p>
                <div style={{ marginBottom: "1rem" }}>
                  {filteredHabits.map(habit => {
                    const isDone = completedToday.includes(habit.id);
                    return (
                      <div
                        key={habit.id}
                        onClick={() => router.push(`/habits/${habit.id}`)}
                        style={{
                          background: 'var(--card-bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 14, padding: '12px 14px',
                          marginBottom: 8,
                          display: 'flex', gap: 12, alignItems: 'center',
                          cursor: 'pointer', transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                        <span style={{ fontSize: 24 }}>{habit.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{habit.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontWeight: 600 }}>
                            {habit.type === 'timed' ? `${habit.duration_minutes} min` : 'Tap'} · {habit.schedule} · {habit.category}
                          </div>
                          <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginTop: 3 }}>
                            🔥 {isDone ? '✓ Done today' : `${habitStreaks[habit.id] || 0} day streak`}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleRemove(habit.id); }}
                          style={{
                            padding: '6px 12px', borderRadius: 9,
                            border: '2px solid #f43f5e',
                            background: 'transparent', color: '#f43f5e',
                            fontSize: 12, fontWeight: 800,
                            cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = '#f43f5e';
                            (e.currentTarget as HTMLElement).style.color = '#fff';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = '#f43f5e';
                          }}>
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && habits.length === 0 && (
              <div style={{ textAlign: "center", padding: "2rem 0 1rem", color: "var(--text3)", fontSize: 13 }}>
                <p style={{ marginBottom: 8, fontWeight: 500, color: "var(--text)" }}>No habits yet</p>
                <p style={{ fontSize: 12, marginBottom: 0 }}>Add one from suggestions below or tap + New</p>
              </div>
            )}

            {/* Suggestions — always visible */}
            <div style={{ marginTop: habits.length > 0 ? '1.5rem' : '0.5rem' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '0.875rem' }}>
                Add from suggestions
              </div>

              {/* Category pills */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: '0.875rem', paddingBottom: 4 }}>
                {SUGGESTION_CATS.map(cat => (
                  <button key={cat} onClick={() => setSuggestionCategory(cat)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', borderColor: suggestionCategory === cat ? 'var(--accent)' : 'var(--border)', background: suggestionCategory === cat ? 'var(--accent-bg)' : 'transparent', color: suggestionCategory === cat ? 'var(--accent-text)' : 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s ease' }}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Suggestion cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {filteredSuggestions.map(s => (
                  <button key={s.name} onClick={() => handleAddSuggestion(s)} disabled={isSaving}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-bg)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--card-bg)'; }}>
                    <span style={{ fontSize: 20 }}>{s.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{s.type === 'timed' ? `${s.duration}m · Timed` : 'Checkbox'}</div>
                    </div>
                    <span style={{ fontSize: 22, color: 'var(--accent-text)', fontWeight: 900, lineHeight: 1, flexShrink: 0, transition: 'transform 0.15s' }}>+</span>
                  </button>
                ))}
                {filteredSuggestions.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '1.5rem', color: 'var(--text3)', fontSize: 13 }}>
                    You have all {suggestionCategory} habits added ✓
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Templates tab */}
        {activeTab === 'templates' && !showForm && (
          <TemplatesTab onUseTemplate={handleUseTemplate} />
        )}

      </div>
    </div>
  );
}
