import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
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

interface Invoice {
  id: string;
  number: string;
  amount: number;
  totalCents: number;
  currency: string;
  status: string;
  dueDate: string | null;
  issuedAt: string | null;
  customerName: string;
  customerEmail: string;
}

interface UserOption {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  unitCents: z.coerce.number().int().nonnegative(),
});

const createInvoiceSchema = z.object({
  userId: z.string().uuid(),
  lines: z.array(lineSchema).min(1),
});

type CreateInvoiceForm = z.infer<typeof createInvoiceSchema>;

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function invoiceStatusVariant(status: string) {
  if (status === 'PAID') return 'success' as const;
  if (status === 'OVERDUE') return 'destructive' as const;
  if (status === 'ISSUED') return 'warning' as const;
  return 'outline' as const;
}

export function BillingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userLookup, setUserLookup] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: () =>
      api.get<PaginatedResponse<Invoice>>('/api/v1/billing/invoices?page=1&pageSize=50'),
  });

  const { data: userSearchResults, isFetching: searchingUsers } = useQuery({
    queryKey: ['user-lookup', userLookup],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', pageSize: '10', search: userLookup.trim() });
      return api.get<PaginatedResponse<UserOption>>(`/api/v1/admin/users?${params}`);
    },
    enabled: userLookup.trim().length >= 2,
  });

  const form = useForm<CreateInvoiceForm>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      userId: '',
      lines: [{ description: '', quantity: 1, unitCents: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });

  const createMutation = useMutation({
    mutationFn: (body: CreateInvoiceForm) => api.post('/api/v1/invoices', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDialogOpen(false);
      form.reset({ userId: '', lines: [{ description: '', quantity: 1, unitCents: 0 }] });
      setUserLookup('');
    },
  });

  const invoices = data?.data ?? [];

  const selectUser = (user: UserOption) => {
    form.setValue('userId', user.id, { shouldValidate: true });
    setUserLookup(`${user.firstName} ${user.lastName} (${user.email})`);
  };

  return (
    <PageMotion className="space-y-6">
      <PageHeader
        title={t('billing.title')}
        description={t('billing.description')}
        actions={<Button onClick={() => setDialogOpen(true)}>{t('billing.createInvoice')}</Button>}
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
      ) : invoices.length === 0 ? (
        <EmptyState
          title={t('billing.emptyTitle')}
          description={t('billing.emptyDescription')}
          action={<Button onClick={() => setDialogOpen(true)}>{t('billing.createInvoice')}</Button>}
        />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('billing.invoiceNumber')}</TableHead>
                <TableHead scope="col">{t('billing.customer')}</TableHead>
                <TableHead scope="col">{t('billing.amount')}</TableHead>
                <TableHead scope="col">{t('common.status')}</TableHead>
                <TableHead scope="col">{t('billing.dueDate')}</TableHead>
                <TableHead scope="col">{t('billing.issued')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.number}</TableCell>
                  <TableCell>
                    <div>
                      <p>{invoice.customerName || '—'}</p>
                      <p className="text-xs text-slate-500">{invoice.customerEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatMoney(invoice.totalCents ?? invoice.amount * 100, invoice.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={invoiceStatusVariant(invoice.status)}>{invoice.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('billing.createInvoice')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userLookup">{t('billing.customerLookup')}</Label>
              <Input
                id="userLookup"
                value={userLookup}
                onChange={(e) => setUserLookup(e.target.value)}
                placeholder={t('billing.customerLookupPlaceholder')}
                aria-describedby="user-lookup-hint"
              />
              <p id="user-lookup-hint" className="text-xs text-slate-500">
                {t('billing.customerLookupHint')}
              </p>
              {searchingUsers ? <Spinner size="sm" label={t('common.loading')} /> : null}
              {(userSearchResults?.data.length ?? 0) > 0 && userLookup.trim().length >= 2 ? (
                <ul className="max-h-32 overflow-y-auto rounded-md border border-slate-200" role="listbox">
                  {userSearchResults!.data.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        role="option"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        onClick={() => selectUser(user)}
                      >
                        {user.firstName} {user.lastName} — {user.email}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <input type="hidden" {...form.register('userId')} />
              {form.formState.errors.userId ? (
                <p className="text-sm text-red-600" role="alert">
                  {t('billing.customerRequired')}
                </p>
              ) : null}
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-slate-900">{t('billing.lineItems')}</legend>
              {fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Label htmlFor={`lines.${index}.description`} className="sr-only">
                      {t('billing.lineDescription')}
                    </Label>
                    <Input
                      id={`lines.${index}.description`}
                      placeholder={t('billing.lineDescription')}
                      {...form.register(`lines.${index}.description`)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`lines.${index}.quantity`} className="sr-only">
                      {t('billing.quantity')}
                    </Label>
                    <Input
                      id={`lines.${index}.quantity`}
                      type="number"
                      min={1}
                      placeholder={t('billing.quantity')}
                      {...form.register(`lines.${index}.quantity`)}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label htmlFor={`lines.${index}.unitCents`} className="sr-only">
                      {t('billing.unitCents')}
                    </Label>
                    <Input
                      id={`lines.${index}.unitCents`}
                      type="number"
                      min={0}
                      placeholder={t('billing.unitCents')}
                      {...form.register(`lines.${index}.unitCents`)}
                    />
                  </div>
                  <div className="flex items-center sm:col-span-2">
                    {fields.length > 1 ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                        {t('common.remove')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ description: '', quantity: 1, unitCents: 0 })}
              >
                {t('billing.addLine')}
              </Button>
            </fieldset>

            {createMutation.isError ? (
              <Alert variant="error">{(createMutation.error as Error).message}</Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
    </PageMotion>
  );
}
