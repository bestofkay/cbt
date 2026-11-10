import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getPendingAnswers, markAnswerSynced, queueOfflineAnswer } from './offline-db';

export function useOfflineSync(attemptId: string | undefined) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingAnswers(attemptId);
    setPendingCount(pending.length);
  }, [attemptId]);

  const syncPending = useCallback(async () => {
    if (!attemptId || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const pending = await getPendingAnswers(attemptId);
      for (const item of pending) {
        try {
          await api.put(`/api/v1/attempts/${attemptId}/answers`, {
            questionId: item.questionId,
            response: item.response,
            timeSpentSeconds: item.timeSpentSeconds,
          });
          await markAnswerSynced(item.id);
        } catch {
          // keep item for next retry
        }
      }
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
    }
  }, [attemptId, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncPending();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPending]);

  useEffect(() => {
    void refreshPendingCount();
    if (navigator.onLine) void syncPending();
  }, [refreshPendingCount, syncPending]);

  const saveAnswer = useCallback(
    async (questionId: string, response: unknown, timeSpentSeconds?: number) => {
      if (!attemptId) return;
      if (!navigator.onLine) {
        await queueOfflineAnswer(attemptId, questionId, response, timeSpentSeconds);
        await refreshPendingCount();
        return;
      }
      try {
        await api.put(`/api/v1/attempts/${attemptId}/answers`, {
          questionId,
          response,
          timeSpentSeconds,
        });
      } catch {
        await queueOfflineAnswer(attemptId, questionId, response, timeSpentSeconds);
        await refreshPendingCount();
      }
    },
    [attemptId, refreshPendingCount],
  );

  return { isOnline, pendingCount, isSyncing, saveAnswer, syncPending };
}
