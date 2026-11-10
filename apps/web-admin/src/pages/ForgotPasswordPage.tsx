import { useState } from 'react';
import { Link } from 'react-router-dom';
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
      await api.post('/api/v1/auth/password-reset/request', { email: data.email, portal: 'admin' });
      setSubmitted(true);
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
                  {t('auth.forgotPasswordTitle')}
                </h1>
                <p className="text-sm text-slate-600">{t('auth.forgotPasswordDescription')}</p>
              </header>

              {submitted ? (
                <Alert variant="success">{t('auth.resetEmailSent')}</Alert>
              ) : (
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
                      {...register('email')}
                    />
                    {errors.email ? (
                      <p className="text-sm text-red-600" role="alert">
                        {errors.email.message}
                      </p>
                    ) : null}
                  </div>

                  {error ? <Alert variant="error">{error}</Alert> : null}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Spinner size="sm" label={t('common.loading')} />
                    ) : (
                      t('auth.sendResetLink')
                    )}
                  </Button>
                </form>
              )}

              <p className="text-center text-sm text-slate-600">
                <Link
                  to="/login"
                  className="font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {t('auth.backToLogin')}
                </Link>
              </p>
            </CardContent>
          </Card>
        </Surface>
      </motion.div>
    </div>
  );
}
