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
  Textarea,
} from '@cbt/ui';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface ManualReviewItem {
  id: string;
  status: string;
  score: number | null;
  feedback: string | null;
  createdAt: string;
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  question: {
    id: string;
    code: string;
    type: string;
    stem: string;
    maxScore: number;
  } | null;
  response: unknown;
}

const gradeSchema = z.object({
  score: z.coerce.number().min(0),
  feedback: z.string().max(5000).optional(),
});

type GradeForm = z.infer<typeof gradeSchema>;

function formatResponse(response: unknown): string {
  if (response == null) return '—';
  if (typeof response === 'string') return response;
  try {
    return JSON.stringify(response, null, 2);
  } catch {
    return String(response);
  }
}

export function ManualGradingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [gradingItem, setGradingItem] = useState<ManualReviewItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['manual-reviews'],
    queryFn: () =>
      api.get<PaginatedResponse<ManualReviewItem>>(
        '/api/v1/reviews/manual?status=PENDING&page=1&pageSize=50',
      ),
  });

  const form = useForm<GradeForm>({
    resolver: zodResolver(gradeSchema),
    defaultValues: { score: 0, feedback: '' },
  });

  const gradeMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: GradeForm }) =>
      api.post(`/api/v1/reviews/manual/${id}/grade`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-reviews'] });
      setGradingItem(null);
      form.reset({ score: 0, feedback: '' });
    },
  });

  const openGrading = (item: ManualReviewItem) => {
    setGradingItem(item);
    form.reset({ score: item.score ?? 0, feedback: item.feedback ?? '' });
  };

  const items = data?.data ?? [];

  return (
    <PageMotion className="space-y-6">
      <PageHeader
        title={t('manualGrading.title')}
        description={t('manualGrading.description')}
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
      ) : items.length === 0 ? (
        <EmptyState
          title={t('manualGrading.emptyTitle')}
          description={t('manualGrading.emptyDescription')}
        />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('manualGrading.candidate')}</TableHead>
                <TableHead scope="col">{t('manualGrading.exam')}</TableHead>
                <TableHead scope="col">{t('manualGrading.question')}</TableHead>
                <TableHead scope="col">{t('common.status')}</TableHead>
                <TableHead scope="col">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.candidateName}</p>
                      <p className="text-xs text-slate-500">{item.candidateEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.examTitle}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {item.question?.stem ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'GRADED' ? 'success' : 'warning'}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="outline" size="sm" onClick={() => openGrading(item)}>
                      {t('manualGrading.grade')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}

      <Dialog open={!!gradingItem} onOpenChange={(open) => !open && setGradingItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('manualGrading.gradeResponse')}</DialogTitle>
          </DialogHeader>
          {gradingItem ? (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">{gradingItem.question?.stem}</p>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                  {formatResponse(gradingItem.response)}
                </pre>
              </div>
              <form
                onSubmit={form.handleSubmit((values) =>
                  gradeMutation.mutate({ id: gradingItem.id, body: values }),
                )}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="score" required>
                    {t('manualGrading.score')}
                    {gradingItem.question ? ` (${t('manualGrading.maxScore', { max: gradingItem.question.maxScore })})` : ''}
                  </Label>
                  <Input
                    id="score"
                    type="number"
                    min={0}
                    max={gradingItem.question?.maxScore}
                    step="0.5"
                    {...form.register('score')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback">{t('manualGrading.feedback')}</Label>
                  <Textarea id="feedback" rows={3} {...form.register('feedback')} />
                </div>
                {gradeMutation.isError ? (
                  <Alert variant="error">{(gradeMutation.error as Error).message}</Alert>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setGradingItem(null)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={gradeMutation.isPending}>
                    {gradeMutation.isPending ? (
                      <Spinner size="sm" label={t('common.loading')} />
                    ) : (
                      t('manualGrading.submitGrade')
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageMotion>
  );
}
