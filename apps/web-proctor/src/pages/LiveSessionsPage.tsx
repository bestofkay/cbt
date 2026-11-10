import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Spinner,
  StatTile,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@cbt/ui';
import { LiveIndicator } from '@/components/LiveIndicator';
import { RiskBadge } from '@/components/RiskBadge';
import { api } from '@/lib/api';
import type { GroupedProctorSession, ProctorCandidate } from '@/lib/proctor-types';
import { darkSurface, darkTableRow, scoreColorClass } from '@/lib/theme';

const POLL_INTERVAL_MS = 8_000;

export function LiveSessionsPage() {
  const { t } = useTranslation();
  const [lastUpdated, setLastUpdated] = useState<Date>();

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['proctor-sessions'],
    queryFn: async () => {
      const response = await api.get<{ data: GroupedProctorSession[] }>('/api/v1/proctor/sessions');
      setLastUpdated(new Date());
      return response;
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  const sessions = data?.data ?? [];
  const totals = useMemo(
    () => ({
      sessions: sessions.length,
      active: sessions.reduce((sum, s) => sum + s.activeCandidates, 0),
      flagged: sessions.reduce((sum, s) => sum + s.flaggedCandidates, 0),
    }),
    [sessions],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-24" role="status" aria-label={t('common.loading')}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-lg">
        <Alert variant="error" className="border-red-800/60 bg-red-950/50 text-red-200">
          <p>{t('sessions.loadError')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-red-700/60 bg-transparent text-red-200 hover:bg-red-950"
            onClick={() => void refetch()}
          >
            {t('common.retry')}
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('sessions.title')}
        description={t('sessions.description')}
        className="border-slate-800/80 [&_h1]:text-slate-100 [&_p]:text-slate-400"
        actions={<LiveIndicator isFetching={isFetching} lastUpdated={lastUpdated} />}
      />

      {sessions.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <StatTile
            label={t('sessions.statSessions')}
            value={totals.sessions}
            className={`${darkSurface} from-slate-900/80 via-slate-900/80 to-primary-950/40 [&_p:first-of-type]:text-slate-500 [&_p:nth-of-type(2)]:text-slate-100`}
          />
          <StatTile
            label={t('sessions.active')}
            value={totals.active}
            hint={t('sessions.activeHint')}
            className={`${darkSurface} from-slate-900/80 via-slate-900/80 to-emerald-950/30 [&_p:first-of-type]:text-slate-500 [&_p:nth-of-type(2)]:text-emerald-300 [&_p:last-of-type]:text-slate-500`}
          />
          <StatTile
            label={t('sessions.flagged')}
            value={totals.flagged}
            hint={t('sessions.flaggedHint')}
            className={`${darkSurface} from-slate-900/80 via-slate-900/80 to-amber-950/30 [&_p:first-of-type]:text-amber-400/80 [&_p:nth-of-type(2)]:text-amber-300`}
          />
        </motion.div>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState
          title={t('sessions.emptyTitle')}
          description={t('sessions.emptyDescription')}
          className="border-slate-700/60 bg-slate-900/40 text-slate-300 [&_p:first-of-type]:text-slate-100"
        />
      ) : (
        <div className="space-y-6">
          {sessions.map((session, index) => (
            <SessionPanel key={session.id} session={session} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionPanel({ session, index }: { session: GroupedProctorSession; index: number }) {
  const { t } = useTranslation();
  const sortedCandidates = [...session.candidates].sort(
    (a, b) => b.cheatingScore - a.cheatingScore,
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      aria-labelledby={`session-${session.id}-title`}
    >
      <Surface className={`${darkSurface} overflow-hidden`}>
        <div className="border-b border-slate-800/80 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                id={`session-${session.id}-title`}
                className="font-serif text-xl font-semibold text-slate-100 sm:text-2xl"
              >
                {session.examTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{session.name}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatTile
                label={t('sessions.active')}
                value={session.activeCandidates}
                className="min-w-[7rem] border-slate-700/60 bg-slate-950/50 p-3 shadow-none [&_p:first-of-type]:text-[0.65rem] [&_p:nth-of-type(2)]:mt-1 [&_p:nth-of-type(2)]:text-2xl"
              />
              <StatTile
                label={t('sessions.flagged')}
                value={session.flaggedCandidates}
                className="min-w-[7rem] border-amber-500/20 bg-amber-950/20 p-3 shadow-none [&_p:first-of-type]:text-amber-400/80 [&_p:first-of-type]:text-[0.65rem] [&_p:nth-of-type(2)]:mt-1 [&_p:nth-of-type(2)]:text-2xl [&_p:nth-of-type(2)]:text-amber-300"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {sortedCandidates.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">{t('sessions.noCandidates')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={`${darkTableRow} border-slate-800 hover:bg-transparent`}>
                  <TableHead scope="col" className="text-slate-400">
                    {t('sessions.candidate')}
                  </TableHead>
                  <TableHead scope="col" className="text-slate-400">
                    {t('sessions.email')}
                  </TableHead>
                  <TableHead scope="col" className="text-slate-400">
                    {t('monitor.cheatingScore')}
                  </TableHead>
                  <TableHead scope="col" className="text-slate-400">
                    {t('monitor.riskLevel')}
                  </TableHead>
                  <TableHead scope="col" className="text-slate-400">
                    {t('monitor.flags')}
                  </TableHead>
                  <TableHead scope="col" className="text-right text-slate-400">
                    {t('sessions.monitor')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCandidates.map((candidate) => (
                  <CandidateRow key={candidate.attemptId} sessionId={session.id} candidate={candidate} />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Surface>
    </motion.section>
  );
}

function CandidateRow({
  sessionId,
  candidate,
}: {
  sessionId: string;
  candidate: ProctorCandidate;
}) {
  const { t } = useTranslation();
  const flagCount = candidate.flags.length;

  return (
    <TableRow className={darkTableRow}>
      <TableCell className="font-medium text-slate-200">{candidate.candidateName}</TableCell>
      <TableCell className="text-slate-400">{candidate.candidateEmail}</TableCell>
      <TableCell>
        <span className={cn('font-serif text-lg font-semibold tabular-nums', scoreColorClass(candidate.cheatingScore))}>
          {candidate.cheatingScore}
        </span>
      </TableCell>
      <TableCell>
        <RiskBadge level={candidate.riskLevel} />
      </TableCell>
      <TableCell>
        {flagCount > 0 ? (
          <Badge variant="accent" className="bg-amber-500/20 text-amber-300">
            {flagCount}
          </Badge>
        ) : (
          <span className="text-slate-500">0</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Link
          to={`/sessions/${sessionId}/candidates/${candidate.attemptId}`}
          className={cn(
            'inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
            candidate.riskLevel === 'CRITICAL' || candidate.riskLevel === 'HIGH'
              ? 'bg-accent text-white hover:bg-accent-600'
              : 'border border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800',
          )}
        >
          {t('sessions.monitor')}
        </Link>
      </TableCell>
    </TableRow>
  );
}
