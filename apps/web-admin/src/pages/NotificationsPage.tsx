import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Spinner,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
} from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface NotificationItem {
  id: string;
  channel: string;
  subject: string | null;
  body: string | null;
  status: string;
  createdAt: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: number;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}

const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  priority: z.coerce.number().int().default(0),
  endsAt: z.string().optional(),
});
type AnnouncementForm = z.infer<typeof announcementSchema>;

const sendSchema = z.object({
  userId: z.string().uuid().optional().or(z.literal('')),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
});
type SendForm = z.infer<typeof sendSchema>;

export function NotificationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('inbox');

  const tabs = [
    { id: 'inbox', label: t('notifications.tabs.inbox') },
    { id: 'announcements', label: t('notifications.tabs.announcements') },
    { id: 'send', label: t('notifications.tabs.send') },
  ];

  const { data: inbox, isLoading: inboxLoading, isError: inboxError } = useQuery({
    queryKey: ['notifications-inbox'],
    queryFn: () => api.get<{ data: NotificationItem[] }>('/api/v1/notifications'),
    enabled: tab === 'inbox',
  });

  const { data: announcements, isLoading: announcementsLoading, isError: announcementsError } = useQuery({
    queryKey: ['announcements-admin'],
    queryFn: () => api.get<{ data: Announcement[] }>('/api/v1/admin/announcements'),
    enabled: tab === 'announcements',
  });

  const announcementForm = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', body: '', priority: 0, endsAt: '' },
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: (values: AnnouncementForm) =>
      api.post('/api/v1/announcements', {
        title: values.title,
        body: values.body,
        priority: values.priority,
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements-admin'] });
      announcementForm.reset({ title: '', body: '', priority: 0, endsAt: '' });
    },
  });

  const sendForm = useForm<SendForm>({
    resolver: zodResolver(sendSchema),
    defaultValues: { userId: '', subject: '', body: '' },
  });

  const sendMutation = useMutation({
    mutationFn: (values: SendForm) =>
      api.post('/api/v1/notifications/send', {
        channel: 'IN_APP',
        userId: values.userId || undefined,
        subject: values.subject,
        body: values.body,
      }),
    onSuccess: () => sendForm.reset({ userId: '', subject: '', body: '' }),
  });

  return (
    <PageMotion className="space-y-6">
      <PageHeader title={t('notifications.title')} description={t('notifications.description')} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'inbox' ? (
        inboxLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        ) : inboxError ? (
          <Alert variant="error">{t('common.error')}</Alert>
        ) : (inbox?.data.length ?? 0) === 0 ? (
          <EmptyState title={t('notifications.emptyInboxTitle')} description={t('notifications.emptyInboxDescription')} />
        ) : (
          <Surface className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('notifications.channel')}</TableHead>
                  <TableHead scope="col">{t('notifications.subject')}</TableHead>
                  <TableHead scope="col">{t('common.status')}</TableHead>
                  <TableHead scope="col">{t('users.created')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inbox!.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="secondary">{item.channel}</Badge>
                    </TableCell>
                    <TableCell className="max-w-sm truncate">{item.subject ?? item.body ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'SENT' ? 'success' : 'outline'}>{item.status}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        )
      ) : null}

      {tab === 'announcements' ? (
        <div className="space-y-6">
          <Surface className="max-w-2xl space-y-4 p-6">
            <h2 className="font-serif text-lg font-semibold text-primary-950">
              {t('notifications.createAnnouncement')}
            </h2>
            <form
              onSubmit={announcementForm.handleSubmit((values) =>
                createAnnouncementMutation.mutate(values),
              )}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="announcement-title" required>
                  {t('notifications.announcementTitle')}
                </Label>
                <Input id="announcement-title" {...announcementForm.register('title')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement-body" required>
                  {t('notifications.announcementBody')}
                </Label>
                <Textarea id="announcement-body" rows={3} {...announcementForm.register('body')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="announcement-priority">{t('notifications.priority')}</Label>
                  <Input id="announcement-priority" type="number" {...announcementForm.register('priority')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-endsAt">{t('notifications.endsAt')}</Label>
                  <Input
                    id="announcement-endsAt"
                    type="datetime-local"
                    {...announcementForm.register('endsAt')}
                  />
                </div>
              </div>
              {createAnnouncementMutation.isError ? (
                <Alert variant="error">{(createAnnouncementMutation.error as Error).message}</Alert>
              ) : null}
              <Button type="submit" disabled={createAnnouncementMutation.isPending}>
                {createAnnouncementMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : (
                  t('notifications.publish')
                )}
              </Button>
            </form>
          </Surface>

          {announcementsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" label={t('common.loading')} />
            </div>
          ) : announcementsError ? (
            <Alert variant="error">{t('common.error')}</Alert>
          ) : (announcements?.data.length ?? 0) === 0 ? (
            <EmptyState
              title={t('notifications.emptyAnnouncementsTitle')}
              description={t('notifications.emptyAnnouncementsDescription')}
            />
          ) : (
            <Surface className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t('notifications.announcementTitle')}</TableHead>
                    <TableHead scope="col">{t('notifications.priority')}</TableHead>
                    <TableHead scope="col">{t('notifications.endsAt')}</TableHead>
                    <TableHead scope="col">{t('users.created')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements!.data.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>{a.priority}</TableCell>
                      <TableCell>{a.endsAt ? new Date(a.endsAt).toLocaleString() : '—'}</TableCell>
                      <TableCell className="text-slate-500">
                        {new Date(a.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Surface>
          )}
        </div>
      ) : null}

      {tab === 'send' ? (
        <Surface className="max-w-2xl space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold text-primary-950">
            {t('notifications.sendNotification')}
          </h2>
          <form onSubmit={sendForm.handleSubmit((values) => sendMutation.mutate(values))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="send-userId">{t('notifications.targetUserId')}</Label>
              <Input
                id="send-userId"
                placeholder="00000000-0000-0000-0000-000000000000"
                {...sendForm.register('userId')}
              />
              <p className="text-xs text-slate-500">{t('notifications.targetUserIdHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-subject" required>
                {t('notifications.subject')}
              </Label>
              <Input id="send-subject" {...sendForm.register('subject')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-body" required>
                {t('notifications.messageBody')}
              </Label>
              <Textarea id="send-body" rows={3} {...sendForm.register('body')} />
            </div>
            {sendMutation.isError ? (
              <Alert variant="error">{(sendMutation.error as Error).message}</Alert>
            ) : null}
            {sendMutation.isSuccess ? <Alert variant="success">{t('notifications.sent')}</Alert> : null}
            <Button type="submit" disabled={sendMutation.isPending}>
              {sendMutation.isPending ? (
                <Spinner size="sm" label={t('common.loading')} />
              ) : (
                t('notifications.send')
              )}
            </Button>
          </form>
        </Surface>
      ) : null}
    </PageMotion>
  );
}
