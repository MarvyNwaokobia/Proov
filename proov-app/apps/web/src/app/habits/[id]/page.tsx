'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  IconArrowLeft, IconPencil, IconArchive,
  IconPlayerPlay, IconCheck, IconLock, IconUsers, IconWorld, IconFlame, IconShieldCheck,
  IconChevronLeft, IconChevronRight,
} from '@tabler/icons-react';
import {
  getUserHabits,
  getTodayCompletions,
  saveHabitCompletion,
  deactivateHabit,
  updateHabit,
  getHabitStreak,
  getCircleRequests,
  getUsernamesForAddresses,
  getVerifiedHabitsToday,
  getHabitCompletionDates,
  getHabitStats,
  type Habit,
} from '@/lib/supabase';
import { ProofSheet } from '@/components/shared/ProofSheet';
import { DurationPicker } from '@/components/shared/DurationPicker';
import { useProovTx } from '@/hooks/useProovTx';

function fmtDur(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const proovTx = useProovTx();

  const [habit, setHabit] = useState<Habit | null>(null);
  const [isDoneToday, setIsDoneToday] = useState(false);
  const [isVerifiedToday, setIsVerifiedToday] = useState(false);
  const [proofSheetOpen, setProofSheetOpen] = useState(false);
  const [habitStreak, setHabitStreak] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState(0);
  const [editVisibility, setEditVisibility] = useState<'private' | 'circle' | 'public' | 'custom'>('private');
  const [editVisibleTo, setEditVisibleTo] = useState<string[]>([]);
  const [circleMembers, setCircleMembers] = useState<{ address: string; username: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [completionDates, setCompletionDates] = useState<Set<string>>(new Set());
  const [bestStreak, setBestStreak] = useState(0);
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  useEffect(() => {
    const address = localStorage.getItem('proov_address') || '';
    if (!address) return;

    Promise.all([
      getUserHabits(address),
      getTodayCompletions(address),
      getHabitStreak(id, address),
      getCircleRequests(address),
      getVerifiedHabitsToday(address),
    ]).then(async ([habits, todayDone, streak, circle, verifiedIds]) => {
      const found = habits.find(h => h.id === id);
      if (!found) { router.back(); return; }
      setHabit(found);
      setIsDoneToday(todayDone.includes(found.id));
      setIsVerifiedToday((verifiedIds as string[]).includes(found.id));
      setHabitStreak(streak);
      setEditName(found.name);
      setEditDuration(found.duration_minutes);
      setEditVisibility(found.visibility);
      setEditVisibleTo(found.visible_to || []);

      const memberAddresses = circle.accepted.map(r =>
        r.from_address === address.toLowerCase() ? r.to_address : r.from_address
      );
      if (memberAddresses.length > 0) {
        const usernameMap = await getUsernamesForAddresses(memberAddresses);
        setCircleMembers(memberAddresses.map(addr => ({
          address: addr,
          username: usernameMap[addr] || addr.slice(0, 6) + '…' + addr.slice(-4),
        })));
      }

      getHabitCompletionDates(id, address).then(dates => setCompletionDates(new Set(dates))).catch(() => {});
      getHabitStats(id, address).then(stats => {
        setBestStreak(stats.bestStreak);
        setTotalCompletions(stats.totalCompletions);
        setCompletionRate(stats.completionRate);
      }).catch(() => {});
    });
  }, [id, router]);

  const handleMarkDone = async () => {
    if (!habit || isDoneToday) return;
    const address = localStorage.getItem('proov_address') || '';
    setIsDoneToday(true);
    setHabitStreak(prev => prev + 1);
    const streak = parseInt(localStorage.getItem('proov_streak_count') || '0');
    proovTx.completeHabit((habit as any)?.on_chain_id ?? undefined);
    await saveHabitCompletion(habit.id, address, streak).catch(() => {});
    showToast('Habit done ✓');
  };

  const handleSaveEdit = async () => {
    if (!habit) return;
    setSaving(true);
    await updateHabit(habit.id, {
      name: editName,
      duration_minutes: editDuration,
      visibility: editVisibility,
      visible_to: editVisibility === 'circle' ? editVisibleTo : [],
    });
    setHabit(prev => prev ? {
      ...prev,
      name: editName,
      duration_minutes: editDuration,
      visibility: editVisibility,
      visible_to: editVisibility === 'circle' ? editVisibleTo : [],
    } : null);
    setEditing(false);
    setSaving(false);
    showToast('Changes saved ✓');
  };

  const handleArchive = async () => {
    if (!habit) return;
    if (!confirm(`Archive "${habit.name}"?`)) return;
    proovTx.removeHabit((habit as any)?.on_chain_id ?? undefined);
    await deactivateHabit(habit.id);
    showToast('Habit archived');
    setTimeout(() => router.back(), 800);
  };

  const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      background:var(--text);color:var(--card-bg);padding:8px 16px;border-radius:20px;
      font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;font-family:inherit;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  };

  if (!habit) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', color: 'var(--text3)', fontSize: 13 }}>
      Loading...
    </div>
  );

  // Sun=0 … Sat=6, matches ['S','M','T','W','T','F','S'] index
  const todayIdx = new Date().getDay();

  const visibilityIcon = habit.visibility === 'private'
    ? <IconLock size={12} stroke={2} />
    : habit.visibility === 'circle'
    ? <IconUsers size={12} stroke={2} />
    : <IconWorld size={12} stroke={2} />;

  const visibilityLabel = habit.visibility === 'private' ? 'Private'
    : habit.visibility === 'circle' ? 'Circle' : 'Everyone';

  return (
    <>
    <div style={{ padding: '1rem 1rem 6rem', maxWidth: 480, margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 700, color: 'var(--accent-text)',
          background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
          marginBottom: 20, padding: 0,
        }}>
        <IconArrowLeft size={16} stroke={2.5} />
        Back to habits
      </button>

      {/* Header: emoji + name + meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <span style={{ fontSize: 36, flexShrink: 0 }}>{habit.emoji}</span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.4, lineHeight: 1.2 }}>
            {habit.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const }}>
            <span>{habit.type === 'timed' ? fmtDur(habit.duration_minutes) : 'Checkbox'}</span>
            <span>·</span>
            <span>{habit.category}</span>
            <span>·</span>
            <span style={{ textTransform: 'capitalize' }}>{habit.schedule}</span>
            <span>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>{visibilityIcon} {visibilityLabel}</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
        {[
          { value: habitStreak, label: 'Streak', icon: '🔥' },
          { value: bestStreak, label: 'Best', icon: '⭐' },
          { value: totalCompletions, label: 'Total', icon: '✓' },
          { value: `${completionRate}%`, label: 'Rate', icon: '📊' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '8px 6px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3, fontWeight: 600 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Last 7 days */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: 8 }}>
          Last 7 days
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => {
            const isToday = i === todayIdx;
            const done = isToday && isDoneToday;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600 }}>{day}</div>
                <div style={{
                  width: '100%', aspectRatio: '1', borderRadius: 7,
                  background: done ? 'var(--btn-primary-bg)' : isToday ? 'transparent' : 'var(--bg2)',
                  border: isToday ? '2px solid var(--accent-border)' : done ? 'none' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  color: done ? '#fff' : isToday ? 'var(--accent-text)' : 'var(--text3)',
                }}>
                  {done ? '✓' : isToday ? '·' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Month calendar */}
      {completionDates.size > 0 && (() => {
        const year = calMonth.getFullYear();
        const month = calMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = new Date().toISOString().split('T')[0];
        const monthLabel = calMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
        const isCurrentMonth = new Date().getFullYear() === year && new Date().getMonth() === month;

        const cells: { day: number; dateStr: string; done: boolean; isToday: boolean; isFuture: boolean }[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dt = new Date(year, month, d);
          cells.push({ day: d, dateStr, done: completionDates.has(dateStr), isToday: dateStr === todayStr, isFuture: dt > new Date() });
        }

        const completedInMonth = cells.filter(c => c.done).length;

        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button onClick={() => setCalMonth(new Date(year, month - 1, 1))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex' }}>
                <IconChevronLeft size={16} stroke={2} />
              </button>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{monthLabel}</div>
              <button onClick={() => { if (!isCurrentMonth) setCalMonth(new Date(year, month + 1, 1)); }}
                style={{ background: 'none', border: 'none', cursor: isCurrentMonth ? 'default' : 'pointer', color: isCurrentMonth ? 'var(--border)' : 'var(--text3)', padding: 4, display: 'flex' }}>
                <IconChevronRight size={16} stroke={2} />
              </button>
            </div>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 8, fontWeight: 600, color: 'var(--text3)', padding: '2px 0' }}>{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {cells.map(c => (
                <div key={c.dateStr} style={{
                  aspectRatio: '1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: c.done ? 700 : 500,
                  background: c.done ? 'var(--accent)' : c.isToday ? 'var(--accent-bg)' : 'var(--bg2)',
                  border: c.isToday && !c.done ? '1.5px solid var(--accent-border)' : '1px solid var(--border)',
                  color: c.done ? '#fff' : c.isFuture ? 'var(--border)' : 'var(--text3)',
                  opacity: c.isFuture ? 0.4 : 1,
                }}>
                  {c.day}
                </div>
              ))}
            </div>
            {/* Month summary */}
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
              {completedInMonth} day{completedInMonth !== 1 ? 's' : ''} completed in {calMonth.toLocaleString('default', { month: 'long' })}
            </div>
          </div>
        );
      })()}

      {/* Primary CTA */}
      {habit.type === 'timed' ? (
        isDoneToday ? (
          <div style={{
            width: '100%', padding: 13, borderRadius: 13, marginBottom: 12,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            fontSize: 14, fontWeight: 700, color: 'var(--accent-text)',
          }}>
            <IconCheck size={16} stroke={2.5} /> Done
          </div>
        ) : (
          <button
            onClick={() => router.push(`/timer?habitId=${habit.id}&autostart=1`)}
            style={{
              width: '100%', padding: 13, borderRadius: 13, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
            <IconPlayerPlay size={15} stroke={2} /> Start {fmtDur(habit.duration_minutes)} session
          </button>
        )
      ) : (
        isDoneToday ? (
          <div style={{
            width: '100%', padding: 13, borderRadius: 13, marginBottom: 12,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            fontSize: 14, fontWeight: 700, color: 'var(--accent-text)',
          }}>
            <IconCheck size={16} stroke={2.5} /> Done
          </div>
        ) : (
          <button
            onClick={handleMarkDone}
            style={{
              width: '100%', padding: 13, borderRadius: 13, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
            <IconCheck size={15} stroke={2} /> Mark as done
          </button>
        )
      )}

      {/* Proov it — shown when not done today and not already verified */}
      {!isDoneToday && !isVerifiedToday && (
        <button
          onClick={() => setProofSheetOpen(true)}
          style={{
            width: '100%', padding: 11, borderRadius: 13, marginBottom: 12,
            border: '1.5px solid var(--accent-border)', background: 'var(--accent-bg)',
            color: 'var(--accent-text)', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <IconShieldCheck size={15} stroke={2} /> Proov it · +3 leaderboard pts
        </button>
      )}
      {isVerifiedToday && (
        <div style={{
          width: '100%', padding: 11, borderRadius: 13, marginBottom: 12,
          background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          fontSize: 13, fontWeight: 700, color: '#059669',
        }}>
          <IconShieldCheck size={15} stroke={2} /> Verified today
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />

      {/* Secondary: Edit + Archive */}
      <div style={{ display: 'flex', gap: 8, marginBottom: editing ? 20 : 0 }}>
        <button
          onClick={() => setEditing(v => !v)}
          style={{
            flex: 1, padding: 11, borderRadius: 12,
            border: `1px solid ${editing ? 'var(--accent-border)' : 'var(--border)'}`,
            background: editing ? 'var(--accent-bg)' : 'transparent',
            color: editing ? 'var(--accent-text)' : 'var(--text2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all 0.15s',
          }}>
          <IconPencil size={13} stroke={2} /> {editing ? 'Cancel' : 'Edit'}
        </button>
        <button
          onClick={handleArchive}
          style={{
            flex: 1, padding: 11, borderRadius: 12,
            border: '1px solid rgba(180, 100, 120, 0.28)', background: 'transparent',
            color: '#a06070', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(180, 100, 120, 0.1)';
            (e.currentTarget as HTMLElement).style.color = '#8a4a5e';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#a06070';
          }}>
          <IconArchive size={13} stroke={2} /> Archive
        </button>
      </div>

      {/* Edit form — inline, shown below secondary row */}
      {editing && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '16px', marginTop: 4,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Name
          </div>
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--border2)',
              background: 'var(--card-bg)', color: 'var(--text)',
              fontSize: 14, fontWeight: 600, marginBottom: 14,
              outline: 'none', fontFamily: 'inherit',
              boxSizing: 'border-box' as const,
            }}
          />

          {habit.type === 'timed' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Duration
              </div>
              <DurationPicker value={editDuration} onChange={setEditDuration} />
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Visibility
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: editVisibility === 'circle' && circleMembers.length > 0 ? 10 : 16, flexWrap: 'wrap' as const }}>
            {([
              { value: 'private' as const, Icon: IconLock, label: 'Private' },
              { value: 'circle' as const, Icon: IconUsers, label: 'Circle' },
              { value: 'public' as const, Icon: IconWorld, label: 'Public' },
            ]).map(({ value, Icon, label }) => (
              <button
                key={value}
                onClick={() => setEditVisibility(value)}
                style={{
                  padding: '6px 14px', borderRadius: 20,
                  border: `1px solid ${editVisibility === value ? 'var(--accent-border)' : 'var(--border)'}`,
                  background: editVisibility === value ? 'var(--accent-bg)' : 'transparent',
                  color: editVisibility === value ? 'var(--accent-text)' : 'var(--text2)',
                  fontSize: 12, fontWeight: editVisibility === value ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                <Icon size={12} stroke={2} /> {label}
              </button>
            ))}
          </div>

          {editVisibility === 'circle' && circleMembers.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Who can see this
              </div>
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden',
              }}>
                {circleMembers.map((member, idx) => {
                  const checked = editVisibleTo.includes(member.address);
                  return (
                    <label
                      key={member.address}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 14px', cursor: 'pointer',
                        borderBottom: idx < circleMembers.length - 1 ? '1px solid var(--border)' : 'none',
                        background: checked ? 'var(--accent-bg)' : 'transparent',
                        transition: 'background 0.12s',
                      }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setEditVisibleTo(prev =>
                            checked ? prev.filter(a => a !== member.address) : [...prev, member.address]
                          );
                        }}
                        style={{ accentColor: 'var(--accent)', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--accent-bg)', border: '1.5px solid var(--accent-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: 'var(--accent-text)',
                      }}>
                        {member.username.slice(0, 1).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        @{member.username}
                      </span>
                      {checked && (
                        <IconCheck size={13} stroke={2.5} style={{ marginLeft: 'auto', color: 'var(--accent-text)' }} />
                      )}
                    </label>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                {editVisibleTo.length === 0
                  ? 'No members selected — only you can see this habit'
                  : `${editVisibleTo.length} member${editVisibleTo.length > 1 ? 's' : ''} selected`}
              </div>
            </div>
          )}

          {editVisibility === 'circle' && circleMembers.length === 0 && (
            <div style={{
              fontSize: 12, color: 'var(--text3)', marginBottom: 16,
              padding: '10px 12px', background: 'var(--bg2)',
              borderRadius: 10, border: '1px solid var(--border)',
            }}>
              You have no circle members yet. Add people to your circle to control per-habit visibility.
            </div>
          )}

          <button
            onClick={handleSaveEdit}
            disabled={saving || !editName.trim()}
            style={{
              width: '100%', padding: 11, borderRadius: 11, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 13, fontWeight: 700,
              cursor: saving || !editName.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: saving || !editName.trim() ? 0.6 : 1,
            }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

    </div>

    {proofSheetOpen && habit && (
      <ProofSheet
        habitId={habit.id}
        habitName={habit.name}
        habitCategory={habit.category}
        userAddress={localStorage.getItem('proov_address') || ''}
        onVerified={() => { setIsVerifiedToday(true); setIsDoneToday(true); }}
        onSelfReport={() => handleMarkDone()}
        onClose={() => setProofSheetOpen(false)}
      />
    )}
    </>
  );
}
