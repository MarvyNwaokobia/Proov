// Local metadata for habits (categories) — stored in localStorage
// Key: proov_habit_meta_${address} → { [habitId]: { categoryId } }
// Also uses a pending key while waiting for tx to confirm

const META_KEY = (address: string) =>
  `proov_habit_meta_${address.toLowerCase()}`;

const PENDING_KEY = (address: string) =>
  `proov_habit_pending_${address.toLowerCase()}`;

interface HabitMeta {
  categoryId: string;
}

type MetaStore = Record<string, HabitMeta>;

export function getHabitMeta(address: string): MetaStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(META_KEY(address)) || "{}");
  } catch {
    return {};
  }
}

export function setHabitCategory(
  address: string,
  habitId: string,
  categoryId: string
): void {
  if (typeof window === "undefined") return;
  const store = getHabitMeta(address);
  store[habitId] = { categoryId };
  localStorage.setItem(META_KEY(address), JSON.stringify(store));
}

// Store pending category before we have a habit ID (while tx is inflight)
export function setPendingCategory(
  address: string,
  habitName: string,
  categoryId: string
): void {
  if (typeof window === "undefined") return;
  const data = { habitName, categoryId, ts: Date.now() };
  localStorage.setItem(PENDING_KEY(address), JSON.stringify(data));
}

// After tx confirms, reconcile pending category with the new habit's ID
export function reconcilePendingCategory(
  address: string,
  habits: Array<{ id: bigint; name: string; createdAt: bigint }>
): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(PENDING_KEY(address));
  if (!raw) return;
  try {
    const { habitName, categoryId, ts } = JSON.parse(raw);
    // Only process if pending was set in the last 5 minutes
    if (Date.now() - ts > 5 * 60 * 1000) {
      localStorage.removeItem(PENDING_KEY(address));
      return;
    }
    // Find the habit with matching name created after the pending was set
    const match = [...habits]
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
      .find((h) => h.name === habitName);
    if (match) {
      setHabitCategory(address, match.id.toString(), categoryId);
      localStorage.removeItem(PENDING_KEY(address));
    }
  } catch {
    localStorage.removeItem(PENDING_KEY(address));
  }
}
