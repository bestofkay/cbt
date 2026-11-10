import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  Textarea,
} from '@cbt/ui';
import { api, ApiError } from '@/lib/api';
import { darkInput, darkSurface } from '@/lib/theme';
import type { ProctorFlag } from '@/lib/proctor-types';

interface ResolveFlagDialogProps {
  flag: ProctorFlag | null;
  attemptId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: (flagId: string) => void;
}

export function ResolveFlagDialog({
  flag,
  attemptId,
  open,
  onOpenChange,
  onResolved,
}: ResolveFlagDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resolveMutation = useMutation({
    mutationFn: (payload: { flagId: string; notes?: string }) =>
      api.post(`/api/v1/proctoring/flags/${payload.flagId}/resolve`, {
        notes: payload.notes?.trim() || undefined,
      }),
    onSuccess: (_data, variables) => {
      onResolved(variables.flagId);
      void queryClient.invalidateQueries({ queryKey: ['proctor-candidate', attemptId] });
      setNotes('');
      setError(null);
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flag) return;
    setError(null);
    resolveMutation.mutate({ flagId: flag.id, notes });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNotes('');
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`${darkSurface} gap-0 p-0`}>
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-slate-700 px-6 py-4">
            <DialogTitle className="text-slate-100">{t('monitor.resolveFlag')}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {flag ? flag.message : t('monitor.resolveFlagDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <label htmlFor="resolve-notes" className="text-sm font-medium text-slate-300">
                {t('monitor.resolveNotes')}
              </label>
              <Textarea
                id="resolve-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('monitor.resolveNotesPlaceholder')}
                rows={4}
                className={darkInput}
              />
            </div>
            {error ? (
              <Alert variant="error" className="border-red-800/60 bg-red-950/50 text-red-200">
                {error}
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="border-t border-slate-700 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              onClick={() => handleOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="accent" disabled={!flag || resolveMutation.isPending}>
              {resolveMutation.isPending ? <Spinner size="sm" /> : t('monitor.resolveConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
