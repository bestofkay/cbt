import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Input, Label, Spinner, Surface } from '@cbt/ui';
import { api, ApiError } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface CertificateVerification {
  valid: boolean;
  certificateNo?: string;
  verificationCode?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  holderName?: string;
  examTitle?: string;
  percent?: number;
  passed?: boolean;
}

export function CertificateVerifyPage() {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [input, setInput] = useState(code ?? '');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['certificate-verify', code],
    queryFn: () => api.get<CertificateVerification>(`/api/v1/certificates/verify/${code}`),
    enabled: !!code,
    retry: false,
  });

  const notFound = isError && error instanceof ApiError && error.status === 404;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 p-6">
      <PageMotion className="w-full max-w-lg">
        <Surface className="p-8">
          <header className="mb-6 space-y-1 text-center">
            <h1 className="font-serif text-2xl font-semibold text-primary-950">
              {t('certificateVerify.title')}
            </h1>
            <p className="text-sm text-slate-600">{t('certificateVerify.description')}</p>
          </header>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = input.trim();
              if (trimmed) navigate(`/certificates/verify/${encodeURIComponent(trimmed)}`);
            }}
            className="mb-6 space-y-3"
          >
            <Label htmlFor="verify-code">{t('certificateVerify.codeLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="verify-code"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('certificateVerify.codePlaceholder')}
              />
              <Button type="submit">{t('certificateVerify.verify')}</Button>
            </div>
          </form>

          {code ? (
            isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner size="lg" label={t('common.loading')} />
              </div>
            ) : notFound || (data && !data.valid) ? (
              <Alert variant="error">{t('certificateVerify.invalid')}</Alert>
            ) : isError ? (
              <Alert variant="error">{t('common.error')}</Alert>
            ) : data ? (
              <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-serif text-lg font-semibold text-emerald-900">
                    {t('certificateVerify.valid')}
                  </p>
                  <Badge variant="success">{data.passed ? t('results.passedLabel') : t('results.failedLabel')}</Badge>
                </div>
                <dl className="space-y-2 text-sm text-slate-700">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">{t('certificateVerify.holder')}</dt>
                    <dd className="font-medium">{data.holderName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">{t('certificateVerify.exam')}</dt>
                    <dd className="font-medium">{data.examTitle}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">{t('certificateVerify.certificateNo')}</dt>
                    <dd className="font-mono">{data.certificateNo}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">{t('certificateVerify.score')}</dt>
                    <dd className="font-medium">{data.percent}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">{t('certificateVerify.issuedAt')}</dt>
                    <dd>{data.issuedAt ? new Date(data.issuedAt).toLocaleDateString() : '—'}</dd>
                  </div>
                </dl>
              </div>
            ) : null
          ) : null}
        </Surface>
      </PageMotion>
    </div>
  );
}
