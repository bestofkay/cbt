import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
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
import { PageMotion } from '@/components/PageMotion';

interface ExamTemplate {
  id: string;
  code: string;
  title: string;
}

interface ExamSession {
  id: string;
  name: string;
  examTitle: string;
  startsAt: string | null;
  endsAt: string | null;
  candidateCount: number;
  status: string;
}

interface UserOption {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  candidateId?: string | null;
}

const createSessionSchema = z.object({
  examTemplateId: z.string().uuid(),
  name: z.string().min(1).max(200),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  accessCode: z.string().optional(),
});

const inviteSchema = z.object({
  candidateId: z.string().uuid(),
  email: z.string().email(),
});

type CreateSessionForm = z.infer<typeof createSessionSchema>;
type InviteForm = z.infer<typeof inviteSchema>;

export function SessionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSessionId, setInviteSessionId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exam-sessions'],
    queryFn: () =>
      api.get<PaginatedResponse<ExamSession>>('/api/v1/exams/sessions?page=1&pageSize=50'),
  });

  const { data: templates } = useQuery({
    queryKey: ['exam-templates-select'],
    queryFn: () =>
      api.get<PaginatedResponse<ExamTemplate>>('/api/v1/exams/templates?page=1&pageSize=100'),
  });

  const [inviteEmailLookup, setInviteEmailLookup] = useState('');

  const { data: inviteUserResults } = useQuery({
    queryKey: ['invite-user-lookup', inviteEmailLookup],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', pageSize: '10', search: inviteEmailLookup.trim() });
      return api.get<PaginatedResponse<UserOption>>(`/api/v1/admin/users?${params}`);
    },
    enabled: inviteEmailLookup.trim().length >= 2,
  });

  const createForm = useForm<CreateSessionForm>({ resolver: zodResolver(createSessionSchema) });
  const inviteForm = useForm<InviteForm>({ resolver: zodResolver(inviteSchema) });

  const createMutation = useMutation({
    mutationFn: (body: CreateSessionForm) =>
      api.post('/api/v1/sessions', {
        examTemplateId: body.examTemplateId,
        name: body.name,
        startsAt: body.startsAt ? new Date(body.startsAt).toISOString() : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt).toISOString() : undefined,
        accessCode: body.accessCode || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
      setCreateOpen(false);
      createForm.reset();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: ({ sessionId, body }: { sessionId: string; body: InviteForm }) =>
      api.post(`/api/v1/sessions/${sessionId}/invite`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
      setInviteOpen(false);
      setInviteSessionId(null);
      inviteForm.reset();
    },
  });

  const sessions = data?.data ?? [];

  const openInvite = (sessionId: string) => {
    setInviteSessionId(sessionId);
    setInviteOpen(true);
  };

  return (
    <PageMotion className="space-y-6">
      <PageHeader
        title={t('sessions.title')}
        description={t('sessions.description')}
        actions={<Button onClick={() => setCreateOpen(true)}>{t('sessions.createSession')}</Button>}
      />

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
      ) : sessions.length === 0 ? (
        <EmptyState
          title={t('sessions.emptyTitle')}
          description={t('sessions.emptyDescription')}
          action={<Button onClick={() => setCreateOpen(true)}>{t('sessions.createSession')}</Button>}
        />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('sessions.sessionName')}</TableHead>
                <TableHead scope="col">{t('sessions.exam')}</TableHead>
                <TableHead scope="col">{t('sessions.startsAt')}</TableHead>
                <TableHead scope="col">{t('sessions.endsAt')}</TableHead>
                <TableHead scope="col">{t('sessions.candidates')}</TableHead>
                <TableHead scope="col">{t('common.status')}</TableHead>
                <TableHead scope="col">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/sessions/${session.id}`}
                      className="text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {session.name}
                    </Link>
                  </TableCell>
                  <TableCell>{session.examTitle}</TableCell>
                  <TableCell>
                    {session.startsAt ? new Date(session.startsAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    {session.endsAt ? new Date(session.endsAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>{session.candidateCount}</TableCell>
                  <TableCell>
                    <Badge variant={session.status === 'LIVE' ? 'accent' : 'secondary'}>
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link
                        to={`/sessions/${session.id}`}
                        className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        {t('common.view')}
                      </Link>
                      <Button type="button" variant="outline" size="sm" onClick={() => openInvite(session.id)}>
                        {t('sessions.invite')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('sessions.createSession')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="examTemplateId" required>
                {t('sessions.examTemplate')}
              </Label>
              <Select id="examTemplateId" {...createForm.register('examTemplateId')} defaultValue="">
                <option value="" disabled>
                  {t('sessions.selectExam')}
                </option>
                {(templates?.data ?? []).map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.code} — {exam.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sessionName" required>
                {t('sessions.sessionName')}
              </Label>
              <Input id="sessionName" {...createForm.register('name')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startsAt">{t('sessions.startsAt')}</Label>
                <Input id="startsAt" type="datetime-local" {...createForm.register('startsAt')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">{t('sessions.endsAt')}</Label>
                <Input id="endsAt" type="datetime-local" {...createForm.register('endsAt')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessCode">{t('sessions.accessCode')}</Label>
              <Input id="accessCode" {...createForm.register('accessCode')} />
            </div>
            {createMutation.isError ? (
              <Alert variant="error">{(createMutation.error as Error).message}</Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : (
                  t('common.create')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sessions.inviteCandidate')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={inviteForm.handleSubmit((values) => {
              if (inviteSessionId) {
                inviteMutation.mutate({ sessionId: inviteSessionId, body: values });
              }
            })}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="candidateId" required>
                {t('sessions.candidateId')}
              </Label>
              <Input
                id="candidateId"
                placeholder="00000000-0000-0000-0000-000000000000"
                {...inviteForm.register('candidateId')}
              />
              <p className="text-xs text-slate-500">{t('sessions.candidateIdHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteEmailLookup">{t('sessions.emailLookup')}</Label>
              <Input
                id="inviteEmailLookup"
                value={inviteEmailLookup}
                onChange={(e) => setInviteEmailLookup(e.target.value)}
                placeholder={t('sessions.emailLookupPlaceholder')}
              />
              {(inviteUserResults?.data.length ?? 0) > 0 && inviteEmailLookup.trim().length >= 2 ? (
                <ul className="max-h-28 overflow-y-auto rounded-md border border-slate-200" role="listbox">
                  {inviteUserResults!.data.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        role="option"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        onClick={() => {
                          if (user.candidateId) {
                            inviteForm.setValue('candidateId', user.candidateId, {
                              shouldValidate: true,
                            });
                          }
                          inviteForm.setValue('email', user.email, { shouldValidate: true });
                          setInviteEmailLookup(`${user.firstName} ${user.lastName} (${user.email})`);
                        }}
                      >
                        {user.firstName} {user.lastName} — {user.email}
                        {!user.candidateId ? ' (no candidate profile)' : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteEmail" required>
                {t('auth.email')}
              </Label>
              <Input id="inviteEmail" type="email" {...inviteForm.register('email')} />
            </div>
            {inviteMutation.isError ? (
              <Alert variant="error">{(inviteMutation.error as Error).message}</Alert>
            ) : null}
            {inviteMutation.isSuccess ? (
              <Alert variant="success">{t('sessions.inviteSent')}</Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : (
                  t('sessions.sendInvite')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageMotion>
  );
}
