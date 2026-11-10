import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Input, Label, Spinner, Surface } from '@cbt/ui';
import { api } from '@/lib/api';
import { darkInput, darkSurface } from '@/lib/theme';

const schema = z.object({
  email: z.string().email(),
});

type ForgotPasswordForm = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setError(null);
    try {
      await api.post('/api/v1/auth/password-reset/request', {
        email: data.email,
        portal: 'proctor',
      });
      setSubmitted(true);
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
            {t('auth.forgotPasswordTitle')}
          </h1>
          <p className="mt-2 text-sm text-slate-400">{t('auth.forgotPasswordDescription')}</p>
        </div>

        <Surface className={`${darkSurface} p-6 sm:p-8`}>
          {submitted ? (
            <Alert variant="success" className="border-emerald-800/60 bg-emerald-950/50 text-emerald-200">
              {t('auth.resetEmailSent')}
            </Alert>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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

              {error ? (
                <Alert variant="error" className="border-red-800/60 bg-red-950/50 text-red-200">
                  {error}
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" variant="default" disabled={isSubmitting}>
                {isSubmitting ? <Spinner size="sm" /> : t('auth.sendResetLink')}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-400">
            <Link
              to="/login"
              className="font-medium text-primary-300 hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              {t('auth.backToLogin')}
            </Link>
          </p>
        </Surface>
      </motion.div>
    </div>
  );
}
