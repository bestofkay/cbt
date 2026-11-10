import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, EmptyState, PageHeader, Spinner, Surface } from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface NotificationItem {
  id: string;
  channel: string;
  subject?: string | null;
  body?: string | null;
  status: string;
  createdAt: string;
  sentAt?: string | null;
}

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  priority: number;
  startsAt: string;
  endsAt?: string | null;
}

function notificationStatusVariant(status: string) {
  if (status === 'SENT' || status === 'DELIVERED') return 'success' as const;
  if (status === 'FAILED') return 'destructive' as const;
  if (status === 'PENDING' || status === 'QUEUED') return 'warning' as const;
  return 'outline' as const;
}

export function NotificationsPage() {
  const { t } = useTranslation();

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: NotificationItem[] }>('/api/v1/notifications'),
  });

  const announcementsQuery = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get<{ data: AnnouncementItem[] }>('/api/v1/announcements'),
  });

  const notifications = notificationsQuery.data?.data ?? [];
  const announcements = announcementsQuery.data?.data ?? [];

  return (
    <PageMotion className="space-y-10">
      <PageHeader title={t('notifications.title')} description={t('notifications.description')} />

      <section aria-labelledby="announcements-heading" className="space-y-4">
        <h2 id="announcements-heading" className="font-serif text-lg font-semibold text-primary-950">
          {t('notifications.announcements')}
        </h2>

        {announcementsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        ) : announcementsQuery.isError ? (
          <Alert variant="error">{t('common.error')}</Alert>
        ) : announcements.length === 0 ? (
          <EmptyState
            title={t('notifications.noAnnouncementsTitle')}
            description={t('notifications.noAnnouncementsDescription')}
          />
        ) : (
          <ul className="space-y-3">
            {announcements.map((announcement) => (
              <li key={announcement.id}>
                <Surface className="border-primary-200 bg-primary-50/40 p-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="font-medium text-primary-950">{announcement.title}</h3>
                    <time className="text-xs text-slate-500" dateTime={announcement.startsAt}>
                      {new Date(announcement.startsAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{announcement.body}</p>
                </Surface>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="inbox-heading" className="space-y-4">
        <h2 id="inbox-heading" className="font-serif text-lg font-semibold text-primary-950">
          {t('notifications.inbox')}
        </h2>

        {notificationsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        ) : notificationsQuery.isError ? (
          <Alert variant="error">{t('common.error')}</Alert>
        ) : notifications.length === 0 ? (
          <EmptyState
            title={t('notifications.emptyTitle')}
            description={t('notifications.emptyDescription')}
          />
        ) : (
          <ul className="space-y-3">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Surface className="p-4">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-slate-900">
                      {notification.subject ?? t('notifications.noSubject')}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={notificationStatusVariant(notification.status)}>
                        {notification.status}
                      </Badge>
                      <time className="text-xs text-slate-500" dateTime={notification.createdAt}>
                        {new Date(notification.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </div>
                  {notification.body ? (
                    <p className="whitespace-pre-wrap text-sm text-slate-600">{notification.body}</p>
                  ) : null}
                </Surface>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageMotion>
  );
}
