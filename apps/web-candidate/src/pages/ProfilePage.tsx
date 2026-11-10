import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Input, Label, PageHeader, Select, Spinner, Surface } from '@cbt/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/auth';
import { PageMotion } from '@/components/PageMotion';

const profileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  displayName: z.string().max(200).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  locale: z.string().max(10).min(1),
  timezone: z.string().max(64).min(1),
});

type ProfileForm = z.infer<typeof profileSchema>;

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'ar', label: 'العربية' },
];

const browserTimezone =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get<AuthUser>('/api/v1/auth/me'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      displayName: user?.displayName ?? '',
      phone: user?.phone ?? '',
      locale: user?.locale ?? 'en',
      timezone: user?.timezone ?? browserTimezone,
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        displayName: data.displayName ?? '',
        phone: data.phone ?? user?.phone ?? '',
        locale: data.locale ?? user?.locale ?? 'en',
        timezone: data.timezone ?? user?.timezone ?? browserTimezone,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (values: ProfileForm) =>
      api.patch<AuthUser>('/api/v1/auth/profile', {
        firstName: values.firstName,
        lastName: values.lastName,
        displayName: values.displayName || null,
        phone: values.phone || null,
        locale: values.locale,
        timezone: values.timezone,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['auth-me'], (prev: AuthUser | undefined) =>
        prev ? { ...prev, ...updated } : prev,
      );
      await refreshUser();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{t('common.error')}</Alert>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <PageMotion className="space-y-8">
      <PageHeader title={t('profile.title')} description={t('profile.description')} />

      <Surface className="max-w-2xl p-6">
        <form
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
          className="space-y-5"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName" required>
                {t('auth.firstName')}
              </Label>
              <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
              {errors.firstName ? (
                <p className="text-sm text-red-600" role="alert">
                  {errors.firstName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" required>
                {t('auth.lastName')}
              </Label>
              <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
              {errors.lastName ? (
                <p className="text-sm text-red-600" role="alert">
                  {errors.lastName.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">{t('profile.displayName')}</Label>
            <Input id="displayName" {...register('displayName')} />
            <p className="text-xs text-slate-500">{t('profile.displayNameHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('auth.phone')}</Label>
            <Input id="phone" type="tel" autoComplete="tel" {...register('phone')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="locale">{t('profile.locale')}</Label>
              <Select id="locale" {...register('locale')}>
                {LOCALE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">{t('profile.timezone')}</Label>
              <Input id="timezone" {...register('timezone')} />
            </div>
          </div>

          {updateMutation.isSuccess ? (
            <Alert variant="success">{t('profile.saved')}</Alert>
          ) : null}
          {updateMutation.isError ? (
            <Alert variant="error">
              {updateMutation.error instanceof ApiError
                ? updateMutation.error.message
                : t('common.error')}
            </Alert>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting || !isDirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Spinner size="sm" label={t('common.loading')} />
            ) : (
              t('profile.save')
            )}
          </Button>
        </form>
      </Surface>
    </PageMotion>
  );
}
