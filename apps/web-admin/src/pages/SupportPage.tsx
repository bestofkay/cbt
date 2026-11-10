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
  Textarea,
} from '@cbt/ui';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface SupportTicket {
  id: string;
  number: string;
  subject: string;
  priority: string;
  status: string;
  requesterName: string;
  createdAt: string;
}

const createTicketSchema = z.object({
  subject: z.string().min(1).max(250),
  body: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

type CreateTicketForm = z.infer<typeof createTicketSchema>;

function priorityVariant(p: string) {
  if (p === 'URGENT') return 'destructive' as const;
  if (p === 'HIGH') return 'warning' as const;
  return 'secondary' as const;
}

function statusVariant(status: string) {
  if (status === 'OPEN') return 'accent' as const;
  if (status === 'RESOLVED' || status === 'CLOSED') return 'success' as const;
  if (status === 'IN_PROGRESS') return 'warning' as const;
  return 'outline' as const;
}

export function SupportPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () =>
      api.get<PaginatedResponse<SupportTicket>>('/api/v1/support/tickets?page=1&pageSize=50'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { priority: 'MEDIUM' },
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateTicketForm) => api.post('/api/v1/support/tickets', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setDialogOpen(false);
      reset({ priority: 'MEDIUM', subject: '', body: '' });
    },
  });

  const tickets = data?.data ?? [];

  return (
    <PageMotion className="space-y-6">
      <PageHeader
        title={t('support.title')}
        description={t('support.description')}
        actions={<Button onClick={() => setDialogOpen(true)}>{t('support.createTicket')}</Button>}
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
      ) : tickets.length === 0 ? (
        <EmptyState
          title={t('support.emptyTitle')}
          description={t('support.emptyDescription')}
          action={<Button onClick={() => setDialogOpen(true)}>{t('support.createTicket')}</Button>}
        />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('support.ticketNumber')}</TableHead>
                <TableHead scope="col">{t('support.subject')}</TableHead>
                <TableHead scope="col">{t('support.priority')}</TableHead>
                <TableHead scope="col">{t('common.status')}</TableHead>
                <TableHead scope="col">{t('support.requester')}</TableHead>
                <TableHead scope="col">{t('support.created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <Link
                      to={`/support/${ticket.id}`}
                      className="font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {ticket.number}
                    </Link>
                  </TableCell>
                  <TableCell>{ticket.subject}</TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(ticket.priority)}>{ticket.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(ticket.status)}>{ticket.status}</Badge>
                  </TableCell>
                  <TableCell>{ticket.requesterName}</TableCell>
                  <TableCell>{new Date(ticket.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('support.createTicket')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject" required>
                {t('support.subject')}
              </Label>
              <Input id="subject" {...register('subject')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">{t('support.priority')}</Label>
              <Select id="priority" {...register('priority')}>
                <option value="LOW">{t('support.priorities.low')}</option>
                <option value="MEDIUM">{t('support.priorities.medium')}</option>
                <option value="HIGH">{t('support.priorities.high')}</option>
                <option value="URGENT">{t('support.priorities.urgent')}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="body" required>
                {t('support.message')}
              </Label>
              <Textarea id="body" rows={5} {...register('body')} />
            </div>
            {createMutation.isError ? (
              <Alert variant="error">{(createMutation.error as Error).message}</Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
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
    </PageMotion>
  );
}
