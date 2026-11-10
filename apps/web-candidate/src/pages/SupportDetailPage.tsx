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
  EmptyState,
  Label,
  PageHeader,
  Spinner,
  Surface,
  Textarea,
} from '@cbt/ui';
import { api, ApiError } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface TicketMessage {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author?: { firstName: string; lastName: string; email: string };
}

interface TicketDetail {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  messages: TicketMessage[];
}

const messageSchema = z.object({
  body: z.string().min(1),
});

type MessageForm = z.infer<typeof messageSchema>;

function priorityVariant(p: string) {
  if (p === 'URGENT') return 'destructive' as const;
  if (p === 'HIGH') return 'warning' as const;
  return 'secondary' as const;
}

function statusVariant(status: string) {
  if (status === 'OPEN') return 'accent' as const;
  if (status === 'RESOLVED' || status === 'CLOSED') return 'success' as const;
  if (status === 'IN_PROGRESS' || status === 'WAITING') return 'warning' as const;
  return 'outline' as const;
}

export function SupportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['support-ticket', id],
    queryFn: () => api.get<TicketDetail>(`/api/v1/support/tickets/${id}`),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<MessageForm>({ resolver: zodResolver(messageSchema) });

  const messageMutation = useMutation({
    mutationFn: (body: MessageForm) =>
      api.post(`/api/v1/support/tickets/${id}/messages`, { body: body.body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      reset();
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('common.error')),
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
      <PageMotion className="space-y-4">
        <Alert variant="error">{t('common.error')}</Alert>
        <Link
          to="/support"
          className="inline-block text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t('support.backToList')}
        </Link>
      </PageMotion>
    );
  }

  return (
    <PageMotion className="space-y-6">
      <div>
        <Link
          to="/support"
          className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t('support.backToList')}
        </Link>
      </div>

      <PageHeader
        title={data.subject}
        description={`${data.number} · ${new Date(data.createdAt).toLocaleString()}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={priorityVariant(data.priority)}>{data.priority}</Badge>
            <Badge variant={statusVariant(data.status)}>{data.status}</Badge>
          </div>
        }
      />

      <section aria-labelledby="messages-heading">
        <h2 id="messages-heading" className="mb-4 font-serif text-lg font-semibold text-primary-950">
          {t('support.conversation')}
        </h2>

        {data.messages.length === 0 ? (
          <EmptyState title={t('support.noMessagesTitle')} description={t('support.noMessagesDescription')} />
        ) : (
          <ul className="space-y-3" aria-label={t('support.conversation')}>
            {data.messages
              .filter((message) => !message.isInternal)
              .map((message) => (
                <li key={message.id}>
                  <Surface className="p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-900">
                        {message.author
                          ? `${message.author.firstName} ${message.author.lastName}`
                          : t('support.unknownAuthor')}
                      </span>
                      <time className="text-slate-500" dateTime={message.createdAt}>
                        {new Date(message.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{message.body}</p>
                  </Surface>
                </li>
              ))}
          </ul>
        )}
      </section>

      <Surface className="p-5">
        <h3 className="mb-3 font-serif text-base font-semibold text-primary-950">
          {t('support.reply')}
        </h3>
        <form onSubmit={handleSubmit((values) => messageMutation.mutate(values))} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reply-body" required>
              {t('support.message')}
            </Label>
            <Textarea id="reply-body" rows={4} {...register('body')} />
          </div>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <Button type="submit" disabled={isSubmitting || messageMutation.isPending}>
            {messageMutation.isPending ? (
              <Spinner size="sm" label={t('common.loading')} />
            ) : (
              t('support.sendReply')
            )}
          </Button>
        </form>
      </Surface>
    </PageMotion>
  );
}
