import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from '@cbt/ui';
import { api } from '@/lib/api';
import { downloadAuthenticatedFile } from '@/lib/download';
import { PageMotion } from '@/components/PageMotion';

interface ResultAnswer {
  id: string;
  questionCode: string | null;
  stem: string;
  type: string | null;
  response: unknown;
  scoreAwarded: number;
  maxScore: number;
  isCorrect: boolean | null;
  needsReview: boolean;
}

interface ResultDetail {
  id: string;
  examTitle: string;
  candidateName: string;
  candidateEmail: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: string | null;
  gradedAt: string;
  attemptId: string;
  certificate: { id: string; certificateNo: string; verificationCode?: string } | null;
  answers: ResultAnswer[];
}

function formatResponse(response: unknown): string {
  if (response == null) return '—';
  if (typeof response === 'string') return response;
  try {
    return JSON.stringify(response);
  } catch {
    return String(response);
  }
}

export function ResultDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['result-detail', id],
    queryFn: () => api.get<ResultDetail>(`/api/v1/admin/results/${id}`),
    enabled: !!id,
  });

  const handleDownload = async () => {
    if (!id) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadAuthenticatedFile(
        `/api/v1/reports/export/candidate/${id}.pdf`,
        `result-${id}.pdf`,
      );
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <PageMotion>
        <Alert variant="error">{t('common.error')}</Alert>
      </PageMotion>
    );
  }

  return (
    <PageMotion className="space-y-8">
      <div>
        <Link
          to="/results"
          className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('resultDetail.backToList')}
        </Link>
      </div>

      <PageHeader
        title={data.candidateName}
        description={`${data.examTitle} · ${data.candidateEmail}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={data.passed ? 'success' : 'destructive'}>
              {data.passed ? t('results.passedLabel') : t('results.failedLabel')}
            </Badge>
            <Button type="button" variant="outline" disabled={downloading} onClick={handleDownload}>
              {downloading ? (
                <Spinner size="sm" label={t('common.loading')} />
              ) : (
                t('resultDetail.downloadPdf')
              )}
            </Button>
          </div>
        }
      />

      {downloadError ? <Alert variant="error">{downloadError}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label={t('results.score')}
          value={`${data.score}/${data.maxScore}`}
          hint={`${Math.round(data.percentage * 100) / 100}%`}
        />
        <StatTile
          label={t('resultDetail.submittedAt')}
          value={data.submittedAt ? new Date(data.submittedAt).toLocaleDateString() : '—'}
          hint={data.submittedAt ? new Date(data.submittedAt).toLocaleTimeString() : undefined}
        />
        <StatTile
          label={t('resultDetail.certificate')}
          value={data.certificate ? data.certificate.certificateNo : t('resultDetail.noCertificate')}
        />
      </div>

      <section aria-labelledby="answers-heading">
        <h2 id="answers-heading" className="mb-4 font-serif text-lg font-semibold text-primary-950">
          {t('resultDetail.answers')}
        </h2>
        {data.answers.length === 0 ? (
          <EmptyState
            title={t('resultDetail.noAnswersTitle')}
            description={t('resultDetail.noAnswersDescription')}
          />
        ) : (
          <Surface className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('questions.code')}</TableHead>
                  <TableHead scope="col">{t('questions.stem')}</TableHead>
                  <TableHead scope="col">{t('resultDetail.response')}</TableHead>
                  <TableHead scope="col">{t('resultDetail.awarded')}</TableHead>
                  <TableHead scope="col">{t('common.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.answers.map((answer) => (
                  <TableRow key={answer.id}>
                    <TableCell className="font-mono text-xs">{answer.questionCode ?? '—'}</TableCell>
                    <TableCell className="max-w-xs truncate">{answer.stem}</TableCell>
                    <TableCell className="max-w-xs truncate">{formatResponse(answer.response)}</TableCell>
                    <TableCell>
                      {answer.scoreAwarded}/{answer.maxScore}
                    </TableCell>
                    <TableCell>
                      {answer.needsReview ? (
                        <Badge variant="warning">{t('resultDetail.needsReview')}</Badge>
                      ) : answer.isCorrect ? (
                        <Badge variant="success">{t('resultDetail.correct')}</Badge>
                      ) : (
                        <Badge variant="destructive">{t('resultDetail.incorrect')}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        )}
      </section>
    </PageMotion>
  );
}
