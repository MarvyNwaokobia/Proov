'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUserHabits, getTodayCompletions, saveHabitCompletion, type Habit } from '@/lib/supabase';
import { IconArrowLeft, IconChevronRight } from '@tabler/icons-react';
import { useProovTx } from '@/hooks/useProovTx';

export default function HabitDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [isDoneToday, setIsDoneToday] = useState(false);
  const proovTx = useProovTx();

  useEffect(() => {
    const address = localStorage.getItem('proov_address') || '';
    Promise.all([getUserHabits(address), getTodayCompletions(address)]).then(([habits, done]) => {
      const found = habits.find(h => h.id === id);
      setHabit(found || null);
      setIsDoneToday(done.includes(id as string));
    });
  }, [id]);

  const handleMarkDone = async (habitId: string) => {
    const address = localStorage.getItem('proov_address') || '';
    const streak = parseInt(localStorage.getItem('proov_streak_count') || '0');
    await saveHabitCompletion(habitId, address, streak).catch(() => {});
    proovTx.completeHabit((habit as any)?.on_chain_id || 0);
    setIsDoneToday(true);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const isToday = i === 6;
    return { isToday, isDone: isToday && isDoneToday };
  });

  if (!habit) return null;

  return (
    <div style={{ padding: '1rem 1rem 6rem', maxWidth: 480, margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 700, color: 'var(--accent-text)',
        background: 'transparent', border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
      }}>
        <IconArrowLeft size={16} stroke={2.5} /> Back to habits
      </button>

      <span style={{ fontSize: 32, display: 'block', marginBottom: 6 }}>{habit.emoji}</span>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>{habit.name}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>
        {habit.category} · {habit.type === 'timed' ? `${habit.duration_minutes} min` : 'Tap'} · {habit.schedule}
      </div>

      {/* This week */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 8 }}>This week</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
        {['M','T','W','T','F','S','S'].map((day, i) => {
          const isToday = weekDays[i]?.isToday;
          const isDone = weekDays[i]?.isDone;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{day}</span>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: isDone ? 'var(--btn-primary-bg)' : isToday ? 'transparent' : 'var(--bg2)',
                border: isToday ? '2px solid var(--accent-border)' : isDone ? 'none' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: isDone ? '#fff' : isToday ? 'var(--accent-text)' : 'var(--text3)',
              }}>
                {isDone ? '✓' : isToday ? '•' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visibility */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', background: 'var(--bg2)', borderRadius: 12, marginBottom: 12,
        cursor: 'pointer',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Who sees this</span>
        <span style={{ fontSize: 12, color: 'var(--accent-text)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
          {habit.visibility === 'private' ? 'Only me' :
           habit.visibility === 'circle' ? 'Circle' :
           habit.visibility === 'public' ? 'Everyone' : 'Custom'} <IconChevronRight size={14} />
        </span>
      </div>

      {/* Stats */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 8 }}>Stats</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { num: isDoneToday ? 1 : 0, label: 'Current' },
          { num: 0, label: 'Best' },
          { num: 0, label: 'Total' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: 'var(--bg2)', borderRadius: 12, padding: 10, textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{s.num}</div>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{s.label}</div>
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
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
          ⚡ Start Grind Timer
        </button>
      ) : (
        <button
          onClick={() => !isDoneToday && handleMarkDone(habit.id)}
          disabled={isDoneToday}
          style={{
            width: '100%', padding: 12, borderRadius: 12, border: 'none',
            background: isDoneToday ? 'var(--bg2)' : 'var(--btn-primary-bg)',
            color: isDoneToday ? 'var(--text3)' : 'var(--btn-primary-text)',
            fontSize: 14, fontWeight: 700,
            cursor: isDoneToday ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>
          {isDoneToday ? '✓ Done for today' : '✓ Mark as done today'}
        </button>
      )}
    </div>
  );
}
