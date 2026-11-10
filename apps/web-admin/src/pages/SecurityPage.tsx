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
} from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface MeResponse {
  id: string;
  email: string;
  twoFactorEnabled?: boolean;
}

interface TwoFactorSetup {
  secret: string;
  otpauth: string;
}

interface Device {
  id: string;
  name: string | null;
  browser: string | null;
  os: string | null;
  lastIp: string | null;
  lastSeenAt: string | null;
  trusted: boolean;
}

const codeSchema = z.object({ code: z.string().length(6, 'Enter the 6-digit code') });
type CodeForm = z.infer<typeof codeSchema>;

export function SecurityPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me-security'],
    queryFn: () => api.get<MeResponse>('/api/v1/auth/me'),
  });

  const { data: devices, isLoading: devicesLoading, isError: devicesError } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<Device[]>('/api/v1/auth/devices'),
  });

  const setupMutation = useMutation({
    mutationFn: () => api.post<TwoFactorSetup>('/api/v1/auth/2fa/setup'),
    onSuccess: (result) => setSetupData(result),
  });

  const enableForm = useForm<CodeForm>({ resolver: zodResolver(codeSchema) });
  const disableForm = useForm<CodeForm>({ resolver: zodResolver(codeSchema) });

  const enableMutation = useMutation({
    mutationFn: (body: CodeForm) => api.post('/api/v1/auth/2fa/enable', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-security'] });
      setSetupData(null);
      enableForm.reset();
    },
  });

  const disableMutation = useMutation({
    mutationFn: (body: CodeForm) => api.post('/api/v1/auth/2fa/disable', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-security'] });
      disableForm.reset();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (deviceId: string) => api.delete(`/api/v1/auth/devices/${deviceId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const twoFactorEnabled = !!me?.twoFactorEnabled;

  return (
    <PageMotion className="space-y-8">
      <PageHeader title={t('security.title')} description={t('security.description')} />

      <section aria-labelledby="twofa-heading" className="max-w-2xl space-y-4">
        <h2 id="twofa-heading" className="font-serif text-lg font-semibold text-primary-950">
          {t('security.twoFactor')}
        </h2>
        {meLoading ? (
          <Spinner size="lg" label={t('common.loading')} />
        ) : (
          <Surface className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-700">{t('security.twoFactorStatus')}</p>
              <Badge variant={twoFactorEnabled ? 'success' : 'outline'}>
                {twoFactorEnabled ? t('security.enabled') : t('security.disabled')}
              </Badge>
            </div>

            {!twoFactorEnabled ? (
              <div className="space-y-4">
                {!setupData ? (
                  <Button type="button" onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
                    {setupMutation.isPending ? (
                      <Spinner size="sm" label={t('common.loading')} />
                    ) : (
                      t('security.beginSetup')
                    )}
                  </Button>
                ) : (
                  <div className="space-y-4 rounded-md border border-slate-200 p-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t('security.scanQr')}</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-600">{setupData.otpauth}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t('security.secretKey')}</p>
                      <p className="mt-1 font-mono text-sm text-slate-700">{setupData.secret}</p>
                    </div>
                    <form
                      onSubmit={enableForm.handleSubmit((values) => enableMutation.mutate(values))}
                      className="flex items-end gap-2"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="enable-code" required>
                          {t('auth.otp')}
                        </Label>
                        <Input
                          id="enable-code"
                          inputMode="numeric"
                          maxLength={6}
                          {...enableForm.register('code')}
                        />
                      </div>
                      <Button type="submit" disabled={enableMutation.isPending}>
                        {enableMutation.isPending ? (
                          <Spinner size="sm" label={t('common.loading')} />
                        ) : (
                          t('security.verifyAndEnable')
                        )}
                      </Button>
                    </form>
                    {enableMutation.isError ? (
                      <Alert variant="error">{(enableMutation.error as Error).message}</Alert>
                    ) : null}
                  </div>
                )}
                {setupMutation.isError ? (
                  <Alert variant="error">{(setupMutation.error as Error).message}</Alert>
                ) : null}
              </div>
            ) : (
              <form
                onSubmit={disableForm.handleSubmit((values) => disableMutation.mutate(values))}
                className="flex items-end gap-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="disable-code" required>
                    {t('security.enterCodeToDisable')}
                  </Label>
                  <Input
                    id="disable-code"
                    inputMode="numeric"
                    maxLength={6}
                    {...disableForm.register('code')}
                  />
                </div>
                <Button type="submit" variant="destructive" disabled={disableMutation.isPending}>
                  {disableMutation.isPending ? (
                    <Spinner size="sm" label={t('common.loading')} />
                  ) : (
                    t('security.disable2fa')
                  )}
                </Button>
              </form>
            )}
            {disableMutation.isError ? (
              <Alert variant="error">{(disableMutation.error as Error).message}</Alert>
            ) : null}
          </Surface>
        )}
      </section>

      <section aria-labelledby="devices-heading">
        <h2 id="devices-heading" className="mb-4 font-serif text-lg font-semibold text-primary-950">
          {t('security.devices')}
        </h2>
        {devicesLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        ) : devicesError ? (
          <Alert variant="error">{t('common.error')}</Alert>
        ) : (devices ?? []).length === 0 ? (
          <EmptyState title={t('security.noDevicesTitle')} description={t('security.noDevicesDescription')} />
        ) : (
          <Surface className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('security.device')}</TableHead>
                  <TableHead scope="col">{t('security.ipAddress')}</TableHead>
                  <TableHead scope="col">{t('security.lastSeen')}</TableHead>
                  <TableHead scope="col">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(devices ?? []).map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{device.name ?? t('security.unknownDevice')}</p>
                        <p className="max-w-xs truncate text-xs text-slate-500">
                          {[device.browser, device.os].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{device.lastIp ?? '—'}</TableCell>
                    <TableCell>
                      {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(device.id)}
                      >
                        {t('security.revoke')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        )}
        {revokeMutation.isError ? (
          <Alert variant="error" className="mt-3">
            {(revokeMutation.error as Error).message}
          </Alert>
        ) : null}
      </section>
    </PageMotion>
  );
}
