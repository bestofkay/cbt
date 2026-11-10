import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Input, Label, Separator, Spinner } from '@cbt/ui';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(12)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().max(30).optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { t } = useTranslation();
  const { register: registerUser, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    try {
      await registerUser(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error'));
    }
  };

  return (
    <AuthLayout title={t('auth.register')} subtitle={t('auth.registerSubtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-4">
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
          <Label htmlFor="email" required>
            {t('auth.email')}
          </Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? (
            <p className="text-sm text-red-600" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t('auth.phone')}</Label>
          <Input id="phone" type="tel" autoComplete="tel" {...register('phone')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" required>
            {t('auth.password')}
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

        {error ? <Alert variant="error">{error}</Alert> : null}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="sm" label={t('common.loading')} /> : t('auth.submitRegister')}
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs uppercase tracking-wide text-slate-400">{t('auth.orContinueWith')}</span>
          <Separator className="flex-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href="/api/v1/auth/oauth/google"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t('auth.continueWithGoogle')}
          </a>
          <a
            href="/api/v1/auth/oauth/microsoft"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t('auth.continueWithMicrosoft')}
          </a>
        </div>

        <p className="text-center text-sm text-slate-600">
          {t('auth.haveAccount')}{' '}
          <Link
            to="/login"
            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('auth.login')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
