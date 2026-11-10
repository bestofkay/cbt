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

interface ExamTemplate {
  id: string;
  code: string;
  title: string;
  mode: string;
  durationMinutes: number;
  passingScore: number;
  status: string;
}

const createExamSchema = z.object({
  code: z.string().min(1).max(50),
  title: z.string().min(1).max(250),
  description: z.string().optional(),
  mode: z.enum(['PRACTICE', 'MOCK', 'REAL', 'LIVE']),
  durationMinutes: z.coerce.number().int().positive(),
  passingScore: z.coerce.number().min(0).max(100),
});

type CreateExamForm = z.infer<typeof createExamSchema>;

function statusVariant(status: string) {
  if (status === 'PUBLISHED') return 'success' as const;
  if (status === 'DRAFT') return 'outline' as const;
  return 'secondary' as const;
}

export function ExamsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exam-templates'],
    queryFn: () =>
      api.get<PaginatedResponse<ExamTemplate>>('/api/v1/exams/templates?page=1&pageSize=50'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateExamForm>({
    resolver: zodResolver(createExamSchema),
    defaultValues: { mode: 'REAL', durationMinutes: 60, passingScore: 50 },
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateExamForm) => api.post<ExamTemplate>('/api/v1/exams/templates', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-templates'] });
      setDialogOpen(false);
      reset();
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post<ExamTemplate>(`/api/v1/exams/${id}/publish`),
    onMutate: (id) => setPublishingId(id),
    onSettled: () => setPublishingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exam-templates'] }),
  });

  const exams = data?.data ?? [];

  return (
    <PageMotion className="space-y-6">
      <PageHeader
        title={t('exams.title')}
        description={t('exams.description')}
        actions={<Button onClick={() => setDialogOpen(true)}>{t('exams.createExam')}</Button>}
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
      ) : exams.length === 0 ? (
        <EmptyState
          title={t('exams.emptyTitle')}
          description={t('exams.emptyDescription')}
          action={<Button onClick={() => setDialogOpen(true)}>{t('exams.createExam')}</Button>}
        />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('exams.code')}</TableHead>
                <TableHead scope="col">{t('exams.examTitle')}</TableHead>
                <TableHead scope="col">{t('exams.mode')}</TableHead>
                <TableHead scope="col">{t('exams.duration')}</TableHead>
                <TableHead scope="col">{t('exams.passingScore')}</TableHead>
                <TableHead scope="col">{t('common.status')}</TableHead>
                <TableHead scope="col">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-mono text-sm">{exam.code}</TableCell>
                  <TableCell className="font-medium">
                    <Link
                      to={`/exams/${exam.id}`}
                      className="text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {exam.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{exam.mode}</Badge>
                  </TableCell>
                  <TableCell>
                    {exam.durationMinutes} {t('exams.minutes')}
                  </TableCell>
                  <TableCell>{exam.passingScore}%</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(exam.status)}>{exam.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {exam.status !== 'PUBLISHED' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={publishingId === exam.id}
                        onClick={() => publishMutation.mutate(exam.id)}
                      >
                        {publishingId === exam.id ? (
                          <Spinner size="sm" label={t('common.loading')} />
                        ) : (
                          t('exams.publish')
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500">{t('exams.published')}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}

      {publishMutation.isError ? (
        <Alert variant="error">{(publishMutation.error as Error).message}</Alert>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('exams.createExam')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code" required>
                  {t('exams.code')}
                </Label>
                <Input id="code" {...register('code')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode">{t('exams.mode')}</Label>
                <Select id="mode" {...register('mode')}>
                  <option value="PRACTICE">{t('exams.modes.practice')}</option>
                  <option value="MOCK">{t('exams.modes.mock')}</option>
                  <option value="REAL">{t('exams.modes.real')}</option>
                  <option value="LIVE">{t('exams.modes.live')}</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title" required>
                {t('exams.examTitle')}
              </Label>
              <Input id="title" {...register('title')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('exams.examDescription')}</Label>
              <Textarea id="description" rows={3} {...register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="durationMinutes">{t('exams.duration')}</Label>
                <Input id="durationMinutes" type="number" min={1} {...register('durationMinutes')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passingScore">{t('exams.passingScore')}</Label>
                <Input id="passingScore" type="number" min={0} max={100} {...register('passingScore')} />
              </div>
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
