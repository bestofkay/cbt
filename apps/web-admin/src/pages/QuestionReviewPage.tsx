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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
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
  Textarea,
} from '@cbt/ui';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface ReviewQuestion {
  id: string;
  code: string;
  type: string;
  difficulty: string;
  status: string;
  bank?: { id: string; name: string; code: string } | null;
  author?: { id: string; firstName: string; lastName: string; email: string } | null;
  versions?: Array<{ stem: string }>;
}

const reviewSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(2000).optional(),
});

type ReviewForm = z.infer<typeof reviewSchema>;

export function QuestionReviewPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reviewTarget, setReviewTarget] = useState<ReviewQuestion | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['question-reviews'],
    queryFn: () =>
      api.get<PaginatedResponse<ReviewQuestion>>(
        '/api/v1/reviews/questions?status=IN_REVIEW&page=1&pageSize=50',
      ),
  });

  const form = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { action: 'APPROVED', notes: '' },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReviewForm }) =>
      api.post(`/api/v1/questions/${id}/review`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-reviews'] });
      setReviewTarget(null);
      form.reset({ action: 'APPROVED', notes: '' });
    },
  });

  const openReview = (question: ReviewQuestion, action: 'APPROVED' | 'REJECTED') => {
    setReviewTarget(question);
    setReviewAction(action);
    form.reset({ action, notes: '' });
  };

  const questions = data?.data ?? [];

  return (
    <PageMotion className="space-y-6">
      <PageHeader
        title={t('questionReview.title')}
        description={t('questionReview.description')}
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
      ) : questions.length === 0 ? (
        <EmptyState
          title={t('questionReview.emptyTitle')}
          description={t('questionReview.emptyDescription')}
        />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('questions.code')}</TableHead>
                <TableHead scope="col">{t('questionReview.stemPreview')}</TableHead>
                <TableHead scope="col">{t('questionReview.bank')}</TableHead>
                <TableHead scope="col">{t('questionReview.author')}</TableHead>
                <TableHead scope="col">{t('common.status')}</TableHead>
                <TableHead scope="col">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm">{q.code}</TableCell>
                  <TableCell className="max-w-xs truncate">{q.versions?.[0]?.stem ?? '—'}</TableCell>
                  <TableCell>{q.bank ? `${q.bank.name}` : '—'}</TableCell>
                  <TableCell>
                    {q.author ? `${q.author.firstName} ${q.author.lastName}` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="warning">{q.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openReview(q, 'APPROVED')}
                      >
                        {t('questionReview.approve')}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => openReview(q, 'REJECTED')}
                      >
                        {t('questionReview.reject')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}

      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'APPROVED'
                ? t('questionReview.approveTitle')
                : t('questionReview.rejectTitle')}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((values) => {
              if (reviewTarget) {
                reviewMutation.mutate({ id: reviewTarget.id, body: values });
              }
            })}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('action')} />
            {reviewTarget ? (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                {reviewTarget.versions?.[0]?.stem ?? reviewTarget.code}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('questionReview.notes')}</Label>
              <Textarea id="notes" rows={3} {...form.register('notes')} />
            </div>
            {reviewMutation.isError ? (
              <Alert variant="error">{(reviewMutation.error as Error).message}</Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReviewTarget(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant={reviewAction === 'REJECTED' ? 'destructive' : 'default'}
                disabled={reviewMutation.isPending}
              >
                {reviewMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : reviewAction === 'APPROVED' ? (
                  t('questionReview.approve')
                ) : (
                  t('questionReview.reject')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageMotion>
  );
}
