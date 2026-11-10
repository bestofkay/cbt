import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Separator,
  Spinner,
  Surface,
} from '@cbt/ui';
import { api, ApiError } from '@/lib/api';

interface CandidateSession {
  id: string;
  name: string;
  examTitle: string;
  durationMinutes: number;
  startsAt: string;
  endsAt: string;
  status: string;
  requiresAccessCode: boolean;
}

function formatSchedule(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const dateFmt = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `${dateFmt}, ${timeFmt(start)} – ${timeFmt(end)}`;
  return `${start.toLocaleString()} – ${end.toLocaleString()}`;
}

function sessionStatusVariant(status: string): 'accent' | 'success' | 'secondary' | 'warning' {
  if (status === 'LIVE') return 'accent';
  if (status === 'SCHEDULED') return 'secondary';
  if (status === 'COMPLETED') return 'success';
  return 'warning';
}

export function ExamLobbyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accessCodes, setAccessCodes] = useState<Record<string, string>>({});
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startErrors, setStartErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['candidate-sessions'],
    queryFn: () => api.get<{ data: CandidateSession[] }>('/api/v1/candidate/sessions'),
  });

  const startMutation = useMutation({
    mutationFn: (payload: { examSessionId: string; accessCode?: string }) =>
      api.post<{ attemptId?: string; id?: string }>('/api/v1/attempts/start', payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['candidate-sessions'] });
      const id = result.attemptId ?? result.id;
      if (id) navigate(`/exam/${id}`);
    },
  });

  const handleStart = async (session: CandidateSession) => {
    setStartErrors((prev) => {
      const next = { ...prev };
      delete next[session.id];
      return next;
    });
    setStartingId(session.id);
    try {
      await startMutation.mutateAsync({
        examSessionId: session.id,
        accessCode: accessCodes[session.id] || undefined,
      });
    } catch (e) {
      setStartErrors((prev) => ({
        ...prev,
        [session.id]: e instanceof ApiError ? e.message : t('common.error'),
      }));
    } finally {
      setStartingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  const sessions = data?.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title={t('lobby.title')} description={t('lobby.description')} />

      {isError ? (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('lobby.loadError')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      ) : null}

      {!isError && sessions.length === 0 ? (
        <EmptyState
          title={t('lobby.emptyTitle')}
          description={t('lobby.emptyDescription')}
        />
      ) : null}

      {!isError && sessions.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          {sessions.map((session, i) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
            >
              <Surface className="flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-primary-950">
                      {session.examTitle}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">{session.name}</p>
                  </div>
                  <Badge variant={sessionStatusVariant(session.status)}>{session.status}</Badge>
                </div>

                <Separator className="my-5" />

                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('lobby.duration')}
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {t('lobby.durationValue', { minutes: session.durationMinutes })}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('lobby.schedule')}
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {formatSchedule(session.startsAt, session.endsAt)}
                    </dd>
                  </div>
                </dl>

                {session.requiresAccessCode ? (
                  <div className="mt-5 space-y-2">
                    <Label htmlFor={`code-${session.id}`}>{t('lobby.accessCode')}</Label>
                    <Input
                      id={`code-${session.id}`}
                      value={accessCodes[session.id] ?? ''}
                      onChange={(e) =>
                        setAccessCodes((prev) => ({ ...prev, [session.id]: e.target.value }))
                      }
                      autoComplete="off"
                      aria-required="true"
                    />
                  </div>
                ) : null}

                {startErrors[session.id] ? (
                  <Alert variant="error" className="mt-4">
                    {startErrors[session.id]}
                  </Alert>
                ) : null}

                <div className="mt-auto pt-6">
                  <Button
                    className="w-full"
                    variant="accent"
                    size="lg"
                    disabled={startingId === session.id}
                    onClick={() => handleStart(session)}
                  >
                    {startingId === session.id ? (
                      <Spinner size="sm" label={t('common.loading')} />
                    ) : (
                      t('lobby.startExam')
                    )}
                  </Button>
                </div>
              </Surface>
            </motion.div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
