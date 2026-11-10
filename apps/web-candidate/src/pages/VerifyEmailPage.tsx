import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Spinner, Surface } from '@cbt/ui';
import { api, ApiError } from '@/lib/api';

type Status = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
  const [message, setMessage] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        await api.post('/api/v1/auth/verify-email', { token });
        setStatus('success');
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof ApiError ? e.message : t('common.error'));
      }
    })();
  }, [token, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-slate-50 p-6">
      <div className="w-full max-w-md">
        <Surface className="p-8 text-center">
          <h1 className="mb-4 font-serif text-2xl font-semibold text-primary-950">
            {t('verifyEmail.title')}
          </h1>

          {status === 'loading' ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <Spinner size="lg" label={t('common.loading')} />
              <p className="text-sm text-slate-600">{t('verifyEmail.verifying')}</p>
            </div>
          ) : status === 'success' ? (
            <div className="space-y-4">
              <Alert variant="success">{t('verifyEmail.success')}</Alert>
              <Link
                to="/login"
                className="inline-block text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert variant="error">{message ?? t('verifyEmail.missingToken')}</Alert>
              <Link
                to="/login"
                className="inline-block text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('auth.backToLogin')}
              </Link>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
