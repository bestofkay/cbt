import { Link, useNavigate } from 'react-router-dom';
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
} from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion, StaggerItem } from '@/components/PageMotion';

interface DashboardStats {
  totalUsers: number;
  activeExams: number;
  liveSessions: number;
  completedAttempts: number;
  recentActivity: Array<{ id: string; summary?: string; message?: string; createdAt: string }>;
}

const statLinks = [
  { key: 'totalUsers' as const, labelKey: 'dashboard.totalUsers', to: '/users', hintKey: 'dashboard.totalUsersHint' },
  { key: 'activeExams' as const, labelKey: 'dashboard.activeExams', to: '/exams', hintKey: 'dashboard.activeExamsHint' },
  { key: 'liveSessions' as const, labelKey: 'dashboard.liveSessions', to: '/sessions', hintKey: 'dashboard.liveSessionsHint' },
  { key: 'completedAttempts' as const, labelKey: 'dashboard.completedAttempts', to: '/results', hintKey: 'dashboard.completedAttemptsHint' },
];

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/api/v1/admin/dashboard/stats'),
  });

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
        <Alert variant="error">
          <p>{t('common.error')}</p>
          <Button type="button" variant="link" className="mt-2 h-auto p-0" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </Alert>
      </PageMotion>
    );
  }

  const activity = data.recentActivity ?? [];

  return (
    <PageMotion className="space-y-8">
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          {t('dashboard.statsHeading')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statLinks.map((stat, index) => (
            <StaggerItem key={stat.key} index={index}>
              <Link
                to={stat.to}
                className="block rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <StatTile
                  label={t(stat.labelKey)}
                  value={data[stat.key].toLocaleString()}
                  hint={t(stat.hintKey)}
                />
              </Link>
            </StaggerItem>
          ))}
        </div>
      </section>

      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="mb-3 font-serif text-lg font-semibold text-primary-950">
          {t('dashboard.quickActions')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => navigate('/exams')}>
            {t('dashboard.createExam')}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/sessions')}>
            {t('dashboard.newSession')}
          </Button>
          <Button type="button" variant="accent" onClick={() => navigate('/support')}>
            {t('dashboard.inviteSupport')}
          </Button>
        </div>
      </section>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="mb-4 font-serif text-lg font-semibold text-primary-950">
          {t('dashboard.recentActivity')}
        </h2>
        {activity.length === 0 ? (
          <EmptyState
            title={t('dashboard.noActivityTitle')}
            description={t('dashboard.noActivityDescription')}
          />
        ) : (
          <Surface className="divide-y divide-slate-100 p-0">
            <ul aria-label={t('dashboard.recentActivity')}>
              {activity.map((item) => (
                <li key={item.id} className="px-5 py-4 text-sm">
                  <span className="text-slate-700">{item.summary ?? item.message}</span>
                  <time className="ml-2 text-slate-400" dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </section>
    </PageMotion>
  );
}
