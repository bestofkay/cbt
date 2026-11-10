import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Spinner,
  Surface,
  cn,
} from '@cbt/ui';
import { LiveIndicator } from '@/components/LiveIndicator';
import { ResolveFlagDialog } from '@/components/ResolveFlagDialog';
import { RiskBadge } from '@/components/RiskBadge';
import { api } from '@/lib/api';
import type { CandidateMonitorDetail, ProctorFlag } from '@/lib/proctor-types';
import {
  darkSurface,
  darkSurfaceMuted,
  scoreColorClass,
  severityBadgeVariant,
} from '@/lib/theme';

const POLL_INTERVAL_MS = 5_000;

export function CandidateMonitorPage() {
  const { sessionId, attemptId } = useParams<{ sessionId: string; attemptId: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [resolvedFlagIds, setResolvedFlagIds] = useState<Set<string>>(new Set());
  const [flagToResolve, setFlagToResolve] = useState<ProctorFlag | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['proctor-candidate', attemptId],
    queryFn: async () => {
      const response = await api.get<CandidateMonitorDetail>(
        `/api/v1/proctoring/attempts/${attemptId}`,
      );
      setLastUpdated(new Date());
      return response;
    },
    enabled: !!attemptId,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const resolveMutation = useMutation({
    mutationFn: (payload: { flagId: string; notes?: string }) =>
      api.post(`/api/v1/proctoring/flags/${payload.flagId}/resolve`, {
        notes: payload.notes?.trim() || undefined,
      }),
    onSuccess: (_data, variables) => {
      setResolvedFlagIds((prev) => new Set(prev).add(variables.flagId));
      void queryClient.invalidateQueries({ queryKey: ['proctor-candidate', attemptId] });
      setFlagToResolve(null);
    },
  });

  const openFlags = useMemo(
    () => (data?.flags ?? []).filter((f) => !resolvedFlagIds.has(f.id)),
    [data?.flags, resolvedFlagIds],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-24" role="status" aria-label={t('common.loading')}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <BackLink sessionId={sessionId} />
        <Alert variant="error" className="border-red-800/60 bg-red-950/50 text-red-200">
          {t('monitor.loadError')}
        </Alert>
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
          onClick={() => void refetch()}
        >
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <BackLink sessionId={sessionId} />
        <PageHeader
          title={t('monitor.title')}
          description={`${data.candidateName} · ${data.examTitle}`}
          className="mb-0 border-slate-800/80 pb-4 [&_h1]:text-slate-100 [&_p]:text-slate-400"
          actions={<LiveIndicator isFetching={isFetching} lastUpdated={lastUpdated} />}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Surface
          className={cn(
            darkSurface,
            'relative overflow-hidden p-6 sm:p-8',
            data.riskLevel === 'CRITICAL' && 'ring-1 ring-red-500/30',
            data.riskLevel === 'HIGH' && 'ring-1 ring-amber-500/25',
          )}
        >
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl',
              data.cheatingScore >= 70 ? 'bg-red-500/10' : data.cheatingScore >= 40 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
            )}
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t('monitor.cheatingScore')}
              </p>
              <p
                className={cn(
                  'mt-2 font-serif text-6xl font-semibold tabular-nums sm:text-7xl',
                  scoreColorClass(data.cheatingScore),
                )}
                aria-live="polite"
                aria-atomic="true"
              >
                {data.cheatingScore}
                <span className="text-3xl text-slate-500 sm:text-4xl">%</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RiskBadge level={data.riskLevel} />
                <Badge variant="secondary" className="border-slate-700 bg-slate-800 text-slate-400">
                  {data.status}
                </Badge>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:min-w-[12rem]">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
                <dt className="text-slate-500">{t('monitor.eventsFeed')}</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold text-slate-200">
                  {data.events.length}
                </dd>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-4 py-3">
                <dt className="text-amber-400/80">{t('monitor.openFlags')}</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold text-amber-300">
                  {openFlags.length}
                </dd>
              </div>
            </dl>
          </div>
        </Surface>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="xl:col-span-3" aria-labelledby="events-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="events-heading" className="font-serif text-xl font-semibold text-slate-100">
              {t('monitor.eventsFeed')}
            </h2>
          </div>
          <Surface className={`${darkSurface} p-0`}>
            {data.events.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">{t('monitor.noEvents')}</p>
            ) : (
              <ul
                className="max-h-[32rem] divide-y divide-slate-800 overflow-y-auto"
                aria-live="polite"
                aria-label={t('monitor.eventsFeed')}
              >
                {data.events.map((event, index) => (
                  <motion.li
                    key={event.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3) }}
                    className="px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200">{event.message}</p>
                        <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">
                          {event.type.replaceAll('_', ' ')}
                        </p>
                      </div>
                      <Badge
                        variant={severityBadgeVariant(event.severity)}
                        className={cn(
                          severityBadgeVariant(event.severity) === 'secondary' &&
                            'border-slate-600 bg-slate-800 text-slate-400',
                          severityBadgeVariant(event.severity) === 'warning' &&
                            'bg-amber-500/20 text-amber-300',
                          severityBadgeVariant(event.severity) === 'destructive' &&
                            'bg-red-500/20 text-red-300',
                        )}
                      >
                        {event.severity}
                      </Badge>
                    </div>
                    <time className="mt-2 block text-xs text-slate-500" dateTime={event.createdAt}>
                      {new Date(event.createdAt).toLocaleString()}
                    </time>
                  </motion.li>
                ))}
              </ul>
            )}
          </Surface>
        </section>

        <section className="xl:col-span-2" aria-labelledby="flags-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="flags-heading" className="font-serif text-xl font-semibold text-slate-100">
              {t('monitor.flags')}
            </h2>
            {openFlags.length > 0 ? (
              <Badge variant="accent" className="bg-amber-500/20 text-amber-300">
                {openFlags.length}
              </Badge>
            ) : null}
          </div>
          <Surface className={`${darkSurface} p-0`}>
            {openFlags.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">{t('monitor.noFlags')}</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {openFlags.map((flag, index) => (
                  <motion.li
                    key={flag.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="accent" className="bg-amber-500/20 text-amber-300">
                        {flag.type}
                      </Badge>
                      <time className="shrink-0 text-xs text-slate-500" dateTime={flag.createdAt}>
                        {new Date(flag.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{flag.message}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 border-slate-700 bg-transparent text-slate-200 hover:border-amber-500/40 hover:bg-amber-950/30 hover:text-amber-200"
                      disabled={resolveMutation.isPending}
                      onClick={() => setFlagToResolve(flag)}
                    >
                      {t('monitor.resolve')}
                    </Button>
                  </motion.li>
                ))}
              </ul>
            )}
          </Surface>

          {resolvedFlagIds.size > 0 ? (
            <Surface className={`${darkSurfaceMuted} mt-4 px-4 py-3 text-sm text-slate-400`}>
              {t('monitor.resolvedCount', { count: resolvedFlagIds.size })}
            </Surface>
          ) : null}

          <section className="mt-6" aria-labelledby="signals-heading">
            <h2 id="signals-heading" className="mb-4 font-serif text-xl font-semibold text-slate-100">
              {t('monitor.mediaSignals')}
            </h2>
            <Surface className={`${darkSurface} p-4`}>
              {data.signalCounts && Object.keys(data.signalCounts).length > 0 ? (
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(data.signalCounts).map(([type, count]) => (
                    <li
                      key={type}
                      className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2"
                    >
                      <span className="text-slate-400">{type.replaceAll('_', ' ')}</span>
                      <span className="font-semibold tabular-nums text-slate-200">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">{t('monitor.noSignals')}</p>
              )}
            </Surface>
          </section>

          <section className="mt-6" aria-labelledby="locations-heading">
            <h2 id="locations-heading" className="mb-4 font-serif text-xl font-semibold text-slate-100">
              {t('monitor.locations')}
            </h2>
            <Surface className={`${darkSurface} p-0`}>
              {(data.locations ?? []).length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-slate-500">{t('monitor.noLocations')}</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {(data.locations ?? []).map((loc) => (
                    <li key={loc.id} className="px-5 py-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-200">
                            {[loc.city, loc.region, loc.country].filter(Boolean).join(', ') || t('monitor.unknownLocation')}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-slate-500">{loc.ipAddress}</p>
                        </div>
                        {loc.vpnSuspected ? (
                          <Badge variant="destructive" className="bg-red-500/20 text-red-300">
                            {t('monitor.vpn')}
                          </Badge>
                        ) : null}
                      </div>
                      <time className="mt-1 block text-xs text-slate-500" dateTime={loc.createdAt}>
                        {new Date(loc.createdAt).toLocaleString()}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          </section>
        </section>
      </div>

      <ResolveFlagDialog
        flag={flagToResolve}
        attemptId={attemptId ?? ''}
        open={!!flagToResolve}
        onOpenChange={(open) => {
          if (!open) setFlagToResolve(null);
        }}
        onResolved={(flagId) => setResolvedFlagIds((prev) => new Set(prev).add(flagId))}
      />
    </div>
  );
}

function BackLink({ sessionId }: { sessionId?: string }) {
  const { t } = useTranslation();

  return (
    <Link
      to={sessionId ? '/' : '/'}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-300 transition-colors hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    >
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      {t('common.back')}
    </Link>
  );
}
