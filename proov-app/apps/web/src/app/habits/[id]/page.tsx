'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconArrowLeft, IconChevronRight, IconPencil } from '@tabler/icons-react';
import {
  getUserHabits,
  getTodayCompletions,
  saveHabitCompletion,
  deactivateHabit,
  updateHabit,
  getHabitStreak,
  type Habit,
} from '@/lib/supabase';
import { useProovTx } from '@/hooks/useProovTx';

export default function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const proovTx = useProovTx();

  const [habit, setHabit] = useState<Habit | null>(null);
  const [isDoneToday, setIsDoneToday] = useState(false);
  const [habitStreak, setHabitStreak] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState(0);
  const [editVisibility, setEditVisibility] = useState<'private' | 'circle' | 'public' | 'custom'>('private');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const address = localStorage.getItem('proov_address') || '';
    if (!address) return;

    Promise.all([
      getUserHabits(address),
      getTodayCompletions(address),
      getHabitStreak(id, address),
    ]).then(([habits, todayDone, streak]) => {
      const found = habits.find(h => h.id === id);
      if (!found) { router.back(); return; }
      setHabit(found);
      setIsDoneToday(todayDone.includes(found.id));
      setHabitStreak(streak);
      setEditName(found.name);
      setEditDuration(found.duration_minutes);
      setEditVisibility(found.visibility);
    });
  }, [id, router]);

  const handleMarkDone = async () => {
    if (!habit || isDoneToday) return;
    const address = localStorage.getItem('proov_address') || '';
    setIsDoneToday(true);
    setHabitStreak(prev => prev + 1);
    const streak = parseInt(localStorage.getItem('proov_streak_count') || '0');
    await saveHabitCompletion(habit.id, address, streak).catch(() => {});
    proovTx.completeHabit((habit as any)?.on_chain_id || 0);
    showToast('Marked done ✓');
  };

  const handleSaveEdit = async () => {
    if (!habit) return;
    setSaving(true);
    await updateHabit(habit.id, {
      name: editName,
      duration_minutes: editDuration,
      visibility: editVisibility,
    });
    proovTx.editHabit(
      (habit as any)?.on_chain_id || 0,
      editName,
      habit.category,
      habit.type === 'timed',
      editDuration
    );
    proovTx.updateVisibility(editVisibility);
    setHabit(prev => prev ? {
      ...prev,
      name: editName,
      duration_minutes: editDuration,
      visibility: editVisibility,
    } : null);
    setEditing(false);
    setSaving(false);
    showToast('Habit updated ✓');
  };

  const handleRemove = async () => {
    if (!habit) return;
    if (!confirm(`Remove "${habit.name}"?`)) return;
    await deactivateHabit(habit.id);
    proovTx.removeHabit((habit as any)?.on_chain_id || 0);
    router.back();
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

  const todayDow = new Date().getDay();
  // Map Mon=0..Sun=6 so grid starts on Monday
  const todayIdx = todayDow === 0 ? 6 : todayDow - 1;

  return (
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

      {/* Header row: emoji + edit toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 36 }}>{habit.emoji}</span>
        <button
          onClick={() => setEditing(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 9,
            border: '1px solid var(--border)',
            background: editing ? 'var(--accent-bg)' : 'transparent',
            color: editing ? 'var(--accent-text)' : 'var(--text2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
          <IconPencil size={13} stroke={2} />
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {!editing ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)',
            letterSpacing: -0.5, marginBottom: 2 }}>
            {habit.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
            {habit.category} · {habit.type === 'timed'
              ? `${habit.duration_minutes} min`
              : 'Tap to complete'} · {habit.schedule}
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 20 }}>
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
              background: 'var(--bg2)', color: 'var(--text)',
              fontSize: 14, fontWeight: 600, marginBottom: 14,
              outline: 'none', fontFamily: 'inherit',
              boxSizing: 'border-box' as const,
            }}
          />

          {habit.type === 'timed' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Duration: {editDuration} min
              </div>
              <input
                type="range" min={1} max={240} step={1}
                value={editDuration}
                onChange={e => setEditDuration(parseInt(e.target.value))}
                style={{ width: '100%', marginBottom: 14, accentColor: 'var(--accent)' }}
              />
            </>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Visibility
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' as const }}>
            {(['private', 'circle', 'public'] as const).map(v => (
              <button
                key={v}
                onClick={() => setEditVisibility(v)}
                style={{
                  padding: '6px 14px', borderRadius: 20,
                  border: `1px solid ${editVisibility === v ? 'var(--accent-border)' : 'var(--border)'}`,
                  background: editVisibility === v ? 'var(--accent-bg)' : 'transparent',
                  color: editVisibility === v ? 'var(--accent-text)' : 'var(--text2)',
                  fontSize: 12, fontWeight: editVisibility === v ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {v === 'private' ? '🔒 Private' : v === 'circle' ? '👥 Circle' : '🌍 Public'}
              </button>
            ))}
          </div>

          <button
            onClick={handleSaveEdit}
            disabled={saving || !editName.trim()}
            style={{
              width: '100%', padding: 11, borderRadius: 11, border: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}

      {/* This week */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 8 }}>
        This week
      </div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>
        {['M','T','W','T','F','S','S'].map((day, i) => {
          const isToday = i === todayIdx;
          const done = isToday && isDoneToday;
          return (
            <div key={i} style={{ flex: 1, display: 'flex',
              flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{day}</span>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: done ? 'var(--btn-primary-bg)' : isToday ? 'transparent' : 'var(--bg2)',
                border: isToday ? '2px solid var(--accent-border)' : done ? 'none' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: done ? '#fff' : isToday ? 'var(--accent-text)' : 'var(--text3)',
              }}>
                {done ? '✓' : isToday ? '•' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visibility row */}
      <div
        onClick={() => setEditing(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', background: 'var(--bg2)',
          borderRadius: 12, marginBottom: 12, cursor: 'pointer',
        }}>
        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Who sees this</span>
        <span style={{ fontSize: 12, color: 'var(--accent-text)', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 4 }}>
          {habit.visibility === 'private' ? '🔒 Only me' :
           habit.visibility === 'circle' ? '👥 Circle' :
           habit.visibility === 'public' ? '🌍 Everyone' : 'Custom'}
          <IconChevronRight size={13} stroke={2} />
        </span>
      </div>

      {/* Stats */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 8 }}>
        Stats
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[
          { num: habitStreak, label: 'Current', color: 'var(--accent-text)' },
          { num: habitStreak, label: 'Best', color: 'var(--text)' },
          { num: 0, label: 'Total', color: 'var(--text)' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'var(--bg2)', borderRadius: 12, padding: 10, textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.num}</div>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase',
              letterSpacing: '0.07em', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      {habit.type === 'timed' ? (
        <button
          onClick={() => router.push('/timer')}
          style={{
            width: '100%', padding: 12, borderRadius: 12, border: 'none',
            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', marginBottom: 12,
          }}>
          ⚡ Start Grind Timer
        </button>
      ) : (
        <button
          onClick={handleMarkDone}
          disabled={isDoneToday}
          style={{
            width: '100%', padding: 12, borderRadius: 12, border: 'none',
            background: isDoneToday ? 'var(--bg2)' : 'var(--btn-primary-bg)',
            color: isDoneToday ? 'var(--text3)' : 'var(--btn-primary-text)',
            fontSize: 14, fontWeight: 700,
            cursor: isDoneToday ? 'default' : 'pointer',
            fontFamily: 'inherit', marginBottom: 12,
          }}>
          {isDoneToday ? '✓ Done today' : '✓ Mark as done today'}
        </button>
      )}

      {/* Remove */}
      <button
        onClick={handleRemove}
        style={{
          width: '100%', padding: 11, borderRadius: 12,
          border: '2px solid #f43f5e', background: 'transparent',
          color: '#f43f5e', fontSize: 13, fontWeight: 800,
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
        Remove habit
      </button>

    </div>
  );
}
