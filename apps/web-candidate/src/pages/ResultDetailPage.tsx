import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  PageHeader,
  Separator,
  Spinner,
  StatTile,
  Surface,
} from '@cbt/ui';
import { api } from '@/lib/api';

interface ResultDetail {
  id: string;
  examTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
  durationMinutes?: number;
  sections: Array<{
    title: string;
    score: number;
    maxScore: number;
  }>;
  certificate?: {
    id: string;
    certificateNo: string;
  } | null;
}

export function ResultDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['candidate-result', id],
    queryFn: () => api.get<ResultDetail>(`/api/v1/candidate/results/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{t('common.error')}</Alert>
        <Link
          to="/results"
          className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t('results.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div>
        <Link
          to="/results"
          className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t('results.backToList')}
        </Link>
      </div>

      <PageHeader
        title={data.examTitle}
        description={t('results.detailDescription')}
        actions={
          <Badge variant={data.passed ? 'success' : 'destructive'}>
            {data.passed ? t('results.passed') : t('results.failed')}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label={t('results.score')}
          value={`${data.score}/${data.maxScore}`}
          hint={`${data.percentage}%`}
        />
        <StatTile
          label={t('results.submitted')}
          value={new Date(data.submittedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          hint={new Date(data.submittedAt).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}
        />
        {data.durationMinutes != null ? (
          <StatTile
            label={t('results.duration')}
            value={t('lobby.durationValue', { minutes: data.durationMinutes })}
          />
        ) : null}
      </div>

      {data.sections.length > 0 ? (
        <Surface className="p-6">
          <h2 className="font-serif text-lg font-semibold text-primary-950">
            {t('results.sectionBreakdown')}
          </h2>
          <Separator className="my-4" />
          <ul className="divide-y divide-slate-100">
            {data.sections.map((section) => (
              <li key={section.title} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium text-slate-800">{section.title}</span>
                <span className="tabular-nums text-slate-600">
                  {section.score}/{section.maxScore}
                </span>
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}

      {data.certificate ? (
        <Surface className="border-primary-200 bg-primary-50/40 p-6">
          <h2 className="font-serif text-lg font-semibold text-primary-950">
            {t('results.certificate')}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{t('results.certificateDescription')}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t('results.certificateNumber')}</dt>
              <dd className="font-mono font-medium text-primary-900">
                {data.certificate.certificateNo}
              </dd>
            </div>
          </dl>
        </Surface>
      ) : null}
    </motion.div>
  );
}
