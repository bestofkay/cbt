import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Input, Label, Spinner } from '@cbt/ui';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { api, ApiError } from '@/lib/api';

const schema = z
  .object({
    password: z
      .string()
      .min(12)
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[a-z]/, 'Must contain lowercase')
      .regex(/[0-9]/, 'Must contain digit')
      .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetForm = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(schema) });

  if (!token) {
    return <Navigate to="/forgot-password" replace />;
  }

  const onSubmit = async (data: ResetForm) => {
    setError(null);
    try {
      await api.post('/api/v1/auth/password-reset/confirm', {
        token,
        password: data.password,
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error'));
    }
  };

  return (
    <AuthLayout title={t('auth.resetPasswordTitle')} subtitle={t('auth.resetPasswordSubtitle')}>
      {success ? (
        <div className="space-y-5">
          <Alert variant="success">{t('auth.passwordResetSuccess')}</Alert>
          <Link
            to="/login"
            className="block text-center text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password" required>
              {t('auth.newPassword')}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="text-xs text-slate-500">
              {t('auth.passwordHint')}
            </p>
            {errors.password ? (
              <p className="text-sm text-red-600" role="alert">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" required>
              {t('auth.confirmPassword')}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword ? (
              <p className="text-sm text-red-600" role="alert">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          {error ? <Alert variant="error">{error}</Alert> : null}

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" label={t('common.loading')} /> : t('auth.resetPassword')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
