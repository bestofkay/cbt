import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Spinner, Surface } from '@cbt/ui';
import { setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageMotion } from '@/components/PageMotion';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');

      if (!token) {
        setError(t('oauthCallback.missingToken'));
        return;
      }

      setAccessToken(token);
      try {
        await refreshUser();
        navigate('/', { replace: true });
      } catch {
        setError(t('oauthCallback.failed'));
      }
    })();
  }, [navigate, refreshUser, t]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <PageMotion className="w-full max-w-md">
        <Surface className="p-8 text-center">
          {error ? (
            <Alert variant="error">{error}</Alert>
          ) : (
            <div className="space-y-4">
              <Spinner size="lg" label={t('common.loading')} />
              <p className="text-sm text-slate-600">{t('oauthCallback.signingIn')}</p>
            </div>
          )}
        </Surface>
      </PageMotion>
    </div>
  );
}
