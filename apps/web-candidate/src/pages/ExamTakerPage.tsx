import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  Spinner,
  Surface,
  Textarea,
  cn,
} from '@cbt/ui';
import { api } from '@/lib/api';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useExamCountdownSocket, useProctoringGuards } from '@/hooks/useProctoring';
import { useAdvancedProctoring } from '@/hooks/useAdvancedProctoring';
import { ProctorConsentGate } from '@/components/ProctorConsentGate';
import {
  DEFAULT_FULL_POLICY,
  policyNeedsMedia,
  type ProctoringPolicy,
} from '@/lib/proctoring-policy';

interface AttemptChoice {
  id?: string;
  label: string;
  content: string;
}

interface AttemptQuestion {
  id: string;
  index: number;
  stem: string;
  type: string;
  choices?: AttemptChoice[];
  answered: boolean;
  bookmarked: boolean;
  flagged: boolean;
  response?: unknown;
}

interface AttemptState {
  id: string;
  attemptId?: string;
  examSessionId?: string;
  examTitle: string;
  examMode?: string;
  remainingSeconds: number | null;
  questions: AttemptQuestion[];
  currentQuestionId: string | null;
  proctoringPolicy?: ProctoringPolicy;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function choiceKey(choice: AttemptChoice) {
  return choice.id ?? choice.label;
}

function parseResponse(question: AttemptQuestion): {
  choiceId: string;
  choiceIds: string[];
  text: string;
} {
  const resp = question.response;
  if (typeof resp === 'string') {
    return { choiceId: resp, choiceIds: [], text: resp };
  }
  if (resp && typeof resp === 'object') {
    const obj = resp as { choiceId?: string; choiceIds?: string[]; text?: string };
    return {
      choiceId: obj.choiceId ?? '',
      choiceIds: Array.isArray(obj.choiceIds) ? obj.choiceIds : [],
      text: obj.text ?? '',
    };
  }
  return { choiceId: '', choiceIds: [], text: '' };
}

export function ExamTakerPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [choiceId, setChoiceId] = useState('');
  const [choiceIds, setChoiceIds] = useState<string[]>([]);
  const [textResponse, setTextResponse] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [proctorReady, setProctorReady] = useState(false);
  const { isOnline, pendingCount, isSyncing, saveAnswer } = useOfflineSync(attemptId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => api.get<AttemptState>(`/api/v1/attempts/${attemptId}`),
    enabled: !!attemptId,
    refetchInterval: 60_000,
  });

  const policy = data?.proctoringPolicy ?? DEFAULT_FULL_POLICY;
  const needsConsent = policyNeedsMedia(policy) || policy.requireConsent;
  const mediaEnabled = proctorReady || !needsConsent;

  useProctoringGuards(attemptId, mediaEnabled);
  const {
    status: mediaStatus,
    videoRef,
    canvasRef,
    start: startMedia,
  } = useAdvancedProctoring(attemptId, policy, mediaEnabled);

  useEffect(() => {
    if (!needsConsent) setProctorReady(true);
  }, [needsConsent]);

  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (data?.remainingSeconds != null) setRemaining(data.remainingSeconds);
  }, [data]);

  const currentIndex = useMemo(
    () => data?.questions.findIndex((q) => q.id === data.currentQuestionId) ?? 0,
    [data],
  );

  const currentQuestion = data?.questions[currentIndex];
  const unansweredCount = useMemo(
    () => data?.questions.filter((q) => !q.answered).length ?? 0,
    [data],
  );

  useEffect(() => {
    if (!currentQuestion) return;
    const parsed = parseResponse(currentQuestion);
    setChoiceId(parsed.choiceId);
    setChoiceIds(parsed.choiceIds);
    setTextResponse(parsed.text);
  }, [currentQuestion?.id, currentQuestion?.response]);

  const navigateQuestion = useMutation({
    mutationFn: (questionId: string) =>
      api.patch<AttemptState>(`/api/v1/attempts/${attemptId}/navigate`, { questionId }),
    onSuccess: (updated) => queryClient.setQueryData(['attempt', attemptId], updated),
  });

  const toggleBookmark = useMutation({
    mutationFn: (questionId: string) =>
      api.post(`/api/v1/attempts/${attemptId}/bookmark`, { questionId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] }),
  });

  const toggleFlag = useMutation({
    mutationFn: (questionId: string) =>
      api.post(`/api/v1/attempts/${attemptId}/flag`, { questionId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] }),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/attempts/${attemptId}/submit`, { confirm: true }),
    onSuccess: () => navigate('/results'),
  });

  useExamCountdownSocket(
    attemptId,
    data?.examSessionId,
    (seconds) => setRemaining(seconds),
    () => {
      void submitMutation.mutate();
    },
  );

  const buildResponse = useCallback((): unknown => {
    if (!currentQuestion) return null;
    const type = currentQuestion.type;
    if (type === 'MULTIPLE_RESPONSE') {
      return { choiceIds };
    }
    if (type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
      return { choiceId };
    }
    return { text: textResponse };
  }, [choiceId, choiceIds, currentQuestion, textResponse]);

  const handleSaveAnswer = useCallback(async () => {
    if (!currentQuestion || !attemptId) return;
    const response = buildResponse();
    await saveAnswer(currentQuestion.id, response);
    setSaveStatus('saved');
    queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] });
    window.setTimeout(() => setSaveStatus('idle'), 2000);
  }, [attemptId, buildResponse, currentQuestion, queryClient, saveAnswer]);

  const goToQuestion = (index: number) => {
    const question = data?.questions[index];
    if (question) navigateQuestion.mutate(question.id);
  };

  const goPrev = () => {
    if (currentIndex > 0) goToQuestion(currentIndex - 1);
  };

  const goNext = () => {
    if (data && currentIndex < data.questions.length - 1) goToQuestion(currentIndex + 1);
  };

  const toggleMultiChoice = (id: string) => {
    setChoiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  if (isError || !data || !currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="error">{t('common.error')}</Alert>
      </div>
    );
  }

  const isChoiceType =
    currentQuestion.type === 'MULTIPLE_CHOICE' ||
    currentQuestion.type === 'TRUE_FALSE' ||
    currentQuestion.type === 'MULTIPLE_RESPONSE';

  return (
    <div className="min-h-screen">
      {needsConsent && !proctorReady ? (
        <ProctorConsentGate
          policy={policy}
          statusError={mediaStatus.error}
          onReady={async () => {
            await startMedia();
            setProctorReady(true);
          }}
        />
      ) : null}

      {/* Capture + preview for face / presence detection */}
      <canvas ref={canvasRef} className="pointer-events-none fixed h-px w-px opacity-0" aria-hidden />

      {mediaEnabled && (policy.webcam || policy.faceDetection) ? (
        <div className="fixed bottom-4 right-4 z-30 overflow-hidden rounded-lg border border-slate-200 bg-white/90 shadow-lg backdrop-blur-sm">
          <video
            ref={videoRef}
            className="h-28 w-40 object-cover"
            muted
            playsInline
            autoPlay
          />
          <div className="flex items-center justify-between gap-2 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <span>
              {mediaStatus.faceCount >= 2
                ? t('proctoring.multiFace')
                : mediaStatus.faceCount === 1
                  ? t('proctoring.faceOk')
                  : t('proctoring.faceMissing')}
            </span>
            {mediaStatus.screenActive ? <span className="text-primary">{t('proctoring.sharing')}</span> : null}
          </div>
        </div>
      ) : (
        <video ref={videoRef} className="pointer-events-none fixed h-px w-px opacity-0" muted playsInline aria-hidden />
      )}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <h1 className="font-serif text-lg font-semibold text-primary-950">{data.examTitle}</h1>
            <p className="text-sm text-slate-500">
              {t('exam.question')} {currentIndex + 1} {t('exam.of')} {data.questions.length}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isOnline ? (
              <Badge variant="warning" aria-live="polite">
                {t('common.offline')} ({pendingCount})
              </Badge>
            ) : isSyncing ? (
              <Badge variant="secondary" aria-live="polite">
                {t('exam.syncing')}
              </Badge>
            ) : pendingCount > 0 ? (
              <Badge variant="warning" aria-live="polite">
                {t('exam.pendingSync', { count: pendingCount })}
              </Badge>
            ) : null}
            <div
              className={cn(
                'rounded-md px-3 py-1.5 font-mono text-sm font-semibold tabular-nums',
                (remaining ?? 0) < 300
                  ? 'bg-red-100 text-red-800'
                  : 'bg-primary-50 text-primary-800',
              )}
              role="timer"
              aria-live="polite"
              aria-label={t('exam.timeRemaining')}
            >
              {formatTime(remaining ?? 0)}
            </div>
            <Button variant="accent" onClick={() => setSubmitOpen(true)}>
              {t('exam.submit')}
            </Button>
          </div>
        </div>
      </header>

      {unansweredCount > 0 ? (
        <div className="border-b border-accent-200/60 bg-accent-50/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-sm">
            <span className="text-accent-900">
              {t('exam.reviewUnanswered', { count: unansweredCount })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSubmitOpen(true)}>
              {t('exam.reviewSubmit')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[1fr_260px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            <Surface className="p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="font-serif text-lg font-semibold text-primary-950">
                  {t('exam.question')} {currentIndex + 1}
                </span>
                {currentQuestion.flagged ? (
                  <Badge variant="warning">{t('exam.flag')}</Badge>
                ) : null}
                {currentQuestion.bookmarked ? (
                  <Badge variant="secondary">{t('exam.bookmark')}</Badge>
                ) : null}
              </div>

              <div className="prose prose-slate max-w-none font-serif text-slate-800">
                {currentQuestion.stem}
              </div>

              <Separator className="my-6" />

              {currentQuestion.type === 'TRUE_FALSE' && currentQuestion.choices ? (
                <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={t('exam.selectAnswer')}>
                  {currentQuestion.choices.map((choice) => {
                    const id = choiceKey(choice);
                    const selected = choiceId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setChoiceId(id)}
                        aria-pressed={selected}
                        className={cn(
                          'rounded-lg border-2 px-6 py-4 text-left text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                          selected
                            ? 'border-primary bg-primary-50 text-primary-900'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-primary-200',
                        )}
                      >
                        {choice.content}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {currentQuestion.type === 'MULTIPLE_CHOICE' && currentQuestion.choices ? (
                <fieldset className="space-y-3">
                  <legend className="sr-only">{t('exam.selectAnswer')}</legend>
                  {currentQuestion.choices.map((choice) => {
                    const id = choiceKey(choice);
                    const selected = choiceId === id;
                    return (
                      <label
                        key={id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                          selected
                            ? 'border-primary bg-primary-50'
                            : 'border-slate-200 hover:border-primary-200',
                        )}
                      >
                        <input
                          type="radio"
                          name="answer"
                          value={id}
                          checked={selected}
                          onChange={() => setChoiceId(id)}
                          className="mt-1"
                          aria-label={`${choice.label}. ${choice.content}`}
                        />
                        <span>
                          <span className="font-medium">{choice.label}.</span> {choice.content}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}

              {currentQuestion.type === 'MULTIPLE_RESPONSE' && currentQuestion.choices ? (
                <fieldset className="space-y-3">
                  <legend className="mb-2 text-sm text-slate-600">{t('exam.selectAll')}</legend>
                  {currentQuestion.choices.map((choice) => {
                    const id = choiceKey(choice);
                    const checked = choiceIds.includes(id);
                    return (
                      <label
                        key={id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                          checked
                            ? 'border-primary bg-primary-50'
                            : 'border-slate-200 hover:border-primary-200',
                        )}
                      >
                        <input
                          type="checkbox"
                          value={id}
                          checked={checked}
                          onChange={() => toggleMultiChoice(id)}
                          className="mt-1"
                          aria-label={`${choice.label}. ${choice.content}`}
                        />
                        <span>
                          <span className="font-medium">{choice.label}.</span> {choice.content}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}

              {!isChoiceType ? (
                <div className="space-y-2">
                  <label htmlFor="answer-text" className="sr-only">
                    {t('exam.yourAnswer')}
                  </label>
                  <Textarea
                    id="answer-text"
                    rows={6}
                    value={textResponse}
                    onChange={(e) => setTextResponse(e.target.value)}
                    aria-label={t('exam.yourAnswer')}
                  />
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button onClick={() => handleSaveAnswer()}>{t('exam.saveAnswer')}</Button>
                <Button
                  variant="outline"
                  onClick={() => toggleBookmark.mutate(currentQuestion.id)}
                  aria-pressed={currentQuestion.bookmarked}
                >
                  {t('exam.bookmark')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toggleFlag.mutate(currentQuestion.id)}
                  aria-pressed={currentQuestion.flagged}
                >
                  {t('exam.flag')}
                </Button>
                {saveStatus === 'saved' ? (
                  <span className="text-sm text-emerald-700" role="status">
                    {t('exam.saved')}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
                <Button
                  variant="outline"
                  onClick={goPrev}
                  disabled={currentIndex === 0 || navigateQuestion.isPending}
                >
                  {t('exam.previous')}
                </Button>
                <Button
                  onClick={goNext}
                  disabled={
                    currentIndex >= data.questions.length - 1 || navigateQuestion.isPending
                  }
                >
                  {t('exam.next')}
                </Button>
              </div>
            </Surface>
          </motion.div>
        </AnimatePresence>

        <aside>
          <Surface className="p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">{t('exam.navigation')}</p>
            <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-300" aria-hidden />
                {t('exam.legendAnswered')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border-2 border-primary-400" aria-hidden />
                {t('exam.legendBookmarked')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-white ring-2 ring-accent" aria-hidden />
                {t('exam.legendFlagged')}
              </span>
            </div>
            <nav aria-label={t('exam.navigation')} className="grid grid-cols-5 gap-2">
              {data.questions.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => navigateQuestion.mutate(q.id)}
                  disabled={navigateQuestion.isPending}
                  className={cn(
                    'relative flex h-10 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                    q.id === currentQuestion.id
                      ? 'bg-primary text-white'
                      : q.answered
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    q.bookmarked && q.id !== currentQuestion.id ? 'ring-2 ring-primary-300' : '',
                  )}
                  aria-label={`${t('exam.question')} ${idx + 1}${q.answered ? `, ${t('exam.legendAnswered')}` : ''}${q.bookmarked ? `, ${t('exam.bookmark')}` : ''}${q.flagged ? `, ${t('exam.flag')}` : ''}`}
                  aria-current={q.id === currentQuestion.id ? 'step' : undefined}
                >
                  {idx + 1}
                  {q.flagged ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              ))}
            </nav>
          </Surface>
        </aside>
      </div>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('exam.submit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p>{t('exam.confirmSubmit')}</p>
            {unansweredCount > 0 ? (
              <Alert variant="warning">
                {t('exam.unansweredWarning', { count: unansweredCount })}
              </Alert>
            ) : (
              <Alert variant="success">{t('exam.allAnswered')}</Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="accent" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
              {submitMutation.isPending ? <Spinner size="sm" label={t('common.loading')} /> : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
