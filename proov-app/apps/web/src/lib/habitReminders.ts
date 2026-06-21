const STORAGE_PREFIX = 'proov_habit_reminder_';

export function getHabitReminder(habitId: string): string | null {
  return localStorage.getItem(`${STORAGE_PREFIX}${habitId}`);
}

export function setHabitReminder(habitId: string, time: string): void {
  localStorage.setItem(`${STORAGE_PREFIX}${habitId}`, time);
  scheduleAllReminders();
}

export function clearHabitReminder(habitId: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${habitId}`);
  scheduleAllReminders();
}

export function getAllHabitReminders(): Record<string, string> {
  const reminders: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      const habitId = key.slice(STORAGE_PREFIX.length);
      const val = localStorage.getItem(key);
      if (val) reminders[habitId] = val;
    }
  }
  return reminders;
}

let scheduledTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAllReminders(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  if (scheduledTimer) clearTimeout(scheduledTimer);

  const reminders = getAllHabitReminders();
  const entries = Object.entries(reminders);
  if (entries.length === 0) return;

  const now = new Date();
  let nextMs = Infinity;

  for (const [, time] of entries) {
    const [h, m] = time.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const ms = target.getTime() - now.getTime();
    if (ms < nextMs) nextMs = ms;
  }

  if (nextMs < Infinity && nextMs > 0) {
    scheduledTimer = setTimeout(() => {
      fireReminders();
      scheduleAllReminders();
    }, Math.min(nextMs, 2147483647));
  }
}

function fireReminders(): void {
  const reminders = getAllHabitReminders();
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const habitsRaw = localStorage.getItem('proov_habits_cache');
  const habits: { id: string; name: string; emoji: string }[] = habitsRaw ? JSON.parse(habitsRaw) : [];

  for (const [habitId, time] of Object.entries(reminders)) {
    if (time !== currentTime) continue;
    const habit = habits.find(h => h.id === habitId);
    const name = habit?.name || 'a habit';
    const emoji = habit?.emoji || '⏰';

    const title = `${emoji} Time for ${name}`;
    const options = { body: 'Tap to open Proov and get it done.', icon: '/icon-192.png' };

    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, options))
        .catch(() => {});
    } else {
      try { new Notification(title, options); } catch {}
    }
  }
}
