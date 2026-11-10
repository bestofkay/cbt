import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Alert,
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

interface QuestionBank {
  id: string;
  name: string;
  code: string;
  description?: string;
  questionCount: number;
  updatedAt: string;
}

const createBankSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  description: z.string().max(5000).optional(),
});

type CreateBankForm = z.infer<typeof createBankSchema>;

export function QuestionBanksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['question-banks'],
    queryFn: () =>
      api.get<PaginatedResponse<QuestionBank>>('/api/v1/question-banks?page=1&pageSize=50'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateBankForm>({
    resolver: zodResolver(createBankSchema),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateBankForm) => api.post<QuestionBank>('/api/v1/question-banks', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-banks'] });
      setDialogOpen(false);
      reset();
    },
  });

  const banks = data?.data ?? [];

  return (
    <PageMotion className="space-y-6">
      <PageHeader
        title={t('questionBanks.title')}
        description={t('questionBanks.description')}
        actions={<Button onClick={() => setDialogOpen(true)}>{t('questionBanks.createBank')}</Button>}
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
      ) : banks.length === 0 ? (
        <EmptyState
          title={t('questionBanks.emptyTitle')}
          description={t('questionBanks.emptyDescription')}
          action={<Button onClick={() => setDialogOpen(true)}>{t('questionBanks.createBank')}</Button>}
        />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('questionBanks.name')}</TableHead>
                <TableHead scope="col">{t('questionBanks.code')}</TableHead>
                <TableHead scope="col">{t('questionBanks.questions')}</TableHead>
                <TableHead scope="col">{t('questionBanks.updated')}</TableHead>
                <TableHead scope="col">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((bank) => (
                <TableRow key={bank.id}>
                  <TableCell className="font-medium">{bank.name}</TableCell>
                  <TableCell>{bank.code}</TableCell>
                  <TableCell>{bank.questionCount}</TableCell>
                  <TableCell className="text-slate-500">
                    {new Date(bank.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/question-banks/${bank.id}`}
                      className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {t('common.view')}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('questionBanks.createBank')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" required>
                {t('questionBanks.name')}
              </Label>
              <Input id="name" {...register('name')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code" required>
                {t('questionBanks.code')}
              </Label>
              <Input id="code" {...register('code')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('questionBanks.bankDescription')}</Label>
              <Textarea id="description" rows={3} {...register('description')} />
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
