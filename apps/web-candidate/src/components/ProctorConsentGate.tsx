import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Spinner, Surface } from '@cbt/ui';
import type { ProctoringPolicy } from '@/lib/proctoring-policy';
import { policyNeedsMedia } from '@/lib/proctoring-policy';

interface Props {
  policy: ProctoringPolicy;
  onReady: () => Promise<void>;
  statusError: string | null;
}

export function ProctorConsentGate({ policy, onReady, statusError }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!policyNeedsMedia(policy) && !policy.requireConsent) {
    return null;
  }

  const items = [
    policy.webcam || policy.faceDetection ? t('proctoring.needWebcam') : null,
    policy.microphone || policy.voiceDetection ? t('proctoring.needMic') : null,
    policy.screenShare ? t('proctoring.needScreen') : null,
    policy.geolocation ? t('proctoring.needGeo') : null,
  ].filter(Boolean) as string[];

  const handleContinue = async () => {
    setBusy(true);
    setError(null);
    try {
      await onReady();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('proctoring.startFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/70 p-4 backdrop-blur-sm">
      <Surface className="w-full max-w-lg space-y-5 p-6 sm:p-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">
            {t('proctoring.badge')}
          </p>
          <h2 className="font-serif text-2xl font-semibold text-primary-950">
            {t('proctoring.title')}
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">{t('proctoring.description')}</p>
        </header>

        <ul className="space-y-2 rounded-md border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {policy.screenShareRequired ? (
          <Alert variant="warning">{t('proctoring.screenRequired')}</Alert>
        ) : null}

        {error || statusError ? <Alert variant="error">{error ?? statusError}</Alert> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={() => void handleContinue()} disabled={busy} className="sm:min-w-[10rem]">
            {busy ? <Spinner size="sm" label={t('common.loading')} /> : t('proctoring.allowAndStart')}
          </Button>
        </div>
        <p className="text-xs text-slate-500">{t('proctoring.privacyNote')}</p>
      </Surface>
    </div>
  );
}
