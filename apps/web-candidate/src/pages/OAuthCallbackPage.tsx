import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Spinner, Surface } from '@cbt/ui';
import { useAuth } from '@/lib/auth';

export function OAuthCallbackPage() {
  const { t } = useTranslation();
  const { acceptToken } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');

    if (!accessToken) {
      setStatus('error');
      return;
    }

    acceptToken(accessToken)
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'));
  }, [acceptToken]);

  if (status === 'done') return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-slate-50 p-6">
      <div className="w-full max-w-md">
        <Surface className="p-8 text-center">
          {status === 'loading' ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <Spinner size="lg" label={t('common.loading')} />
              <p className="text-sm text-slate-600">{t('oauth.signingIn')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert variant="error">{t('oauth.failed')}</Alert>
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
