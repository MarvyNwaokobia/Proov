"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Link from "next/link";
import { useHabits, useCreateHabit, useDeactivateHabit } from "@/hooks/useHabits";
import { useCircle } from "@/hooks/useCircle";
import { TxToast } from "@/components/shared/TxToast";
import { HabitType, Frequency, HABIT_CATEGORIES, getCategoryById, SUGGESTED_HABITS } from "@/lib/constants";
import { getHabitMeta, setPendingCategory, reconcilePendingCategory, HabitMeta } from "@/lib/habitMeta";
import { HABIT_TEMPLATES, ARCHETYPE_LABELS, type Archetype } from "@/lib/habitTemplates";

function humanizeError(error: unknown): string {
  const msg = String((error as Error)?.message ?? error);
  if (/insufficient[_ ]funds|overshot|balance 0/i.test(msg)) return "Insufficient balance — add cUSD and try again.";
  if (/user rejected|cancelled/i.test(msg)) return "You cancelled that action.";
  return "Something went wrong. Please try again.";
}

const STOPS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];
function snapToStop(val: number) { return STOPS.reduce((p, c) => Math.abs(c - val) < Math.abs(p - val) ? c : p); }
function fmtDur(m: number) { return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ""}`; }

const CATEGORY_TO_TYPE: Record<string, number> = {
  focus: HabitType.FOCUS, fitness: HabitType.FITNESS, wellness: HabitType.CUSTOM,
  learning: HabitType.READING, nutrition: HabitType.HYDRATION,
  social: HabitType.CUSTOM, creative: HabitType.CUSTOM, custom: HabitType.CUSTOM,
};

const CATEGORY_FILTERS = ["All", "🧠 Focus", "💪 Fitness", "🧘 Wellness", "📚 Learning", "🥗 Nutrition", "🎨 Creative", "😴 Sleep"];

function DurationPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [mode, setMode] = useState<"slider" | "manual">("slider");
  const [live, setLive] = useState(value);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["slider", "manual"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: "5px 12px", borderRadius: 14, fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${mode === m ? "var(--accent)" : "var(--border)"}`, background: mode === m ? "var(--accent-bg)" : "transparent", color: mode === m ? "var(--accent-text)" : "var(--text3)" }}>{m === "slider" ? "⟷ Slider" : "✎ Manual"}</button>
        ))}
      </div>
      {mode === "slider" ? (
        <div>
          <p style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -1, marginBottom: 10 }}>{fmtDur(live)}</p>
          <input type="range" min={1} max={240} value={live}
            onInput={(e) => setLive(parseInt((e.target as HTMLInputElement).value))}
            onChange={(e) => { const s = snapToStop(parseInt(e.target.value)); onChange(s); setLive(s); }}
            className="duration-slider" style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {STOPS.map(s => (
              <button key={s} onClick={() => { onChange(s); setLive(s); }} style={{ fontSize: 9, padding: "2px 1px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: value === s ? "var(--accent-text)" : "var(--text3)", fontWeight: value === s ? 700 : 400 }}>{s < 60 ? `${s}m` : `${s / 60}h`}</button>
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

type Step = 1 | 2 | 3 | 4 | 5;

function CreateForm({ address, circle, onDone, onCancel, prefill, createHabit, isCreating, createError, setPendingMeta }: {
  address: string; circle: readonly `0x${string}`[];
  onDone: () => void; onCancel: () => void;
  prefill?: { name: string; categoryId: string; duration: number; habitType: number };
  createHabit: (n: string, t: number, d: number, f: number) => void;
  isCreating: boolean; createError: unknown;
  setPendingMeta: (n: string, cat: string, priv: HabitMeta["privacy"], vis: HabitMeta["visibleTo"], viewers: string[]) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(prefill?.name ?? "");
  const [catId, setCatId] = useState(prefill?.categoryId ?? "custom");
  const [hasTimer, setHasTimer] = useState(true);
  const [duration, setDuration] = useState(prefill?.duration ?? 25);
  const [habitType, setHabitType] = useState(prefill?.habitType ?? HabitType.FOCUS);
  const [frequency, setFrequency] = useState<number>(Frequency.DAILY);
  const [privacy, setPrivacy] = useState<HabitMeta["privacy"]>("private");
  const [visibleTo, setVisibleTo] = useState<HabitMeta["visibleTo"]>("none");
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
  const doCreate = () => {
    if (!name.trim()) { setFormError("Enter a habit name"); return; }
    if (!process.env.NEXT_PUBLIC_PROOV_CORE_ADDRESS) { setFormError("Contract not configured"); return; }
    setPendingMeta(name.trim(), catId, privacy, visibleTo, viewers);
    createHabit(name.trim(), habitType, hasTimer ? duration * 60 : 0, frequency);
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
            {HABIT_CATEGORIES.map(c => (<button key={c.id} onClick={() => { setCatId(c.id); setHabitType(CATEGORY_TO_TYPE[c.id] ?? HabitType.CUSTOM); }} style={{ borderRadius: 12, padding: "10px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 10, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${catId === c.id ? c.color + "80" : "var(--border)"}`, background: catId === c.id ? c.color + "18" : "transparent", color: catId === c.id ? c.color : "var(--text3)" }}><span style={{ fontSize: 16 }}>{c.emoji}</span><span>{c.label.split(" ")[0]}</span></button>))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>How do you complete it?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: hasTimer ? 18 : 0 }}>
            {[{ id: true, emoji: "⏱", title: "Timed habit", desc: "Set a duration." }, { id: false, emoji: "✅", title: "Tap to complete", desc: "No timer needed." }].map(opt => (<button key={String(opt.id)} onClick={() => setHasTimer(opt.id)} style={{ padding: "1rem .875rem", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "center", border: `1px solid ${hasTimer === opt.id ? "var(--accent)" : "var(--border)"}`, background: hasTimer === opt.id ? "var(--accent-bg)" : "transparent" }}><div style={{ fontSize: 28, marginBottom: 6 }}>{opt.emoji}</div><p style={{ fontSize: 11, fontWeight: 600, color: hasTimer === opt.id ? "var(--accent-text)" : "var(--text)", marginBottom: 3 }}>{opt.title}</p><p style={{ fontSize: 9, color: "var(--text3)" }}>{opt.desc}</p></button>))}
          </div>
          {hasTimer && <div style={{ marginTop: 14 }}><DurationPicker value={duration} onChange={setDuration} /></div>}
        </div>
      )}
      {step === 3 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>How often?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[{ val: Frequency.DAILY, label: "Daily", emoji: "📅", desc: "Every day" }, { val: Frequency.WEEKLY, label: "Weekly", emoji: "📆", desc: "Once a week" }].map(f => (<button key={f.val} onClick={() => setFrequency(f.val)} style={{ padding: "1rem", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "center", border: `1px solid ${frequency === f.val ? "var(--accent)" : "var(--border)"}`, background: frequency === f.val ? "var(--accent-bg)" : "transparent" }}><div style={{ fontSize: 24, marginBottom: 4 }}>{f.emoji}</div><p style={{ fontSize: 13, fontWeight: 600, color: frequency === f.val ? "var(--accent-text)" : "var(--text)" }}>{f.label}</p><p style={{ fontSize: 10, color: "var(--text3)" }}>{f.desc}</p></button>))}
          </div>
        </div>
      )}
      {step === 4 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Who can see this habit?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {[{ key: "none" as const, emoji: "🔒", label: "Private", desc: "Only you." }, { key: "all_circle" as const, emoji: "👥", label: "Everyone in my circle", desc: "All members see your progress." }, { key: "selected" as const, emoji: "🎯", label: "Choose who sees it", desc: "Pick specific people." }].map(opt => (<button key={opt.key} onClick={() => { setVisibleTo(opt.key); setPrivacy(opt.key === "none" ? "private" : "public"); }} style={{ padding: "11px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12, textAlign: "left", border: `1px solid ${visibleTo === opt.key ? "var(--accent)" : "var(--border)"}`, background: visibleTo === opt.key ? "var(--accent-bg)" : "transparent" }}><span style={{ fontSize: 20 }}>{opt.emoji}</span><div><p style={{ fontSize: 12, fontWeight: 600, color: visibleTo === opt.key ? "var(--accent-text)" : "var(--text)", margin: 0 }}>{opt.label}</p><p style={{ fontSize: 10, color: "var(--text3)", margin: 0 }}>{opt.desc}</p></div></button>))}
          </div>
          {visibleTo === "selected" && (
            <div>
              <input placeholder="Add by username..." value={viewerInput} onChange={e => setViewerInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && viewerInput.trim()) { const u = viewerInput.replace(/^@/, "").trim(); if (!viewers.includes(u)) setViewers(v => [...v, u]); setViewerInput(""); } }} style={{ marginBottom: 8 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{viewers.map(u => (<span key={u} style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "var(--accent-text)", display: "flex", alignItems: "center", gap: 6 }}>@{u}<button onClick={() => setViewers(v => v.filter(x => x !== u))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 14, fontFamily: "inherit" }}>×</button></span>))}</div>
            </div>
          )}
        </div>
      )}
      {step === 5 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Confirm</p>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><span style={{ fontSize: 24 }}>{cat?.emoji ?? "◆"}</span><div><p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{name}</p><p style={{ fontSize: 11, color: "var(--text3)", margin: 0 }}>{cat?.label}</p></div></div>
            {[["Type", hasTimer ? `⏱ ${fmtDur(duration)}` : "✅ Tap to complete"], ["Schedule", frequency === Frequency.DAILY ? "📅 Daily" : "📆 Weekly"], ["Visible to", visibleTo === "none" ? "🔒 Private" : visibleTo === "all_circle" ? "👥 Everyone in circle" : `🎯 ${viewers.map(u => "@" + u).join(", ") || "Selected"}`]].map(([label, val]) => (<div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 6 }}><span style={{ color: "var(--text3)" }}>{label}</span><span style={{ color: "var(--text)", fontWeight: 500 }}>{val}</span></div>))}
          </div>
          {(formError || !!createError) && <p style={{ color: "#f43f5e", fontSize: 11, marginBottom: 8 }}>{formError || humanizeError(createError)}</p>}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={step === 1 ? onCancel : back} style={{ flex: 1, padding: 11, borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{step === 1 ? "Cancel" : "← Back"}</button>
        {step < 5 ? (<button onClick={next} style={{ flex: 2, padding: 11, borderRadius: 12, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Next →</button>) : (<button onClick={doCreate} disabled={isCreating} style={{ flex: 2, padding: 11, borderRadius: 12, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 600, cursor: isCreating ? "default" : "pointer", fontFamily: "inherit", opacity: isCreating ? 0.7 : 1 }}>{isCreating ? "Saving…" : "Create habit"}</button>)}
      </div>
    </div>
  );
}

function TemplatesTab({ onUseTemplate }: { onUseTemplate: (t: typeof HABIT_TEMPLATES[0]) => void }) {
  const archetypes: Archetype[] = ["builder", "achiever", "creative", "nurturer"];
  const [selected, setSelected] = useState<typeof HABIT_TEMPLATES[0] | null>(null);
  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>← Back</button>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 16, padding: "1.25rem", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><span style={{ fontSize: 28 }}>{selected.emoji}</span><div><p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{selected.name}</p><p style={{ fontSize: 10, color: "var(--accent-text)", margin: 0 }}>{ARCHETYPE_LABELS[selected.archetype]}</p></div></div>
          <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10, lineHeight: 1.6 }}>{selected.description}</p>
          <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 12 }}>{selected.audience}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {selected.habits.map(h => (<div key={h.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10 }}><span style={{ fontSize: 16 }}>{h.emoji}</span><div style={{ flex: 1 }}><p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", margin: 0 }}>{h.name}</p><p style={{ fontSize: 10, color: "var(--text3)", margin: 0 }}>{h.duration > 0 ? fmtDur(h.duration) : "Tap to complete"}</p></div></div>))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={() => onUseTemplate(selected)} style={{ padding: 12, borderRadius: 12, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Use this template</button>
          <button onClick={() => onUseTemplate(selected)} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border2)", background: "transparent", color: "var(--text2)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Customise first</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      {archetypes.map(arch => (
        <div key={arch} style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 10 }}>{ARCHETYPE_LABELS[arch]}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {HABIT_TEMPLATES.filter(t => t.archetype === arch).map(tpl => (<button key={tpl.id} onClick={() => setSelected(tpl)} style={{ padding: ".875rem", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: "var(--card-bg)", border: "1px solid var(--card-border)" }}><span style={{ fontSize: 20, display: "block", marginBottom: 6 }}>{tpl.emoji}</span><p style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", margin: 0, marginBottom: 3 }}>{tpl.name}</p><p style={{ fontSize: 9, color: "var(--text3)", lineHeight: 1.4, margin: 0 }}>{tpl.description}</p></button>))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HabitsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  useEffect(() => { if (!isConnected) router.push("/"); }, [isConnected, router]);
  const { habits, refetch } = useHabits();
  const { circle } = useCircle();
  const { createHabit, hash: createHash, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateHabit();
  const { deactivateHabit, hash: deactivateHash, isSuccess: deactivateSuccess } = useDeactivateHabit();
  const [activeTab, setActiveTab] = useState<"all" | "templates">("all");
  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; categoryId: string; duration: number; habitType: number } | undefined>();
  const [catFilter, setCatFilter] = useState("All");
  const [savedFlash, setSavedFlash] = useState(false);
  const habitMeta = address ? getHabitMeta(address) : {};
  const activeHabits = habits.filter(h => h.active);
  useEffect(() => {
    if (createSuccess) {
      if (address) reconcilePendingCategory(address, habits as unknown as Array<{ id: bigint; name: string; createdAt: bigint }>);
      refetch(); setShowForm(false); setPrefill(undefined);
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2500);
    }
  }, [createSuccess, address, habits, refetch]);
  useEffect(() => { if (deactivateSuccess) refetch(); }, [deactivateSuccess, refetch]);
  const handleUseTemplate = (tpl: typeof HABIT_TEMPLATES[0]) => {
    tpl.habits.forEach(h => { createHabit(h.name, CATEGORY_TO_TYPE[h.category] ?? HabitType.CUSTOM, h.duration * 60, Frequency.DAILY); });
    setActiveTab("all");
  };
  const filteredHabits = catFilter === "All" ? activeHabits : activeHabits.filter(h => {
    const meta = habitMeta[h.id.toString()];
    const cat = meta ? getCategoryById(meta.categoryId) : null;
    const filterWord = catFilter.split(" ").slice(1).join(" ");
    return cat?.label?.includes(filterWord) ?? false;
  });
  if (!isConnected) return null;
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div className="top-bar" />
      {savedFlash && (<div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 50, background: "var(--success)", color: "#fff", padding: "10px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>✓ Habit saved!</div>)}
      <div style={{ background: "var(--nav-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)", padding: "1rem 1.25rem", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 16 }}>Habits</p>
          <button onClick={() => { setPrefill(undefined); setShowForm(true); setActiveTab("all"); }} style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ New</button>
        </div>
      </div>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "1rem 1.25rem" }}>
        {showForm && address && (
          <div style={{ marginBottom: 16 }}>
            <CreateForm address={address} circle={circle} onDone={() => setShowForm(false)} onCancel={() => { setShowForm(false); setPrefill(undefined); }} prefill={prefill} createHabit={createHabit} isCreating={isCreating} createError={createError} setPendingMeta={(n, cat, priv, vis, viewers) => { if (address) setPendingCategory(address, n, cat, priv, vis, viewers); }} />
          </div>
        )}
        {!showForm && (
          <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
            {(["all", "templates"] as const).map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "6px 14px", borderRadius: 14, fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${activeTab === tab ? "var(--accent)" : "var(--border)"}`, background: activeTab === tab ? "var(--accent-bg)" : "transparent", color: activeTab === tab ? "var(--accent-text)" : "var(--text3)" }}>{tab === "all" ? "All habits" : "Templates"}</button>))}
          </div>
        )}
        {activeTab === "all" && !showForm && (
          <>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
              {CATEGORY_FILTERS.map(f => (<button key={f} onClick={() => setCatFilter(f)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 14, fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${catFilter === f ? "var(--accent)" : "var(--border)"}`, background: catFilter === f ? "var(--accent-bg)" : "transparent", color: catFilter === f ? "var(--accent-text)" : "var(--text3)" }}>{f}</button>))}
            </div>
            {activeHabits.length === 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>Suggestions</p>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
                  {SUGGESTED_HABITS.map(s => (<button key={s.name} onClick={() => { setPrefill({ name: s.name, categoryId: s.category, duration: s.duration, habitType: CATEGORY_TO_TYPE[s.category] ?? HabitType.CUSTOM }); setShowForm(true); }} style={{ flexShrink: 0, width: 130, padding: ".875rem", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: "var(--card-bg)", border: "1px solid var(--card-border)" }}><span style={{ fontSize: 20, display: "block", marginBottom: 5 }}>{s.emoji}</span><p style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", margin: 0, marginBottom: 3 }}>{s.name}</p><p style={{ fontSize: 9, color: "var(--accent-text)", margin: 0, fontWeight: 600 }}>Customise →</p></button>))}
                </div>
              </div>
            )}
            {filteredHabits.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>Active · {filteredHabits.length}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: "100%" }}>
                  {filteredHabits.map(habit => {
                    const meta = habitMeta[habit.id.toString()];
                    const cat = meta ? getCategoryById(meta.categoryId) : null;
                    const hasTimer = Number(habit.targetDuration) > 0;
                    return (
                      <div key={habit.id.toString()} style={{ width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", background: "var(--card-bg)", border: `1px solid ${cat ? cat.color + "50" : "var(--card-border)"}`, borderRadius: 14, padding: ".875rem", display: "flex", flexDirection: "column", gap: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 20 }}>{cat ? cat.emoji : "◆"}</span><span style={{ fontSize: 10, color: "var(--text3)" }}>{meta?.privacy === "private" ? "🔒" : "👥"}</span></div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{habit.name}</p>
                        <p style={{ fontSize: 10, color: "var(--text3)", margin: 0 }}>{hasTimer ? `⏱ ${Math.round(Number(habit.targetDuration) / 60)} min` : "✅ Tap"} · {Number(habit.frequency) === 0 ? "Daily" : "Weekly"}</p>
                        <button onClick={() => deactivateHabit(Number(habit.id))} style={{ marginTop: 2, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text3)", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
        {activeTab === "templates" && !showForm && (<TemplatesTab onUseTemplate={handleUseTemplate} />)}
      </div>
      <TxToast hash={createHash} pendingText="Saving habit…" successText="Habit saved! ✓" />
      <TxToast hash={deactivateHash} pendingText="Removing…" successText="Removed." />
    </div>
  );
}
