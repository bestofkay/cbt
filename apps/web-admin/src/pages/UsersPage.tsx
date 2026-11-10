import { useMemo, useState } from 'react';
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

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  status: string;
  createdAt: string;
}

const ROLE_CODES = [
  'SUPER_ADMIN',
  'ADMIN',
  'EXAM_MANAGER',
  'QUESTION_REVIEWER',
  'QUESTION_AUTHOR',
  'PROCTOR',
  'INVIGILATOR',
  'FINANCE',
  'AUDITOR',
  'SUPPORT',
  'CANDIDATE',
] as const;

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(ROLE_CODES),
  password: z.string().min(12),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const queryKey = useMemo(() => ['users', search], [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', pageSize: '50' });
      if (search.trim()) params.set('search', search.trim());
      return api.get<PaginatedResponse<User>>(`/api/v1/admin/users?${params}`);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'CANDIDATE' },
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateUserForm) =>
      api.post<User>('/api/v1/admin/users', {
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        password: body.password,
        roleCodes: [body.role],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDialogOpen(false);
      reset();
    },
  });

  const users = data?.data ?? [];

  return (
    <PageMotion className="space-y-6">
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        actions={<Button onClick={() => setDialogOpen(true)}>{t('users.createUser')}</Button>}
      />

      <div className="max-w-md">
        <Label htmlFor="user-search" className="sr-only">
          {t('common.search')}
        </Label>
        <Input
          id="user-search"
          type="search"
          placeholder={t('users.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('users.searchPlaceholder')}
        />
      </div>

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
      ) : users.length === 0 ? (
        <EmptyState
          title={t('users.emptyTitle')}
          description={search ? t('users.emptySearch') : t('users.emptyDescription')}
          action={
            <Button onClick={() => setDialogOpen(true)}>{t('users.createUser')}</Button>
          }
        />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('auth.email')}</TableHead>
                <TableHead scope="col">{t('users.firstName')}</TableHead>
                <TableHead scope="col">{t('users.lastName')}</TableHead>
                <TableHead scope="col">{t('users.role')}</TableHead>
                <TableHead scope="col">{t('common.status')}</TableHead>
                <TableHead scope="col">{t('users.created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.firstName}</TableCell>
                    <TableCell>{user.lastName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'ACTIVE' ? 'success' : 'outline'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
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
            <DialogTitle>{t('users.createUser')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email" required>
                {t('auth.email')}
              </Label>
              <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} />
              {errors.email ? (
                <p className="text-sm text-red-600" role="alert">
                  {errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" required>
                  {t('users.firstName')}
                </Label>
                <Input id="firstName" {...register('firstName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" required>
                  {t('users.lastName')}
                </Label>
                <Input id="lastName" {...register('lastName')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">{t('users.role')}</Label>
              <Select id="role" {...register('role')}>
                <option value="SUPER_ADMIN">{t('users.roles.superAdmin')}</option>
                <option value="ADMIN">{t('users.roles.admin')}</option>
                <option value="EXAM_MANAGER">{t('users.roles.examManager')}</option>
                <option value="QUESTION_REVIEWER">{t('users.roles.questionReviewer')}</option>
                <option value="QUESTION_AUTHOR">{t('users.roles.questionAuthor')}</option>
                <option value="PROCTOR">{t('users.roles.proctor')}</option>
                <option value="INVIGILATOR">{t('users.roles.invigilator')}</option>
                <option value="FINANCE">{t('users.roles.finance')}</option>
                <option value="AUDITOR">{t('users.roles.auditor')}</option>
                <option value="SUPPORT">{t('users.roles.support')}</option>
                <option value="CANDIDATE">{t('users.roles.candidate')}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" required>
                {t('auth.password')}
              </Label>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
              {errors.password ? (
                <p className="text-sm text-red-600" role="alert">
                  {errors.password.message}
                </p>
              ) : null}
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
