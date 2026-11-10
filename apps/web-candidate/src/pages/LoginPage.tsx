import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Input, Label, Separator, Spinner } from '@cbt/ui';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useAuth, OtpRequiredError } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';

interface SsoProviders {
  google: boolean;
  microsoft: boolean;
  ldap: boolean;
  saml: boolean;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otp: z.string().length(6).optional().or(z.literal('')),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [needsOtp, setNeedsOtp] = useState(false);
  const [ssoProviders, setSsoProviders] = useState<SsoProviders | null>(null);

  useEffect(() => {
    api
      .get<SsoProviders>('/api/v1/auth/sso/providers')
      .then(setSsoProviders)
      .catch(() => setSsoProviders({ google: false, microsoft: false, ldap: false, saml: false }));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    try {
      await login(data.email, data.password, data.otp || undefined);
    } catch (e) {
      if (e instanceof OtpRequiredError || (e instanceof ApiError && e.code === 'OTP_REQUIRED')) {
        setNeedsOtp(true);
        setError(t('auth.otpRequired'));
        return;
      }
      setError(e instanceof ApiError ? e.message : t('common.error'));
    }
  };

  const startOAuth = (provider: 'google' | 'microsoft') => {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `/api/v1/auth/oauth/${provider}?return_to=${returnTo}`;
  };

  return (
    <AuthLayout title={t('auth.login')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email" required>
            {t('auth.email')}
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email ? (
            <p id="email-error" className="text-sm text-red-600" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>
              {t('auth.password')}
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            aria-invalid={!!errors.password}
          />
        </div>

        {needsOtp ? (
          <div className="space-y-2">
            <Label htmlFor="otp">{t('auth.otp')}</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-describedby="otp-hint"
              {...register('otp')}
            />
            <p id="otp-hint" className="text-xs text-slate-500">
              {t('auth.otpHint')}
            </p>
          </div>
        ) : null}

        {error ? <Alert variant="error">{error}</Alert> : null}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="sm" label={t('common.loading')} /> : t('auth.submitLogin')}
        </Button>

        {ssoProviders && (ssoProviders.google || ssoProviders.microsoft) ? (
          <>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs uppercase tracking-wide text-slate-400">
                {t('auth.orContinueWith')}
              </span>
              <Separator className="flex-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {ssoProviders.google ? (
                <Button type="button" variant="outline" className="w-full" onClick={() => startOAuth('google')}>
                  {t('auth.continueWithGoogle')}
                </Button>
              ) : null}
              {ssoProviders.microsoft ? (
                <Button type="button" variant="outline" className="w-full" onClick={() => startOAuth('microsoft')}>
                  {t('auth.continueWithMicrosoft')}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        <p className="text-center text-sm text-slate-600">
          {t('auth.noAccount')}{' '}
          <Link
            to="/register"
            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('auth.register')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
