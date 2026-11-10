import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
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
import { downloadAuthenticatedFile } from '@/lib/download';
import { PageMotion } from '@/components/PageMotion';

interface ResultRow {
  id: string;
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  score: number;
  maxScore: number;
  passed: boolean;
  submittedAt: string;
}

export function ResultsPage() {
  const { t } = useTranslation();
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['results'],
    queryFn: () => api.get<PaginatedResponse<ResultRow>>('/api/v1/admin/results?page=1&pageSize=50'),
  });

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExportError(null);
    setExporting(format);
    try {
      const path =
        format === 'csv'
          ? '/api/v1/reports/export/results.csv'
          : '/api/v1/reports/export/results.xlsx';
      await downloadAuthenticatedFile(path, `results.${format}`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setExporting(null);
    }
  };

  const results = data?.data ?? [];

  return (
    <PageMotion className="space-y-6">
      <PageHeader
        title={t('results.title')}
        description={t('results.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => handleExport('csv')}
            >
              {exporting === 'csv' ? (
                <Spinner size="sm" label={t('common.loading')} />
              ) : (
                t('results.exportCsv')
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => handleExport('xlsx')}
            >
              {exporting === 'xlsx' ? (
                <Spinner size="sm" label={t('common.loading')} />
              ) : (
                t('results.exportXlsx')
              )}
            </Button>
          </div>
        }
      />

      {exportError ? <Alert variant="error">{exportError}</Alert> : null}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      ) : isError ? (
        <Alert variant="error">
          {t('common.error')}{' '}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </Alert>
      ) : results.length === 0 ? (
        <EmptyState title={t('results.emptyTitle')} description={t('results.emptyDescription')} />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('results.candidate')}</TableHead>
                <TableHead scope="col">{t('results.exam')}</TableHead>
                <TableHead scope="col">{t('results.score')}</TableHead>
                <TableHead scope="col">{t('results.passed')}</TableHead>
                <TableHead scope="col">{t('results.submittedAt')}</TableHead>
                <TableHead scope="col">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.candidateName}</p>
                      <p className="text-xs text-slate-500">{row.candidateEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>{row.examTitle}</TableCell>
                  <TableCell>
                    {row.score}/{row.maxScore}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.passed ? 'success' : 'destructive'}>
                      {row.passed ? t('results.passedLabel') : t('results.failedLabel')}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(row.submittedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Link
                      to={`/results/${row.id}`}
                      className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {t('common.view')}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}
    </PageMotion>
  );
}
