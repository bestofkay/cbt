import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  EmptyState,
  PageHeader,
  Spinner,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cbt/ui';
import { api, type PaginatedResponse } from '@/lib/api';

interface CandidateResult {
  id: string;
  examTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

export function ResultsPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['candidate-results'],
    queryFn: () =>
      api.get<PaginatedResponse<CandidateResult>>('/api/v1/candidate/results?page=1&pageSize=50'),
  });

  const results = data?.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title={t('results.title')} description={t('results.description')} />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      ) : isError ? (
        <EmptyState title={t('common.error')} description={t('results.loadError')} />
      ) : results.length === 0 ? (
        <EmptyState
          title={t('results.emptyTitle')}
          description={t('results.emptyDescription')}
          action={
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t('nav.lobby')}
            </Link>
          }
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Surface className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('results.exam')}</TableHead>
                  <TableHead scope="col">{t('results.score')}</TableHead>
                  <TableHead scope="col">{t('results.status')}</TableHead>
                  <TableHead scope="col">{t('results.submitted')}</TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">{t('results.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium text-slate-900">{result.examTitle}</TableCell>
                    <TableCell className="tabular-nums">
                      {result.score}/{result.maxScore}{' '}
                      <span className="text-slate-500">({result.percentage}%)</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={result.passed ? 'success' : 'destructive'}>
                        {result.passed ? t('results.passed') : t('results.failed')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {new Date(result.submittedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/results/${result.id}`}
                        className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {t('results.viewDetails')}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        </motion.div>
      )}
    </div>
  );
}
