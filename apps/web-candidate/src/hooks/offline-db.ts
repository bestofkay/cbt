const DB_NAME = 'cbt-candidate-offline';
const DB_VERSION = 1;
const STORE_ANSWERS = 'pending-answers';

interface PendingAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  response: unknown;
  timeSpentSeconds?: number;
  synced: boolean;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ANSWERS)) {
        const store = db.createObjectStore(STORE_ANSWERS, { keyPath: 'id' });
        store.createIndex('attemptId', 'attemptId', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineAnswer(
  attemptId: string,
  questionId: string,
  response: unknown,
  timeSpentSeconds?: number,
): Promise<void> {
  const db = await openDb();
  const entry: PendingAnswer = {
    id: `${attemptId}:${questionId}`,
    attemptId,
    questionId,
    response,
    timeSpentSeconds,
    synced: false,
    createdAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ANSWERS, 'readwrite');
    tx.objectStore(STORE_ANSWERS).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getPendingAnswers(attemptId?: string): Promise<PendingAnswer[]> {
  const db = await openDb();
  const results = await new Promise<PendingAnswer[]>((resolve, reject) => {
    const tx = db.transaction(STORE_ANSWERS, 'readonly');
    const store = tx.objectStore(STORE_ANSWERS);
    const request = attemptId ? store.index('attemptId').getAll(attemptId) : store.getAll();
    request.onsuccess = () => resolve(request.result.filter((r) => !r.synced));
    request.onerror = () => reject(request.error);
  });
  db.close();
  return results;
}

export async function markAnswerSynced(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ANSWERS, 'readwrite');
    tx.objectStore(STORE_ANSWERS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
