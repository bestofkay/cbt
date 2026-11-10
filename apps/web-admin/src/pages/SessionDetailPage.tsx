import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

interface Invitation {
  id: string;
  email: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  candidateId: string;
  candidateName: string | null;
}

interface AttemptRow {
  id: string;
  status: string;
  attemptNumber: number;
  startedAt: string | null;
  submittedAt: string | null;
  scorePercent: number | null;
  passed: boolean | null;
  candidateName: string;
  candidateEmail: string;
  resultId: string | null;
}

interface AccessCode {
  id: string;
  label: string;
  useCount: number;
  maxUses: number | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

interface SessionDetail {
  id: string;
  name: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  examTitle: string;
  candidateCount: number;
  invitationCount: number;
  invitations: Invitation[];
  attempts: AttemptRow[];
  accessCodes: AccessCode[];
}

interface UserOption {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  candidateId?: string | null;
}

const inviteSchema = z.object({
  candidateId: z.string().uuid(),
  email: z.string().email(),
});

type InviteForm = z.infer<typeof inviteSchema>;

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmailLookup, setInviteEmailLookup] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['session-detail', id],
    queryFn: () => api.get<SessionDetail>(`/api/v1/sessions/${id}`),
    enabled: !!id,
  });

  const { data: inviteUserResults } = useQuery({
    queryKey: ['invite-user-lookup', inviteEmailLookup],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', pageSize: '10', search: inviteEmailLookup.trim() });
      return api.get<PaginatedResponse<UserOption>>(`/api/v1/admin/users?${params}`);
    },
    enabled: inviteEmailLookup.trim().length >= 2,
  });

  const inviteForm = useForm<InviteForm>({ resolver: zodResolver(inviteSchema) });

  const inviteMutation = useMutation({
    mutationFn: (body: InviteForm) => api.post(`/api/v1/sessions/${id}/invite`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-detail', id] });
      setInviteOpen(false);
      inviteForm.reset();
      setInviteEmailLookup('');
    },
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
        <Alert variant="error">{t('common.error')}</Alert>
      </PageMotion>
    );
  }

  return (
    <PageMotion className="space-y-8">
      <div>
        <Link
          to="/sessions"
          className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('sessionDetail.backToList')}
        </Link>
      </div>

      <PageHeader
        title={data.name}
        description={data.examTitle}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={data.status === 'LIVE' ? 'accent' : 'secondary'}>{data.status}</Badge>
            <Button type="button" onClick={() => setInviteOpen(true)}>
              {t('sessions.invite')}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
        <p>
          <span className="font-medium text-slate-900">{t('sessions.startsAt')}:</span>{' '}
          {data.startsAt ? new Date(data.startsAt).toLocaleString() : '—'}
        </p>
        <p>
          <span className="font-medium text-slate-900">{t('sessions.endsAt')}:</span>{' '}
          {data.endsAt ? new Date(data.endsAt).toLocaleString() : '—'}
        </p>
        <p>
          <span className="font-medium text-slate-900">{t('sessionDetail.invitations')}:</span>{' '}
          {data.invitationCount}
        </p>
      </div>

      <section aria-labelledby="invitations-heading">
        <h2 id="invitations-heading" className="mb-4 font-serif text-lg font-semibold text-primary-950">
          {t('sessionDetail.invitations')}
        </h2>
        {data.invitations.length === 0 ? (
          <EmptyState
            title={t('sessionDetail.noInvitationsTitle')}
            description={t('sessionDetail.noInvitationsDescription')}
          />
        ) : (
          <Surface className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('auth.email')}</TableHead>
                  <TableHead scope="col">{t('sessionDetail.candidate')}</TableHead>
                  <TableHead scope="col">{t('common.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>{inv.candidateName ?? '—'}</TableCell>
                    <TableCell>
                      {inv.revokedAt ? (
                        <Badge variant="destructive">{t('sessionDetail.revoked')}</Badge>
                      ) : inv.acceptedAt ? (
                        <Badge variant="success">{t('sessionDetail.accepted')}</Badge>
                      ) : (
                        <Badge variant="outline">{t('sessionDetail.pending')}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        )}
      </section>

      <section aria-labelledby="attempts-heading">
        <h2 id="attempts-heading" className="mb-4 font-serif text-lg font-semibold text-primary-950">
          {t('sessionDetail.attempts')}
        </h2>
        {data.attempts.length === 0 ? (
          <EmptyState
            title={t('sessionDetail.noAttemptsTitle')}
            description={t('sessionDetail.noAttemptsDescription')}
          />
        ) : (
          <Surface className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('results.candidate')}</TableHead>
                  <TableHead scope="col">{t('sessionDetail.attemptNumber')}</TableHead>
                  <TableHead scope="col">{t('common.status')}</TableHead>
                  <TableHead scope="col">{t('results.score')}</TableHead>
                  <TableHead scope="col">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{attempt.candidateName}</p>
                        <p className="text-xs text-slate-500">{attempt.candidateEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>{attempt.attemptNumber}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{attempt.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {attempt.scorePercent != null ? `${attempt.scorePercent}%` : '—'}
                    </TableCell>
                    <TableCell>
                      {attempt.resultId ? (
                        <Link
                          to={`/results/${attempt.resultId}`}
                          className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                          {t('common.view')}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        )}
      </section>

      <section aria-labelledby="access-codes-heading">
        <h2 id="access-codes-heading" className="mb-4 font-serif text-lg font-semibold text-primary-950">
          {t('sessionDetail.accessCodes')}
        </h2>
        {data.accessCodes.length === 0 ? (
          <EmptyState
            title={t('sessionDetail.noCodesTitle')}
            description={t('sessionDetail.noCodesDescription')}
          />
        ) : (
          <Surface className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('sessionDetail.codeLabel')}</TableHead>
                  <TableHead scope="col">{t('sessionDetail.uses')}</TableHead>
                  <TableHead scope="col">{t('sessionDetail.expiresAt')}</TableHead>
                  <TableHead scope="col">{t('common.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.accessCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-medium">{code.label}</TableCell>
                    <TableCell>
                      {code.useCount}
                      {code.maxUses != null ? ` / ${code.maxUses}` : ''}
                    </TableCell>
                    <TableCell>
                      {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={code.revokedAt ? 'destructive' : 'success'}>
                        {code.revokedAt ? t('sessionDetail.revoked') : t('sessionDetail.active')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        )}
      </section>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sessions.inviteCandidate')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={inviteForm.handleSubmit((values) => inviteMutation.mutate(values))}
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
            {inviteMutation.isSuccess ? <Alert variant="success">{t('sessions.inviteSent')}</Alert> : null}
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
