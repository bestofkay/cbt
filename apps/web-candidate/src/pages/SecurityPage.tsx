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
} from '@cbt/ui';
import { api, ApiError } from '@/lib/api';
import type { AuthUser } from '@/lib/auth';
import { PageMotion } from '@/components/PageMotion';

interface Device {
  id: string;
  name?: string | null;
  deviceType?: string | null;
  os?: string | null;
  browser?: string | null;
  trusted: boolean;
  lastSeenAt?: string | null;
  lastIp?: string | null;
}

const otpSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code'),
});

type OtpForm = z.infer<typeof otpSchema>;

export function SecurityPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [setupData, setSetupData] = useState<{ secret: string; otpauth: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);

  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get<AuthUser>('/api/v1/auth/me'),
  });

  const devicesQuery = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<Device[]>('/api/v1/auth/devices'),
  });

  const setupForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });
  const disableForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });

  const setupMutation = useMutation({
    mutationFn: () => api.post<{ secret: string; otpauth: string }>('/api/v1/auth/2fa/setup'),
    onSuccess: (data) => {
      setSetupData(data);
      setBackupCodes(null);
    },
  });

  const enableMutation = useMutation({
    mutationFn: (values: OtpForm) =>
      api.post<{ enabled: boolean; backupCodes: string[] }>('/api/v1/auth/2fa/enable', values),
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setSetupData(null);
      setupForm.reset();
      queryClient.setQueryData(['auth-me'], (prev: AuthUser | undefined) =>
        prev ? { ...prev, twoFactorEnabled: true } : prev,
      );
    },
  });

  const disableMutation = useMutation({
    mutationFn: (values: OtpForm) => api.post<{ enabled: boolean }>('/api/v1/auth/2fa/disable', values),
    onSuccess: () => {
      setDisabling(false);
      disableForm.reset();
      queryClient.setQueryData(['auth-me'], (prev: AuthUser | undefined) =>
        prev ? { ...prev, twoFactorEnabled: false } : prev,
      );
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (deviceId: string) => api.delete(`/api/v1/auth/devices/${deviceId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const twoFactorEnabled = !!meQuery.data?.twoFactorEnabled;
  const devices = devicesQuery.data ?? [];

  return (
    <PageMotion className="space-y-10">
      <PageHeader title={t('security.title')} description={t('security.description')} />

      <section aria-labelledby="twofa-heading" className="space-y-4">
        <h2 id="twofa-heading" className="font-serif text-lg font-semibold text-primary-950">
          {t('security.twoFactor')}
        </h2>

        {meQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        ) : (
          <Surface className="max-w-2xl p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{t('security.twoFactorStatus')}</p>
                <p className="mt-1 text-sm text-slate-600">{t('security.twoFactorDescription')}</p>
              </div>
              <Badge variant={twoFactorEnabled ? 'success' : 'outline'}>
                {twoFactorEnabled ? t('security.enabled') : t('security.disabled')}
              </Badge>
            </div>

            {backupCodes ? (
              <div className="space-y-3">
                <Alert variant="success">{t('security.twoFactorEnabledSuccess')}</Alert>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-900">{t('security.backupCodes')}</p>
                  <p className="mb-3 text-xs text-slate-500">{t('security.backupCodesHint')}</p>
                  <ul className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-sm sm:grid-cols-4">
                    {backupCodes.map((code) => (
                      <li key={code}>{code}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : twoFactorEnabled ? (
              disabling ? (
                <form
                  onSubmit={disableForm.handleSubmit((values) => disableMutation.mutate(values))}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor="disable-code" required>
                      {t('auth.otp')}
                    </Label>
                    <Input
                      id="disable-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      {...disableForm.register('code')}
                    />
                    {disableForm.formState.errors.code ? (
                      <p className="text-sm text-red-600" role="alert">
                        {disableForm.formState.errors.code.message}
                      </p>
                    ) : null}
                  </div>
                  {disableMutation.isError ? (
                    <Alert variant="error">
                      {disableMutation.error instanceof ApiError
                        ? disableMutation.error.message
                        : t('common.error')}
                    </Alert>
                  ) : null}
                  <div className="flex gap-2">
                    <Button type="submit" variant="destructive" disabled={disableMutation.isPending}>
                      {disableMutation.isPending ? (
                        <Spinner size="sm" label={t('common.loading')} />
                      ) : (
                        t('security.confirmDisable')
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setDisabling(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button variant="outline" onClick={() => setDisabling(true)}>
                  {t('security.disableTwoFactor')}
                </Button>
              )
            ) : setupData ? (
              <form
                onSubmit={setupForm.handleSubmit((values) => enableMutation.mutate(values))}
                className="space-y-4"
              >
                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-700">{t('security.scanQrHint')}</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupData.otpauth)}`}
                    alt={t('security.qrAlt')}
                    width={180}
                    height={180}
                    className="rounded-md border border-slate-200 bg-white"
                  />
                  <p className="text-xs text-slate-500">{t('security.manualEntryHint')}</p>
                  <code className="block break-all rounded bg-white px-2 py-1 text-xs text-slate-800">
                    {setupData.secret}
                  </code>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="enable-code" required>
                    {t('auth.otp')}
                  </Label>
                  <Input
                    id="enable-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    {...setupForm.register('code')}
                  />
                  {setupForm.formState.errors.code ? (
                    <p className="text-sm text-red-600" role="alert">
                      {setupForm.formState.errors.code.message}
                    </p>
                  ) : null}
                </div>
                {enableMutation.isError ? (
                  <Alert variant="error">
                    {enableMutation.error instanceof ApiError
                      ? enableMutation.error.message
                      : t('common.error')}
                  </Alert>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={enableMutation.isPending}>
                    {enableMutation.isPending ? (
                      <Spinner size="sm" label={t('common.loading')} />
                    ) : (
                      t('security.confirmEnable')
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSetupData(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            ) : (
              <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
                {setupMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : (
                  t('security.enableTwoFactor')
                )}
              </Button>
            )}
          </Surface>
        )}
      </section>

      <section aria-labelledby="devices-heading" className="space-y-4">
        <h2 id="devices-heading" className="font-serif text-lg font-semibold text-primary-950">
          {t('security.devices')}
        </h2>

        {devicesQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" label={t('common.loading')} />
          </div>
        ) : devicesQuery.isError ? (
          <Alert variant="error">{t('common.error')}</Alert>
        ) : devices.length === 0 ? (
          <EmptyState title={t('security.noDevicesTitle')} description={t('security.noDevicesDescription')} />
        ) : (
          <ul className="space-y-3">
            {devices.map((device) => (
              <li key={device.id}>
                <Surface className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-slate-900">
                      {device.name ?? t('security.unknownDevice')}
                      {device.trusted ? (
                        <Badge variant="success">{t('security.trusted')}</Badge>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[device.os, device.browser, device.lastIp].filter(Boolean).join(' · ')}
                    </p>
                    {device.lastSeenAt ? (
                      <p className="text-xs text-slate-400">
                        {t('security.lastSeen')}: {new Date(device.lastSeenAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(device.id)}
                  >
                    {t('security.revoke')}
                  </Button>
                </Surface>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageMotion>
  );
}
