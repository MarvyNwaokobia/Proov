import { openDB } from 'idb';

type ActionRecord = {
  id?: number;
  type: 'complete_habit' | 'start_session' | 'end_session' | 'journal_entry';
  payload: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDB(): Promise<any> {
  return openDB('proov-offline', 1, {
    upgrade(db) {
      const store = db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true });
      store.createIndex('by_synced', 'synced');
    },
  });
}

export async function saveOfflineAction(
  type: ActionRecord['type'],
  payload: Record<string, unknown>
): Promise<void> {
  const db = await getDB();
  await db.add('pending_actions', { type, payload, timestamp: Date.now(), synced: false });
}

export async function getPendingActions(): Promise<ActionRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('pending_actions', 'by_synced', false);
}

export async function markSynced(id: number): Promise<void> {
  const db = await getDB();
  const item: ActionRecord | undefined = await db.get('pending_actions', id);
  if (item) { item.synced = true; await db.put('pending_actions', item); }
}

export async function getPendingCount(): Promise<number> {
  const items = await getPendingActions();
  return items.length;
}
