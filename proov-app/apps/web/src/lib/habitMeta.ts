// Local metadata for habits (categories + privacy) — stored in localStorage
// Key: proov_habit_meta_${address} → { [habitId]: HabitMeta }

const META_KEY = (address: string) =>
  `proov_habit_meta_${address.toLowerCase()}`;

const PENDING_KEY = (address: string) =>
  `proov_habit_pending_${address.toLowerCase()}`;

export interface HabitMeta {
  categoryId: string;
  privacy: 'private' | 'public';
  visibleTo: 'all_circle' | 'selected' | 'none';
  selectedViewers: string[];
}

type MetaStore = Record<string, HabitMeta>;

const DEFAULT_META: Pick<HabitMeta, 'privacy' | 'visibleTo' | 'selectedViewers'> = {
  privacy: 'private',
  visibleTo: 'none',
  selectedViewers: [],
};

export function getHabitMeta(address: string): MetaStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = JSON.parse(localStorage.getItem(META_KEY(address)) || '{}');
    // Backfill defaults for existing habits that pre-date privacy fields
    const filled: MetaStore = {};
    for (const [id, meta] of Object.entries(raw) as [string, Partial<HabitMeta>][]) {
      filled[id] = {
        categoryId: meta.categoryId ?? 'custom',
        privacy: meta.privacy ?? 'private',
        visibleTo: meta.visibleTo ?? 'none',
        selectedViewers: meta.selectedViewers ?? [],
      };
    }
    return filled;
  } catch {
    return {};
  }
}

export function setHabitMeta(
  address: string,
  habitId: string,
  patch: Partial<HabitMeta>
): void {
  if (typeof window === 'undefined') return;
  const store = getHabitMeta(address);
  const existing = store[habitId] ?? { categoryId: 'custom', ...DEFAULT_META };
  store[habitId] = { ...existing, ...patch };
  localStorage.setItem(META_KEY(address), JSON.stringify(store));
}

export function setHabitCategory(
  address: string,
  habitId: string,
  categoryId: string
): void {
  setHabitMeta(address, habitId, { categoryId });
}

export function setHabitPrivacy(
  address: string,
  habitId: string,
  privacy: HabitMeta['privacy'],
  visibleTo: HabitMeta['visibleTo'],
  selectedViewers: string[]
): void {
  setHabitMeta(address, habitId, { privacy, visibleTo, selectedViewers });
}

// Store pending category+privacy before we have a habit ID (while tx is inflight)
interface PendingHabitData {
  habitName: string;
  categoryId: string;
  privacy: HabitMeta['privacy'];
  visibleTo: HabitMeta['visibleTo'];
  selectedViewers: string[];
  ts: number;
}

export function setPendingCategory(
  address: string,
  habitName: string,
  categoryId: string,
  privacy: HabitMeta['privacy'] = 'private',
  visibleTo: HabitMeta['visibleTo'] = 'none',
  selectedViewers: string[] = []
): void {
  if (typeof window === 'undefined') return;
  const data: PendingHabitData = { habitName, categoryId, privacy, visibleTo, selectedViewers, ts: Date.now() };
  localStorage.setItem(PENDING_KEY(address), JSON.stringify(data));
}

// After tx confirms, reconcile pending with the new habit's ID
export function reconcilePendingCategory(
  address: string,
  habits: Array<{ id: bigint; name: string; createdAt: bigint }>
): void {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(PENDING_KEY(address));
  if (!raw) return;
  try {
    const data: PendingHabitData = JSON.parse(raw);
    if (Date.now() - data.ts > 5 * 60 * 1000) {
      localStorage.removeItem(PENDING_KEY(address));
      return;
    }
    const match = [...habits]
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
      .find((h) => h.name === data.habitName);
    if (match) {
      setHabitMeta(address, match.id.toString(), {
        categoryId: data.categoryId,
        privacy: data.privacy,
        visibleTo: data.visibleTo,
        selectedViewers: data.selectedViewers,
      });
      localStorage.removeItem(PENDING_KEY(address));
    }
  } catch {
    localStorage.removeItem(PENDING_KEY(address));
  }
}
