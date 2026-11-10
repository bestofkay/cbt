import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Input, Label, Spinner, Surface } from '@cbt/ui';
import { api, ApiError } from '@/lib/api';

interface CertificateVerification {
  valid: boolean;
  certificateNo: string;
  verificationCode: string;
  issuedAt: string;
  expiresAt?: string | null;
  holderName: string;
  examTitle: string;
  percent: number;
  passed: boolean;
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) navigate(`/certificates/verify/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg"
      >
        <Surface className="p-8">
          <header className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">
              {t('certificates.eyebrow')}
            </p>
            <h1 className="mt-2 font-serif text-2xl font-semibold text-primary-950">
              {t('certificates.title')}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{t('certificates.description')}</p>
          </header>

          <form onSubmit={onSubmit} className="mb-6 flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="code" className="sr-only">
                {t('certificates.codeLabel')}
              </Label>
              <Input
                id="code"
                placeholder={t('certificates.codePlaceholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <Button type="submit">{t('certificates.verify')}</Button>
          </form>

          {!code ? null : isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" label={t('common.loading')} />
            </div>
          ) : isError ? (
            <Alert variant="error">
              {error instanceof ApiError ? error.message : t('certificates.notFound')}
            </Alert>
          ) : data ? (
            <div className="space-y-4 rounded-md border border-primary-100 bg-primary-50/40 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-semibold text-primary-950">
                  {t('certificates.valid')}
                </h2>
                <Badge variant={data.passed ? 'success' : 'destructive'}>
                  {data.passed ? t('results.passed') : t('results.failed')}
                </Badge>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t('certificates.holder')}</dt>
                  <dd className="font-medium text-primary-900">{data.holderName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t('certificates.exam')}</dt>
                  <dd className="font-medium text-primary-900">{data.examTitle}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t('results.score')}</dt>
                  <dd className="font-medium text-primary-900">{data.percent}%</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t('certificates.number')}</dt>
                  <dd className="font-mono font-medium text-primary-900">{data.certificateNo}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{t('certificates.issuedAt')}</dt>
                  <dd className="font-medium text-primary-900">
                    {new Date(data.issuedAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </Surface>
      </motion.div>
    </div>
  );
}
