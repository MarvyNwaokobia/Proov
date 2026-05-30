"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconBrain, IconRun, IconYoga, IconBook, IconSalad, IconPalette,
  IconArrowLeft, IconFlame, IconClock, IconCheck, IconArchive, IconPlayerPlay, IconPlus,
  type Icon as TablerIcon,
} from '@tabler/icons-react';
import {
  getUserHabits, saveHabit, deactivateHabit as supabaseDeactivate,
  getTodayCompletions, saveHabitCompletion, getAllHabitStreaks, type Habit,
} from "@/lib/supabase";
import { useProovTx } from "@/hooks/useProovTx";
import { HABIT_CATEGORIES, getCategoryById, Frequency } from "@/lib/constants";
import { HABIT_TEMPLATES, ARCHETYPE_LABELS, type Archetype } from "@/lib/habitTemplates";

// ── AI suggestions types + static popular habits ──────────────────────────────

type AiSuggestion = {
  name: string;
  emoji: string;
  category: string;
  type: 'timed' | 'checkbox';
  duration_minutes: number | null;
  reason?: string;
  schedule: string;
};

const POPULAR_HABITS: AiSuggestion[] = [
  { name: 'Read 30 minutes',             emoji: '📖', category: 'learning', type: 'checkbox', duration_minutes: null, schedule: 'Daily' },
  { name: 'Morning run',                 emoji: '🏃', category: 'fitness',  type: 'timed',    duration_minutes: 30,   schedule: 'Daily' },
  { name: 'Meditate',                    emoji: '🧘', category: 'wellness', type: 'timed',    duration_minutes: 10,   schedule: 'Daily' },
  { name: 'Drink 2L water',              emoji: '💧', category: 'wellness', type: 'checkbox', duration_minutes: null, schedule: 'Daily' },
  { name: 'No social media before 10am', emoji: '🌿', category: 'focus',    type: 'checkbox', duration_minutes: null, schedule: 'Weekdays' },
  { name: 'Creative practice',           emoji: '🎨', category: 'creative', type: 'timed',    duration_minutes: 20,   schedule: 'Weekends' },
];

