import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
  Separator,
  Spinner,
  Surface,
} from '@cbt/ui';
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
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary-800 to-primary-950 p-12 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary-100/80">
            {t('app.tagline')}
          </p>
        </div>
        <div className="relative space-y-6">
          <h1 className="font-serif text-5xl font-semibold leading-tight tracking-tight xl:text-6xl">
            {t('app.name')}
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-primary-100/90">
            {t('auth.heroDescription')}
          </p>
        </div>
        <p className="relative text-sm text-primary-200/70">{t('auth.heroFooter')}</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden">
            <h1 className="font-serif text-3xl font-semibold text-primary-950">{t('app.name')}</h1>
            <p className="mt-1 text-sm text-slate-600">{t('app.tagline')}</p>
          </div>

          <Surface className="p-0">
            <Card className="border-0 bg-transparent shadow-none">
              <CardContent className="space-y-6 p-6 sm:p-8">
                <header className="space-y-1">
                  <h2 className="font-serif text-2xl font-semibold text-primary-950">
                    {t('auth.welcomeBack')}
                  </h2>
                  <p className="text-sm text-slate-600">{t('auth.signInDescription')}</p>
                </header>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="email" required>
                      {t('auth.email')}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      {...register('email')}
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
                        className="text-xs font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        {t('auth.forgotPassword')}
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      aria-invalid={!!errors.password}
                      {...register('password')}
                    />
                    {errors.password ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.password.message}
                      </p>
                    ) : null}
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

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Spinner size="sm" label={t('common.loading')} />
                    ) : (
                      t('auth.submit')
                    )}
                  </Button>
                </form>

                {ssoProviders && (ssoProviders.google || ssoProviders.microsoft) ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Separator className="flex-1" />
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {t('auth.orContinueWith')}
                      </span>
                      <Separator className="flex-1" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ssoProviders.google ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const returnTo = encodeURIComponent(window.location.origin);
                            window.location.href = `/api/v1/auth/oauth/google?return_to=${returnTo}`;
                          }}
                        >
                          {t('auth.continueWithGoogle')}
                        </Button>
                      ) : null}
                      {ssoProviders.microsoft ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const returnTo = encodeURIComponent(window.location.origin);
                            window.location.href = `/api/v1/auth/oauth/microsoft?return_to=${returnTo}`;
                          }}
                        >
                          {t('auth.continueWithMicrosoft')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </Surface>
        </motion.div>
      </div>
    </div>
  );
}
