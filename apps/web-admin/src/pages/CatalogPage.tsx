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
  Tabs,
  Textarea,
} from '@cbt/ui';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  isActive: boolean;
}

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  maxRedemptions: number | null;
  isActive: boolean;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  currency: string;
  customerName: string;
  customerEmail: string;
}

const productSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  priceCents: z.coerce.number().int().positive(),
  currency: z.string().min(3).max(3).default('USD'),
});
type ProductForm = z.infer<typeof productSchema>;

const couponSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  percentOff: z.coerce.number().min(0).max(100).optional(),
  amountOffCents: z.coerce.number().int().nonnegative().optional(),
  maxRedemptions: z.coerce.number().int().positive().optional(),
});
type CouponForm = z.infer<typeof couponSchema>;

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function CatalogPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('products');
  const [payingId, setPayingId] = useState<string | null>(null);

  const tabs = [
    { id: 'products', label: t('catalog.tabs.products') },
    { id: 'coupons', label: t('catalog.tabs.coupons') },
    { id: 'invoices', label: t('catalog.tabs.invoices') },
  ];

  const { data: products, isLoading: productsLoading, isError: productsError } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<{ data: Product[] }>('/api/v1/products'),
    enabled: tab === 'products',
  });

  const { data: coupons, isLoading: couponsLoading, isError: couponsError } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => api.get<{ data: Coupon[] }>('/api/v1/coupons'),
    enabled: tab === 'coupons',
  });

  const { data: invoices, isLoading: invoicesLoading, isError: invoicesError } = useQuery({
    queryKey: ['catalog-invoices'],
    queryFn: () =>
      api.get<PaginatedResponse<Invoice>>('/api/v1/billing/invoices?page=1&pageSize=50'),
    enabled: tab === 'invoices',
  });

  const productForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { sku: '', name: '', description: '', priceCents: 0, currency: 'USD' },
  });
  const createProductMutation = useMutation({
    mutationFn: (values: ProductForm) => api.post('/api/v1/products', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      productForm.reset({ sku: '', name: '', description: '', priceCents: 0, currency: 'USD' });
    },
  });

  const couponForm = useForm<CouponForm>({
    resolver: zodResolver(couponSchema),
    defaultValues: { code: '', description: '' },
  });
  const createCouponMutation = useMutation({
    mutationFn: (values: CouponForm) => api.post('/api/v1/coupons', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      couponForm.reset({ code: '', description: '' });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) => api.post('/api/v1/payments', { invoiceId }),
    onMutate: (invoiceId) => setPayingId(invoiceId),
    onSettled: () => setPayingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog-invoices'] }),
  });

  return (
    <PageMotion className="space-y-6">
      <PageHeader title={t('catalog.title')} description={t('catalog.description')} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'products' ? (
        <div className="space-y-6">
          <Surface className="max-w-2xl space-y-4 p-6">
            <h2 className="font-serif text-lg font-semibold text-primary-950">{t('catalog.createProduct')}</h2>
            <form
              onSubmit={productForm.handleSubmit((v) => createProductMutation.mutate(v))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku" required>
                    {t('catalog.sku')}
                  </Label>
                  <Input id="sku" {...productForm.register('sku')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productName" required>
                    {t('catalog.productName')}
                  </Label>
                  <Input id="productName" {...productForm.register('name')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="productDescription">{t('questionBanks.bankDescription')}</Label>
                <Textarea id="productDescription" rows={2} {...productForm.register('description')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priceCents" required>
                    {t('catalog.priceCents')}
                  </Label>
                  <Input id="priceCents" type="number" min={1} {...productForm.register('priceCents')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">{t('catalog.currency')}</Label>
                  <Input id="currency" maxLength={3} {...productForm.register('currency')} />
                </div>
              </div>
              {createProductMutation.isError ? (
                <Alert variant="error">{(createProductMutation.error as Error).message}</Alert>
              ) : null}
              <Button type="submit" disabled={createProductMutation.isPending}>
                {createProductMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : (
                  t('common.create')
                )}
              </Button>
            </form>
          </Surface>

          {productsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" label={t('common.loading')} />
            </div>
          ) : productsError ? (
            <Alert variant="error">{t('common.error')}</Alert>
          ) : (products?.data.length ?? 0) === 0 ? (
            <EmptyState title={t('catalog.emptyProductsTitle')} description={t('catalog.emptyProductsDescription')} />
          ) : (
            <Surface className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t('catalog.sku')}</TableHead>
                    <TableHead scope="col">{t('catalog.productName')}</TableHead>
                    <TableHead scope="col">{t('billing.amount')}</TableHead>
                    <TableHead scope="col">{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products!.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{formatMoney(p.priceCents, p.currency)}</TableCell>
                      <TableCell>
                        <Badge variant={p.isActive ? 'success' : 'outline'}>
                          {p.isActive ? t('catalog.active') : t('catalog.inactive')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Surface>
          )}
        </div>
      ) : null}

      {tab === 'coupons' ? (
        <div className="space-y-6">
          <Surface className="max-w-2xl space-y-4 p-6">
            <h2 className="font-serif text-lg font-semibold text-primary-950">{t('catalog.createCoupon')}</h2>
            <form
              onSubmit={couponForm.handleSubmit((v) => createCouponMutation.mutate(v))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="couponCode" required>
                  {t('catalog.couponCode')}
                </Label>
                <Input id="couponCode" {...couponForm.register('code')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="couponDescription">{t('questionBanks.bankDescription')}</Label>
                <Input id="couponDescription" {...couponForm.register('description')} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="percentOff">{t('catalog.percentOff')}</Label>
                  <Input id="percentOff" type="number" min={0} max={100} {...couponForm.register('percentOff')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amountOffCents">{t('catalog.amountOffCents')}</Label>
                  <Input id="amountOffCents" type="number" min={0} {...couponForm.register('amountOffCents')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxRedemptions">{t('catalog.maxRedemptions')}</Label>
                  <Input id="maxRedemptions" type="number" min={1} {...couponForm.register('maxRedemptions')} />
                </div>
              </div>
              {createCouponMutation.isError ? (
                <Alert variant="error">{(createCouponMutation.error as Error).message}</Alert>
              ) : null}
              <Button type="submit" disabled={createCouponMutation.isPending}>
                {createCouponMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : (
                  t('common.create')
                )}
              </Button>
            </form>
          </Surface>

          {couponsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" label={t('common.loading')} />
            </div>
          ) : couponsError ? (
            <Alert variant="error">{t('common.error')}</Alert>
          ) : (coupons?.data.length ?? 0) === 0 ? (
            <EmptyState title={t('catalog.emptyCouponsTitle')} description={t('catalog.emptyCouponsDescription')} />
          ) : (
            <Surface className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t('catalog.couponCode')}</TableHead>
                    <TableHead scope="col">{t('catalog.percentOff')}</TableHead>
                    <TableHead scope="col">{t('catalog.amountOffCents')}</TableHead>
                    <TableHead scope="col">{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons!.data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.code}</TableCell>
                      <TableCell>{c.percentOff != null ? `${c.percentOff}%` : '—'}</TableCell>
                      <TableCell>
                        {c.amountOffCents != null ? formatMoney(c.amountOffCents, c.currency ?? 'USD') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.isActive ? 'success' : 'outline'}>
                          {c.isActive ? t('catalog.active') : t('catalog.inactive')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Surface>
          )}
        </div>
      ) : null}

      {tab === 'invoices' ? (
        invoicesLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        ) : invoicesError ? (
          <Alert variant="error">{t('common.error')}</Alert>
        ) : (invoices?.data.length ?? 0) === 0 ? (
          <EmptyState title={t('billing.emptyTitle')} description={t('billing.emptyDescription')} />
        ) : (
          <Surface className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('billing.invoiceNumber')}</TableHead>
                  <TableHead scope="col">{t('billing.customer')}</TableHead>
                  <TableHead scope="col">{t('billing.amount')}</TableHead>
                  <TableHead scope="col">{t('common.status')}</TableHead>
                  <TableHead scope="col">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices!.data.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>
                      <div>
                        <p>{inv.customerName || '—'}</p>
                        <p className="text-xs text-slate-500">{inv.customerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatMoney(inv.totalCents, inv.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'PAID' ? 'success' : 'warning'}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {inv.status !== 'PAID' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={payingId === inv.id}
                          onClick={() => markPaidMutation.mutate(inv.id)}
                        >
                          {payingId === inv.id ? (
                            <Spinner size="sm" label={t('common.loading')} />
                          ) : (
                            t('catalog.markPaid')
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500">{t('catalog.paid')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        )
      ) : null}
    </PageMotion>
  );
}