// ── Legacy suggestions data (used by old discover tab) ────────────────────────

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
  Creative: [
    { name: 'Sketch',                       emoji: '✏️', type: 'timed',    duration: 10 },
    { name: 'Free Write',                   emoji: '📝', type: 'timed',    duration: 15 },
    { name: 'Practice an Instrument',       emoji: '🎸', type: 'timed',    duration: 30 },
    { name: 'Take a Photo a Day',           emoji: '📷', type: 'checkbox' },
    { name: 'Create Something with Hands',  emoji: '🖐️', type: 'checkbox' },
    { name: 'Write a Poem',                 emoji: '🖊️', type: 'timed',    duration: 20 },
  ],
};
const SUGGESTION_CATS = ['Focus', 'Fitness', 'Wellness', 'Learning', 'Nutrition', 'Creative'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const STOPS = [1, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];
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
  // Use index into STOPS so thumb position aligns exactly with tick labels
  const stopIdx = STOPS.reduce((best, s, i) =>
    Math.abs(s - value) < Math.abs(STOPS[best] - value) ? i : best, 0);
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
          <p style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -1, marginBottom: 10 }}>{fmtDur(value)}</p>
          <input
            type="range"
            min={0}
            max={STOPS.length - 1}
            step={1}
            value={stopIdx}
            onChange={(e) => onChange(STOPS[parseInt(e.target.value)])}
            className="duration-slider"
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {STOPS.map(s => (
              <button key={s} onClick={() => onChange(s)} style={{ fontSize: 9, padding: "2px 1px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: value === s ? "var(--accent-text)" : "var(--text3)", fontWeight: value === s ? 700 : 400 }}>
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
            {([
              { id: true,  Icon: IconClock, title: "Timed habit",      desc: "Set a duration." },
              { id: false, Icon: IconCheck, title: "Tap to complete",  desc: "No timer needed." },
            ] as const).map(opt => (
              <button key={String(opt.id)} onClick={() => setHasTimer(opt.id)} style={{ padding: "1rem .875rem", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "center", border: `1px solid ${hasTimer === opt.id ? "var(--accent)" : "var(--border)"}`, background: hasTimer === opt.id ? "var(--accent-bg)" : "transparent" }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                  <opt.Icon size={28} stroke={1.5} color={hasTimer === opt.id ? "var(--accent-text)" : "var(--text3)"} />
                </div>
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
              ["Type", hasTimer ? `Timer · ${fmtDur(duration)}` : "Tap to complete"],
              ["Schedule", frequency === Frequency.DAILY ? "Daily" : "Weekly"],
              ["Visible to", privacy === 'private' ? "Private" : "Circle"],
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

  const [activeTab, setActiveTab] = useState<"my" | "all" | "templates" | "archived">("my");
  const [archivedHabits, setArchivedHabits] = useState<Habit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; categoryId: string; duration: number } | undefined>();
  const [catFilter, setCatFilter] = useState("All");
  const [suggestionCategory, setSuggestionCategory] = useState('Focus');
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);
  const [aiSuggestionsGeneratedAt, setAiSuggestionsGeneratedAt] = useState<string | null>(null);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
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
        // Also load archived habits
        import('@/lib/supabase').then(({ supabase }) => {
          if (!supabase) return;
          supabase.from('habits').select('*').eq('user_address', address.toLowerCase()).eq('active', false).order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setArchivedHabits(data as Habit[]); });
        });
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

  // Refresh completedToday when user returns to this tab (e.g. after completing a session elsewhere)
  useEffect(() => {
    const address = localStorage.getItem('proov_address') || '';
    if (!address) return;
    const onVisible = () => {
      if (!document.hidden) getTodayCompletions(address).then(setCompletedToday).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  // ── Create habit ────────────────────────────────────────────────────────────
  const handleSave = async (data: SaveData) => {
    setIsSaving(true);

    const txOk = await proovTx.createHabit(data.name, data.catId, data.hasTimer, data.hasTimer ? data.duration : 0);
    if (!txOk) { setIsSaving(false); return; }

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
      setHabits(prev => [...prev, saved]);
      const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
      localStorage.setItem('proov_habits_cache', JSON.stringify([...cached, saved]));
      showToast('✓ Habit saved!');
      setShowForm(false);
      setPrefill(undefined);
      setActiveTab('my');
    }
    setIsSaving(false);
  };

  // ── Archive habit ───────────────────────────────────────────────────────────
  const handleArchive = async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    const txOk = await proovTx.removeHabit((habit as any)?.on_chain_id ?? undefined);
    if (!txOk) return;
    await supabaseDeactivate(habitId);
    setHabits(prev => prev.filter(h => h.id !== habitId));
    const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
    localStorage.setItem('proov_habits_cache', JSON.stringify(cached.filter((h: any) => h.id !== habitId)));
    showToast('Habit archived');
    setArchivedHabits(prev => [...prev, habits.find(h => h.id === habitId)!].filter(Boolean));
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
    const txOk = await proovTx.createHabit(s.name, suggestionCategory.toLowerCase(), s.type === 'timed', s.duration || 0);
    if (!txOk) { setIsSaving(false); return; }
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
      setHabits(prev => [...prev, saved]);
      const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
      localStorage.setItem('proov_habits_cache', JSON.stringify([...cached, saved]));
      showToast(`${s.emoji} ${s.name} added`);
      setActiveTab('my');
    }
    setIsSaving(false);
  };

  // ── Add AI suggestion directly ──────────────────────────────────────────────
  const handleAddAiSuggestion = async (s: AiSuggestion) => {
    const txOk = await proovTx.createHabit(s.name, s.category.toLowerCase(), s.type === 'timed', s.duration_minutes || 0);
    if (!txOk) return;
    const address = localStorage.getItem('proov_address') || '';
    const saved = await saveHabit({
      user_address: address.toLowerCase(),
      name: s.name,
      emoji: s.emoji,
      category: s.category.toLowerCase(),
      type: s.type,
      duration_minutes: s.duration_minutes || 0,
      schedule: s.schedule === 'Weekdays' || s.schedule === 'Weekends' ? 'weekly' : 'daily',
      visibility: 'private',
      visible_to: [],
      active: true,
    });
    if (saved) {
      setHabits(prev => [...prev, saved]);
      const cached = JSON.parse(localStorage.getItem('proov_habits_cache') || '[]');
      localStorage.setItem('proov_habits_cache', JSON.stringify([...cached, saved]));
      showToast(`${s.emoji} ${s.name} added ✓`);
      setAddedSuggestions(prev => new Set([...prev, s.name]));
    }
  };

  // ── Fetch AI suggestions when Discover tab opens ────────────────────────────
  useEffect(() => {
    if (activeTab !== 'all' || loading || aiSuggestions.length > 0) return;
    const address = localStorage.getItem('proov_address') || '';
    if (!address) return;
    setAiSuggestionsLoading(true);
    const existingHabits = habits.map(h => ({ name: h.name, category: h.category, type: h.type, schedule: h.schedule }));
    fetch('/api/habit-suggestions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userAddress: address, existingHabits }),
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.suggestions)) {
          setAiSuggestions(data.suggestions);
          setAiSuggestionsGeneratedAt(data.generatedAt || new Date().toISOString());
        }
      })
      .catch(() => {})
      .finally(() => setAiSuggestionsLoading(false));
  }, [activeTab, loading, aiSuggestions.length, habits]);

  const aiSuggestionsStale = aiSuggestionsGeneratedAt
    ? Date.now() - new Date(aiSuggestionsGeneratedAt).getTime() > 24 * 60 * 60 * 1000
    : false;

  const handleRefreshSuggestions = () => {
    const address = localStorage.getItem('proov_address') || '';
    if (!address) return;
    setAiSuggestionsLoading(true);
    setAiSuggestions([]);
    const existingHabits = habits.map(h => ({ name: h.name, category: h.category, type: h.type, schedule: h.schedule }));
    fetch('/api/habit-suggestions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userAddress: address, existingHabits, forceRefresh: true }),
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.suggestions)) {
          setAiSuggestions(data.suggestions);
          setAiSuggestionsGeneratedAt(data.generatedAt || new Date().toISOString());
        }
      })
      .catch(() => {})
      .finally(() => setAiSuggestionsLoading(false));
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

  // ── Habit card renderer ─────────────────────────────────────────────────────
  const renderHabit = (habit: Habit) => {
    const isDone = completedToday.includes(habit.id);
    const streak = habitStreaks[habit.id] || 0;
    return (
      <div
        key={habit.id}
        onClick={() => router.push(`/habits/${habit.id}`)}
        style={{
          background: 'var(--card-bg)',
          border: `1px solid ${isDone ? 'var(--accent-border)' : 'var(--border)'}`,
          borderRadius: 16, padding: '14px 12px',
          display: 'flex', flexDirection: 'column',
          position: 'relative', cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        {/* Archive button */}
        <button
          onClick={e => { e.stopPropagation(); handleArchive(habit.id); }}
          title="Archive habit"
          style={{
            position: 'absolute', top: 10, right: 10,
            padding: 5, borderRadius: 8, border: 'none',
            background: 'transparent', color: 'var(--text3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}
        >
          <IconArchive size={13} stroke={1.8} />
        </button>

        {/* Emoji */}
        <span style={{ fontSize: 26, marginBottom: 8 }}>{habit.emoji}</span>

        {/* Name */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, paddingRight: 20, lineHeight: 1.3 }}>
          {habit.name}
        </div>

        {/* Detail line */}
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          {habit.type === 'timed' ? `${habit.duration_minutes}m` : 'Checkbox'}
          {streak > 0 && <><span>·</span><IconFlame size={10} stroke={2} color="#f59e0b" /><span style={{ color: '#f59e0b', fontWeight: 700 }}>{streak}d</span></>}
          {isDone && <><span>·</span><span style={{ color: 'var(--accent-text)', fontWeight: 700 }}>Done</span></>}
        </div>

        {/* Action button */}
        {habit.type === 'timed' && !isDone && (
          <button
            onClick={e => { e.stopPropagation(); router.push(`/timer?habitId=${habit.id}&autostart=1`); }}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 10, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              marginTop: 'auto',
            }}
          >
            <IconPlayerPlay size={12} stroke={2} /> Start
          </button>
        )}
        {habit.type === 'checkbox' && !isDone && (
          <button
            onClick={e => { e.stopPropagation(); handleToggleCompletion(habit.id); }}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 10, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              marginTop: 'auto',
            }}
          >
            <IconCheck size={12} stroke={2} /> Mark done
          </button>
        )}
        {isDone && (
          <div
            style={{
              width: '100%', padding: '8px 0', borderRadius: 10,
              background: 'var(--accent-bg)', color: 'var(--accent-text)',
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              marginTop: 'auto',
            }}
          >
            <IconCheck size={12} stroke={2} /> Done
          </div>
        )}
      </div>
    );
  };

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
          <button onClick={() => { setPrefill(undefined); setShowForm(true); setActiveTab("my"); }} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
            {([['my', 'My habits'], ['all', 'Discover'], ['templates', 'Templates'], ['archived', `🗑 ${archivedHabits.length > 0 ? archivedHabits.length : ''}`]] as const).map(([tab, label]) => (
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

        {/* My Habits tab */}
        {activeTab === "my" && !showForm && (
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
            {!loading && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {filteredHabits.map(renderHabit)}

                {/* Empty states */}
                {filteredHabits.length === 0 && habits.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: "center", padding: "2rem 0 1rem", color: "var(--text3)" }}>
                    <p style={{ marginBottom: 4, fontWeight: 600, color: "var(--text)", fontSize: 15 }}>No habits yet</p>
                    <p style={{ fontSize: 12 }}>Add one below or explore Discover.</p>
                  </div>
                )}
                {filteredHabits.length === 0 && habits.length > 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: "center", padding: "2rem 0 1rem", color: "var(--text3)" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>No {catFilter} habits yet</p>
                    <p style={{ fontSize: 12 }}>Try Discover to add some.</p>
                  </div>
                )}

                {/* Add habit dashed button */}
                <button
                  onClick={() => { setPrefill(undefined); setShowForm(true); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '20px 0', borderRadius: 16,
                    border: '1.5px dashed var(--border2)',
                    background: 'transparent', color: 'var(--text3)',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                    minHeight: 100,
                  }}
                >
                  <IconPlus size={20} stroke={1.5} />
                  Add habit
                </button>
              </div>
            )}
          </>
        )}

        {/* Discover tab */}
        {activeTab === "all" && !showForm && (
          <>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)' }}>
                Suggested for you
              </span>
              {aiSuggestionsStale && !aiSuggestionsLoading && (
                <button onClick={handleRefreshSuggestions} style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>
                  Refresh
                </button>
              )}
            </div>

            {/* Skeleton loading */}
            {aiSuggestionsLoading && (
              <>
                <style>{`@keyframes suggest-pulse { 0%,100% { opacity:0.5 } 50% { opacity:1 } }`}</style>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ background: 'var(--bg2)', borderRadius: 14, padding: 14, marginBottom: 10, animation: 'suggest-pulse 1.5s ease-in-out infinite', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--border)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 14, background: 'var(--border)', borderRadius: 6, width: '55%', marginBottom: 7 }} />
                      <div style={{ height: 11, background: 'var(--border)', borderRadius: 6, width: '35%', marginBottom: 8 }} />
                      <div style={{ height: 12, background: 'var(--border)', borderRadius: 6, width: '90%' }} />
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
                  </div>
                ))}
              </>
            )}

            {/* AI suggestion cards */}
            {!aiSuggestionsLoading && aiSuggestions.map(s => {
              const isAdded = addedSuggestions.has(s.name);
              return (
                <div key={s.name} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{s.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: s.reason ? 6 : 0 }}>
                      {s.category} · {s.type === 'timed' && s.duration_minutes ? `${s.duration_minutes} min` : s.schedule}
                    </div>
                    {s.reason && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.5 }}>{s.reason}</div>
                    )}
                  </div>
                  <button
                    onClick={() => { if (!isAdded) handleAddAiSuggestion(s); }}
                    disabled={isAdded}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0, border: 'none',
                      background: isAdded ? 'rgba(5,150,105,0.15)' : 'var(--accent-bg)',
                      outline: `1px solid ${isAdded ? 'rgba(5,150,105,0.35)' : 'var(--accent-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: isAdded ? 'default' : 'pointer',
                      color: isAdded ? '#059669' : 'var(--accent-text)',
                      fontFamily: 'inherit',
                    }}
                  >
                    {isAdded ? <IconCheck size={14} stroke={2.5} /> : <IconPlus size={14} stroke={2} />}
                  </button>
                </div>
              );
            })}

            {/* Empty state */}
            {!aiSuggestionsLoading && aiSuggestions.length === 0 && (
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', marginBottom: 10 }}>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Come back soon — suggestions refresh every few days</p>
              </div>
            )}

            {/* Popular habits */}
            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--text3)', marginBottom: 12 }}>
              Popular habits
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
              {SUGGESTION_CATS.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSuggestionCategory(cat)}
                  style={{
                    flexShrink: 0, padding: '5px 12px', borderRadius: 14, fontSize: 10, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    border: `1px solid ${suggestionCategory === cat ? 'var(--accent)' : 'var(--border)'}`,
                    background: suggestionCategory === cat ? 'var(--accent-bg)' : 'transparent',
                    color: suggestionCategory === cat ? 'var(--accent-text)' : 'var(--text3)',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Habits for selected category */}
            {filteredSuggestions.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '1rem 0' }}>
                You already have all the {suggestionCategory} habits!
              </p>
            ) : filteredSuggestions.map(s => {
              const isAdded = addedSuggestions.has(s.name);
              return (
                <div key={s.name} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{s.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {s.type === 'timed' && s.duration ? `${s.duration} min` : 'Checkbox'} · {suggestionCategory}
                    </div>
                  </div>
                  <button
                    onClick={() => { if (!isAdded) handleAddSuggestion(s); }}
                    disabled={isAdded}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0, border: 'none',
                      background: isAdded ? 'rgba(5,150,105,0.15)' : 'var(--accent-bg)',
                      outline: `1px solid ${isAdded ? 'rgba(5,150,105,0.35)' : 'var(--accent-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: isAdded ? 'default' : 'pointer',
                      color: isAdded ? '#059669' : 'var(--accent-text)',
                      fontFamily: 'inherit',
                    }}
                  >
                    {isAdded ? <IconCheck size={14} stroke={2.5} /> : <IconPlus size={14} stroke={2} />}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* Templates tab */}
        {activeTab === 'templates' && !showForm && (
          <TemplatesTab onUseTemplate={handleUseTemplate} />
        )}

        {/* ── Archived / Bin ─────────────────────────────────────────────── */}
        {activeTab === 'archived' && !showForm && (
          <div style={{ padding: '0 4px' }}>
            {archivedHabits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text3)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🗑</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>No archived habits</p>
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>Archived habits will appear here.</p>
              </div>
            ) : archivedHabits.map(h => (
              <div key={h.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.75 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{h.emoji}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{h.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text3)' }}>Archived</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const addr = localStorage.getItem('proov_address') || '';
                    const { supabase } = await import('@/lib/supabase');
                    if (!supabase) return;
                    await supabase.from('habits').update({ active: true }).eq('id', h.id);
                    setArchivedHabits(prev => prev.filter(a => a.id !== h.id));
                    setHabits(prev => [...prev, { ...h, active: true }]);
                    showToast('Habit restored ✓');
                  }}
                  style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid var(--accent-border)', background: 'var(--accent-bg)', color: 'var(--accent-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
