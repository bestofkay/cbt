import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Input,
  Label,
  Spinner,
  Surface,
} from '@cbt/ui';
import { useAuth, OtpRequiredError } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { darkInput, darkSurface } from '@/lib/theme';

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
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
            {t('app.name')}
          </h1>
          <p className="mt-2 text-sm text-slate-400">{t('auth.subtitle')}</p>
        </div>

        <Surface className={`${darkSurface} p-6 sm:p-8`}>
          <h2 className="font-serif text-xl font-semibold text-slate-100">{t('auth.login')}</h2>
          <p className="mt-1 text-sm text-slate-400">{t('auth.description')}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email" required className="text-slate-300">
                {t('auth.email')}
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={darkInput}
                {...register('email')}
              />
              {errors.email ? (
                <p id="email-error" className="text-sm text-red-400" role="alert">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" required className="text-slate-300">
                  {t('auth.password')}
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary-300 hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
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

            {needsOtp ? (
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-slate-300">
                  {t('auth.otp')}
                </Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  aria-describedby="otp-hint"
                  className={darkInput}
                  {...register('otp')}
                />
                <p id="otp-hint" className="text-xs text-slate-500">
                  {t('auth.otpHint')}
                </p>
              </div>
            ) : null}

            {error ? (
              <Alert variant="error" className="border-red-800/60 bg-red-950/50 text-red-200">
                {error}
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" variant="default" disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" /> : t('auth.submit')}
            </Button>
          </form>
        </Surface>
      </motion.div>
    </div>
  );
}
