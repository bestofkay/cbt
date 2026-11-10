import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Alert,
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
} from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface ItemStat {
  questionId: string;
  attemptCount?: number;
  correctCount?: number;
  facility?: number;
  discrimination?: number;
  [key: string]: unknown;
}

interface ExamAnalytics {
  attemptCount: number;
  passRate: number;
  averagePercent: number;
  psychometrics: ItemStat[];
}

function formatPercent(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100 * 100) / 100}%`;
}

function formatNumber(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Math.round(value * 100) / 100 + '';
}

export function ExamAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exam-analytics', id],
    queryFn: () => api.get<ExamAnalytics>(`/api/v1/reports/exams/${id}/analytics`),
    enabled: !!id,
  });

  const items = data?.psychometrics ?? [];

  return (
    <PageMotion className="space-y-6">
      <div>
        <Link
          to={`/exams/${id}`}
          className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('examAnalytics.backToExam')}
        </Link>
      </div>

      <PageHeader title={t('examAnalytics.title')} description={t('examAnalytics.description')} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      ) : isError || !data ? (
        <Alert variant="error">
          {t('common.error')}{' '}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label={t('examAnalytics.attemptCount')} value={data.attemptCount} />
            <StatTile label={t('examAnalytics.passRate')} value={formatPercent(data.passRate)} />
            <StatTile
              label={t('examAnalytics.averagePercent')}
              value={`${formatNumber(data.averagePercent)}%`}
            />
          </div>

          <section aria-labelledby="item-stats-heading">
            <h2 id="item-stats-heading" className="mb-4 font-serif text-lg font-semibold text-primary-950">
              {t('examAnalytics.itemStats')}
            </h2>
            {items.length === 0 ? (
              <EmptyState
                title={t('examAnalytics.noItemsTitle')}
                description={t('examAnalytics.noItemsDescription')}
              />
            ) : (
              <Surface className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{t('examAnalytics.questionId')}</TableHead>
                      <TableHead scope="col">{t('examAnalytics.attempts')}</TableHead>
                      <TableHead scope="col">{t('examAnalytics.correct')}</TableHead>
                      <TableHead scope="col">{t('examAnalytics.facility')}</TableHead>
                      <TableHead scope="col">{t('examAnalytics.discrimination')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.questionId}>
                        <TableCell className="font-mono text-xs">{item.questionId.slice(0, 8)}…</TableCell>
                        <TableCell>{item.attemptCount ?? '—'}</TableCell>
                        <TableCell>{item.correctCount ?? '—'}</TableCell>
                        <TableCell>
                          {formatNumber(
                            (item.facility as number | undefined) ??
                              (item.correctCount != null && item.attemptCount
                                ? Number(item.correctCount) / Number(item.attemptCount)
                                : undefined),
                          )}
                        </TableCell>
                        <TableCell>{formatNumber(item.discrimination as number | undefined)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Surface>
            )}
          </section>
        </>
      )}
    </PageMotion>
  );
}
