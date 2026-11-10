import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Input, Label, Spinner, Surface } from '@cbt/ui';
import { api } from '@/lib/api';
import { darkInput, darkSurface } from '@/lib/theme';

const schema = z
  .object({
    password: z.string().min(12, 'Password must be at least 12 characters'),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordForm = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(schema) });

  if (!token) {
    return <Navigate to="/forgot-password" replace />;
  }

  const onSubmit = async (data: ResetPasswordForm) => {
    setError(null);
    try {
      await api.post('/api/v1/auth/password-reset/confirm', {
        token,
        password: data.password,
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div
            aria-hidden
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30"
          >
            <span className="font-serif text-xl font-bold text-primary-300">CBT</span>
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-100">
            {t('auth.resetPasswordTitle')}
          </h1>
          <p className="mt-2 text-sm text-slate-400">{t('auth.resetPasswordDescription')}</p>
        </div>

        <Surface className={`${darkSurface} p-6 sm:p-8`}>
          {success ? (
            <div className="space-y-5">
              <Alert variant="success" className="border-emerald-800/60 bg-emerald-950/50 text-emerald-200">
                {t('auth.passwordResetSuccess')}
              </Alert>
              <Button type="button" className="w-full" variant="default" onClick={() => navigate('/login')}>
                {t('auth.backToLogin')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="password" required className="text-slate-300">
                  {t('auth.newPassword')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={darkInput}
                  {...register('password')}
                />
                {errors.password ? (
                  <p id="password-error" className="text-sm text-red-400" role="alert">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" required className="text-slate-300">
                  {t('auth.confirmPassword')}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                  className={darkInput}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword ? (
                  <p id="confirmPassword-error" className="text-sm text-red-400" role="alert">
                    {errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>

              {error ? (
                <Alert variant="error" className="border-red-800/60 bg-red-950/50 text-red-200">
                  {error}
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" variant="default" disabled={isSubmitting}>
                {isSubmitting ? <Spinner size="sm" /> : t('auth.resetPassword')}
              </Button>
            </form>
          )}

          {!success ? (
            <p className="mt-6 text-center text-sm text-slate-400">
              <Link
                to="/login"
                className="font-medium text-primary-300 hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                {t('auth.backToLogin')}
              </Link>
            </p>
          ) : null}
        </Surface>
      </motion.div>
    </div>
  );
}
