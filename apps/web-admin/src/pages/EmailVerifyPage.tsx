import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Spinner, Surface } from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

export function EmailVerifyPage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      return;
    }

    api
      .post('/api/v1/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <PageMotion className="w-full max-w-md">
        <Surface className="space-y-4 p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-primary-950">
            {t('emailVerify.title')}
          </h1>
          {status === 'loading' ? (
            <div className="flex justify-center py-4">
              <Spinner size="lg" label={t('common.loading')} />
            </div>
          ) : status === 'success' ? (
            <Alert variant="success">{t('emailVerify.success')}</Alert>
          ) : (
            <Alert variant="error">{t('emailVerify.failed')}</Alert>
          )}
          <Link
            to="/login"
            className="inline-block text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t('auth.backToLogin')}
          </Link>
        </Surface>
      </PageMotion>
    </div>
  );
}
