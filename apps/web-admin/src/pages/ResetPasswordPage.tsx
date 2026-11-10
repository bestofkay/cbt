import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Spinner,
  Surface,
} from '@cbt/ui';
import { api } from '@/lib/api';

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
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Surface className="p-0">
          <Card className="border-0 bg-transparent shadow-none">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <header className="space-y-1">
                <h1 className="font-serif text-2xl font-semibold text-primary-950">
                  {t('auth.resetPasswordTitle')}
                </h1>
                <p className="text-sm text-slate-600">{t('auth.resetPasswordDescription')}</p>
              </header>

              {success ? (
                <div className="space-y-4">
                  <Alert variant="success">{t('auth.passwordResetSuccess')}</Alert>
                  <Button type="button" className="w-full" onClick={() => navigate('/login')}>
                    {t('auth.backToLogin')}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="password" required>
                      {t('auth.newPassword')}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={!!errors.password}
                      {...register('password')}
                    />
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
                      aria-invalid={!!errors.confirmPassword}
                      {...register('confirmPassword')}
                    />
                    {errors.confirmPassword ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.confirmPassword.message}
                      </p>
                    ) : null}
                  </div>

                  {error ? <Alert variant="error">{error}</Alert> : null}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Spinner size="sm" label={t('common.loading')} />
                    ) : (
                      t('auth.resetPassword')
                    )}
                  </Button>
                </form>
              )}

              {!success ? (
                <p className="text-center text-sm text-slate-600">
                  <Link
                    to="/login"
                    className="font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    {t('auth.backToLogin')}
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </Surface>
      </motion.div>
    </div>
  );
}
