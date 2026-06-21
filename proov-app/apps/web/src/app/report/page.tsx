'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft, IconFlame, IconTrendingUp, IconCalendar } from '@tabler/icons-react';
import {
  getUserHabits, getDailyCompletionCounts, getStreakData,
  getAllHabitStreaks, getHabitStats, type Habit,
} from '@/lib/supabase';

export default function MonthlyReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});
  const [habitStats, setHabitStats] = useState<Record<string, { totalCompletions: number; completionRate: number }>>({});

  useEffect(() => {
    const addr = localStorage.getItem('proov_address') || '';
    if (!addr) { router.replace('/'); return; }

    Promise.all([
      getUserHabits(addr),
      getDailyCompletionCounts(addr),
      getStreakData(addr),
    ]).then(async ([h, counts, sd]) => {
      setHabits(h);
      setDailyCounts(counts);
      setStreak({ current: sd.currentStreak, longest: sd.longestStreak });

      if (h.length > 0) {
        const streaks = await getAllHabitStreaks(h.map(x => x.id), addr).catch(() => ({}));
        setHabitStreaks(streaks);
        const statsEntries = await Promise.all(
          h.map(async habit => {
            const s = await getHabitStats(habit.id, addr).catch(() => ({ totalCompletions: 0, bestStreak: 0, completionRate: 0 }));
            return [habit.id, { totalCompletions: s.totalCompletions, completionRate: s.completionRate }] as const;
          })
        );
        setHabitStats(Object.fromEntries(statsEntries));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text3)', fontSize: 13 }}>
      Loading…
    </div>
  );

  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthDays = Object.entries(dailyCounts).filter(([d]) => d.startsWith(monthStr));
  const activeDays = monthDays.filter(([, c]) => c > 0).length;
  const totalCompletionsThisMonth = monthDays.reduce((s, [, c]) => s + c, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const overallRate = daysPassed > 0 ? Math.round((activeDays / daysPassed) * 100) : 0;

  const dayOfWeekCounts: Record<number, number> = {};
  monthDays.forEach(([d, c]) => {
    const dow = new Date(d + 'T12:00:00').getDay();
    dayOfWeekCounts[dow] = (dayOfWeekCounts[dow] || 0) + c;
  });
  const bestDowEntry = Object.entries(dayOfWeekCounts).sort(([, a], [, b]) => b - a)[0];
  const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const bestDay = bestDowEntry ? DOW_NAMES[Number(bestDowEntry[0])] : null;

  const sortedHabits = [...habits].sort((a, b) => (habitStats[b.id]?.completionRate || 0) - (habitStats[a.id]?.completionRate || 0));
  const mostConsistent = sortedHabits[0];
  const leastConsistent = sortedHabits.length > 1 ? sortedHabits[sortedHabits.length - 1] : null;

  const weekLabels: { label: string; count: number }[] = [];
  for (let w = 0; w < 4; w++) {
    let sum = 0;
    for (let d = 0; d < 7; d++) {
      const day = w * 7 + d + 1;
      if (day > daysInMonth) break;
      const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
      sum += dailyCounts[dateStr] || 0;
    }
    weekLabels.push({ label: `W${w + 1}`, count: sum });
  }
  const maxWeek = Math.max(...weekLabels.map(w => w.count), 1);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 100 }}>
      <div style={{
        background: 'var(--nav-bg)', borderBottom: '1px solid var(--border)',
        padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.back()} style={{
            width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text2)', border: '1px solid var(--border)', background: 'var(--bg2)', cursor: 'pointer',
          }}>
            <IconArrowLeft size={14} stroke={2} />
          </button>
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', letterSpacing: '-.3px' }}>
            Monthly Report
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 18px' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconCalendar size={14} stroke={2} /> {monthLabel}
        </div>

        {/* Overview stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { value: activeDays, label: 'Active days', sub: `of ${daysPassed}` },
            { value: totalCompletionsThisMonth, label: 'Completions', sub: 'this month' },
            { value: `${overallRate}%`, label: 'Daily rate', sub: 'showing up' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Streak */}
        <div style={{ background: 'var(--streak-hero-bg, var(--btn-primary-bg))', borderRadius: 14, padding: '14px 16px', color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <IconFlame size={28} stroke={1.5} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Current streak</div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{streak.current} days</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Best ever</div>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{streak.longest}</div>
          </div>
        </div>

        {/* Weekly bar chart */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IconTrendingUp size={12} stroke={2} /> Weekly breakdown
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
            {weekLabels.map(w => (
              <div key={w.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)' }}>{w.count}</div>
                <div style={{
                  width: '100%', borderRadius: 4,
                  height: `${Math.max(4, (w.count / maxWeek) * 60)}px`,
                  background: 'var(--accent)', opacity: 0.8,
                  transition: 'height .3s ease',
                }} />
                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600 }}>{w.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: 10 }}>
            Insights
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bestDay && (
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                📅 Your most productive day is <strong style={{ color: 'var(--accent-text)' }}>{bestDay}</strong>
              </div>
            )}
            {mostConsistent && (
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                🏆 Most consistent: <strong style={{ color: 'var(--accent-text)' }}>{mostConsistent.emoji} {mostConsistent.name}</strong> ({habitStats[mostConsistent.id]?.completionRate || 0}%)
              </div>
            )}
            {leastConsistent && habitStats[leastConsistent.id]?.completionRate !== habitStats[mostConsistent?.id]?.completionRate && (
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                💪 Needs attention: <strong style={{ color: 'var(--text3)' }}>{leastConsistent.emoji} {leastConsistent.name}</strong> ({habitStats[leastConsistent.id]?.completionRate || 0}%)
              </div>
            )}
          </div>
        </div>

        {/* Per-habit breakdown */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)', marginBottom: 8 }}>
          Habit breakdown
        </div>
        {sortedHabits.map(h => {
          const rate = habitStats[h.id]?.completionRate || 0;
          const total = habitStats[h.id]?.totalCompletions || 0;
          const hStreak = habitStreaks[h.id] || 0;
          return (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 12, marginBottom: 6,
            }}>
              <span style={{ fontSize: 20 }}>{h.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                  {total} done · {hStreak}d streak
                </div>
              </div>
              <div style={{
                fontSize: 13, fontWeight: 800,
                color: rate >= 75 ? 'var(--accent-text)' : rate >= 40 ? 'var(--text2)' : 'var(--text3)',
              }}>
                {rate}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
