import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Alert,
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
} from '@cbt/ui';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface BrandingSettings {
  platformName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  supportEmail: string | null;
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  createdAt: string;
  actor?: { email: string; firstName: string; lastName: string } | null;
}

const brandingSchema = z.object({
  platformName: z.string().min(1).max(100),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  logoUrl: z.string().url().or(z.literal('')),
  supportEmail: z.string().email(),
});

type BrandingForm = z.infer<typeof brandingSchema>;

function SwitchRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200 px-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-900">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="h-5 w-9 shrink-0 cursor-pointer rounded-md border border-slate-300 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('branding');

  const tabs = [
    { id: 'branding', label: t('settings.tabs.branding') },
    { id: 'flags', label: t('settings.tabs.flags') },
    { id: 'audit', label: t('settings.tabs.audit') },
  ];

  const { data: branding, isLoading: brandingLoading } = useQuery({
    queryKey: ['branding-settings'],
    queryFn: () => api.get<BrandingSettings>('/api/v1/settings/branding'),
  });

  const { data: flagsData, isLoading: flagsLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => api.get<{ data: FeatureFlag[] }>('/api/v1/feature-flags'),
    enabled: tab === 'flags',
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () =>
      api.get<PaginatedResponse<AuditLogEntry>>('/api/v1/audit-logs?page=1&pageSize=50'),
    enabled: tab === 'audit',
  });

  const brandingForm = useForm<BrandingForm>({
    resolver: zodResolver(brandingSchema),
    values: branding
      ? {
          platformName: branding.platformName ?? '',
          primaryColor: branding.primaryColor ?? '#0F766E',
          accentColor: branding.accentColor ?? '#F59E0B',
          logoUrl: branding.logoUrl ?? '',
          supportEmail: branding.supportEmail ?? '',
        }
      : undefined,
  });

  const saveBrandingMutation = useMutation({
    mutationFn: (body: BrandingForm) => api.put<BrandingSettings>('/api/v1/settings/branding', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branding-settings'] }),
  });

  const flagMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api.put(`/api/v1/feature-flags/${key}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
  });

  return (
    <PageMotion className="space-y-6">
      <PageHeader title={t('settings.title')} description={t('settings.description')} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'branding' ? (
        brandingLoading ? (
          <Spinner size="lg" label={t('common.loading')} />
        ) : (
          <Surface className="max-w-2xl p-6">
            <form
              onSubmit={brandingForm.handleSubmit((values) => saveBrandingMutation.mutate(values))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="platformName">{t('settings.platformName')}</Label>
                <Input id="platformName" {...brandingForm.register('platformName')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">{t('settings.primaryColor')}</Label>
                  <Input
                    id="primaryColor"
                    type="color"
                    className="h-12 p-1"
                    {...brandingForm.register('primaryColor')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accentColor">{t('settings.accentColor')}</Label>
                  <Input
                    id="accentColor"
                    type="color"
                    className="h-12 p-1"
                    {...brandingForm.register('accentColor')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">{t('settings.logoUrl')}</Label>
                <Input id="logoUrl" type="url" placeholder="https://" {...brandingForm.register('logoUrl')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">{t('settings.supportEmail')}</Label>
                <Input id="supportEmail" type="email" {...brandingForm.register('supportEmail')} />
              </div>
              {saveBrandingMutation.isSuccess ? (
                <Alert variant="success">{t('settings.saved')}</Alert>
              ) : null}
              {saveBrandingMutation.isError ? (
                <Alert variant="error">{(saveBrandingMutation.error as Error).message}</Alert>
              ) : null}
              <Button
                type="submit"
                disabled={
                  brandingForm.formState.isSubmitting ||
                  !brandingForm.formState.isDirty ||
                  saveBrandingMutation.isPending
                }
              >
                {saveBrandingMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : (
                  t('settings.saveBranding')
                )}
              </Button>
            </form>
          </Surface>
        )
      ) : null}

      {tab === 'flags' ? (
        flagsLoading ? (
          <Spinner size="lg" label={t('common.loading')} />
        ) : (flagsData?.data.length ?? 0) === 0 ? (
          <EmptyState title={t('settings.noFlagsTitle')} description={t('settings.noFlagsDescription')} />
        ) : (
          <div className="max-w-2xl space-y-2">
            {flagsData!.data.map((flag) => (
              <SwitchRow
                key={flag.key}
                id={`flag-${flag.key}`}
                label={flag.key}
                description={flag.description ?? undefined}
                checked={flag.enabled}
                disabled={flagMutation.isPending}
                onCheckedChange={(enabled) => flagMutation.mutate({ key: flag.key, enabled })}
              />
            ))}
            {flagMutation.isError ? (
              <Alert variant="error">{(flagMutation.error as Error).message}</Alert>
            ) : null}
          </div>
        )
      ) : null}

      {tab === 'audit' ? (
        auditLoading ? (
          <Spinner size="lg" label={t('common.loading')} />
        ) : (auditData?.data.length ?? 0) === 0 ? (
          <EmptyState title={t('settings.noAuditTitle')} description={t('settings.noAuditDescription')} />
        ) : (
          <Surface className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('settings.audit.when')}</TableHead>
                  <TableHead scope="col">{t('settings.audit.actor')}</TableHead>
                  <TableHead scope="col">{t('settings.audit.action')}</TableHead>
                  <TableHead scope="col">{t('settings.audit.resource')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditData!.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-slate-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {entry.actor
                        ? `${entry.actor.firstName} ${entry.actor.lastName}`
                        : t('settings.audit.system')}
                    </TableCell>
                    <TableCell className="font-medium">{entry.action}</TableCell>
                    <TableCell>
                      {entry.resource ? `${entry.resource}${entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}…` : ''}` : '—'}
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
