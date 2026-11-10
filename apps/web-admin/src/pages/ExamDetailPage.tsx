import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  Input,
  Label,
  PageHeader,
  Spinner,
  Surface,
  Tabs,
  Textarea,
} from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface ExamSection {
  id?: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  durationMinutes?: number | null;
}

interface ExamQuestionRule {
  id?: string;
  questionId?: string | null;
  sectionId?: string | null;
  points: number;
  sortOrder: number;
  isMandatory?: boolean;
  question?: { code: string } | null;
}

interface ExamDetail {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  passingScore: number;
  maxAttempts: number;
  status: string;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  certificateEnabled?: boolean;
  instructions?: string | null;
  retakePolicy?: { maxRetakes?: number } | null;
  sections: ExamSection[];
  questionRules: ExamQuestionRule[];
}

const sectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  sortOrder: z.coerce.number().int().default(0),
});

const ruleSchema = z.object({
  id: z.string().optional(),
  questionId: z.string().min(1, 'Question ID is required'),
  points: z.coerce.number().positive(),
  sortOrder: z.coerce.number().int().default(0),
});

const examDetailSchema = z.object({
  title: z.string().min(1).max(250),
  durationMinutes: z.coerce.number().int().positive(),
  passingScore: z.coerce.number().min(0).max(100),
  maxAttempts: z.coerce.number().int().positive(),
  shuffleQuestions: z.boolean(),
  shuffleChoices: z.boolean(),
  certificateEnabled: z.boolean(),
  instructions: z.string().optional(),
  maxRetakes: z.coerce.number().int().min(0).optional(),
  sections: z.array(sectionSchema),
  questionRules: z.array(ruleSchema),
});

type ExamDetailForm = z.infer<typeof examDetailSchema>;

export function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [saved, setSaved] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['exam-detail', id],
    queryFn: () => api.get<ExamDetail>(`/api/v1/exams/${id}`),
    enabled: !!id,
  });

  const form = useForm<ExamDetailForm>({
    resolver: zodResolver(examDetailSchema),
    defaultValues: {
      title: '',
      durationMinutes: 60,
      passingScore: 50,
      maxAttempts: 1,
      shuffleQuestions: false,
      shuffleChoices: false,
      certificateEnabled: false,
      instructions: '',
      maxRetakes: 0,
      sections: [],
      questionRules: [],
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        title: data.title,
        durationMinutes: data.durationMinutes,
        passingScore: data.passingScore,
        maxAttempts: data.maxAttempts,
        shuffleQuestions: !!data.shuffleQuestions,
        shuffleChoices: !!data.shuffleChoices,
        certificateEnabled: !!data.certificateEnabled,
        instructions: data.instructions ?? '',
        maxRetakes: data.retakePolicy?.maxRetakes ?? 0,
        sections: (data.sections ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          sortOrder: s.sortOrder,
        })),
        questionRules: (data.questionRules ?? []).map((r) => ({
          id: r.id,
          questionId: r.questionId ?? '',
          points: r.points,
          sortOrder: r.sortOrder,
        })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const sectionsArray = useFieldArray({ control: form.control, name: 'sections' });
  const rulesArray = useFieldArray({ control: form.control, name: 'questionRules' });

  const saveMutation = useMutation({
    mutationFn: (values: ExamDetailForm) =>
      api.put<ExamDetail>(`/api/v1/exams/${id}`, {
        title: values.title,
        durationMinutes: values.durationMinutes,
        passingScore: values.passingScore,
        maxAttempts: values.maxAttempts,
        shuffleQuestions: values.shuffleQuestions,
        shuffleChoices: values.shuffleChoices,
        certificateEnabled: values.certificateEnabled,
        instructions: values.instructions || null,
        retakePolicy: { maxRetakes: values.maxRetakes ?? 0 },
        sections: values.sections.map((s) => ({
          id: s.id,
          title: s.title,
          sortOrder: s.sortOrder,
        })),
        questionRules: values.questionRules.map((r) => ({
          id: r.id,
          questionId: r.questionId,
          points: r.points,
          sortOrder: r.sortOrder,
        })),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['exam-detail', id] });
      queryClient.setQueryData(['exam-detail', id], updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const tabs = [
    { id: 'overview', label: t('examDetail.tabs.overview') },
    { id: 'sections', label: t('examDetail.tabs.sections') },
    { id: 'rules', label: t('examDetail.tabs.rules') },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <PageMotion>
        <Alert variant="error">{t('common.error')}</Alert>
      </PageMotion>
    );
  }

  return (
    <PageMotion className="space-y-6">
      <div>
        <Link
          to="/exams"
          className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('examDetail.backToList')}
        </Link>
      </div>

      <PageHeader
        title={data.title}
        description={data.code}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={data.status === 'PUBLISHED' ? 'success' : 'outline'}>{data.status}</Badge>
            <Link
              to={`/exams/${id}/analytics`}
              className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t('examDetail.viewAnalytics')}
            </Link>
          </div>
        }
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-6">
        {tab === 'overview' ? (
          <Surface className="max-w-3xl space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="title" required>
                {t('exams.examTitle')}
              </Label>
              <Input id="title" {...form.register('title')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="durationMinutes">{t('exams.duration')}</Label>
                <Input id="durationMinutes" type="number" min={1} {...form.register('durationMinutes')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passingScore">{t('exams.passingScore')}</Label>
                <Input
                  id="passingScore"
                  type="number"
                  min={0}
                  max={100}
                  {...form.register('passingScore')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAttempts">{t('examDetail.maxAttempts')}</Label>
                <Input id="maxAttempts" type="number" min={1} {...form.register('maxAttempts')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRetakes">{t('examDetail.maxRetakes')}</Label>
              <Input id="maxRetakes" type="number" min={0} {...form.register('maxRetakes')} />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-primary" {...form.register('shuffleQuestions')} />
                {t('examDetail.shuffleQuestions')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-primary" {...form.register('shuffleChoices')} />
                {t('examDetail.shuffleChoices')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-primary" {...form.register('certificateEnabled')} />
                {t('examDetail.certificateEnabled')}
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">{t('examDetail.instructions')}</Label>
              <Textarea id="instructions" rows={4} {...form.register('instructions')} />
            </div>
          </Surface>
        ) : null}

        {tab === 'sections' ? (
          <Surface className="max-w-3xl space-y-3 p-6">
            {sectionsArray.fields.length === 0 ? (
              <p className="text-sm text-slate-500">{t('examDetail.noSections')}</p>
            ) : (
              sectionsArray.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-7">
                    <Label htmlFor={`sections.${index}.title`} className="sr-only">
                      {t('examDetail.sectionTitle')}
                    </Label>
                    <Input
                      id={`sections.${index}.title`}
                      placeholder={t('examDetail.sectionTitle')}
                      {...form.register(`sections.${index}.title`)}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label htmlFor={`sections.${index}.sortOrder`} className="sr-only">
                      {t('examDetail.sortOrder')}
                    </Label>
                    <Input
                      id={`sections.${index}.sortOrder`}
                      type="number"
                      placeholder={t('examDetail.sortOrder')}
                      {...form.register(`sections.${index}.sortOrder`)}
                    />
                  </div>
                  <div className="flex items-center sm:col-span-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => sectionsArray.remove(index)}>
                      {t('common.remove')}
                    </Button>
                  </div>
                </div>
              ))
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                sectionsArray.append({ title: '', sortOrder: sectionsArray.fields.length })
              }
            >
              {t('examDetail.addSection')}
            </Button>
          </Surface>
        ) : null}

        {tab === 'rules' ? (
          <Surface className="max-w-3xl space-y-3 p-6">
            {rulesArray.fields.length === 0 ? (
              <p className="text-sm text-slate-500">{t('examDetail.noRules')}</p>
            ) : (
              rulesArray.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Label htmlFor={`questionRules.${index}.questionId`} className="sr-only">
                      {t('examDetail.questionId')}
                    </Label>
                    <Input
                      id={`questionRules.${index}.questionId`}
                      placeholder={t('examDetail.questionId')}
                      {...form.register(`questionRules.${index}.questionId`)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`questionRules.${index}.points`} className="sr-only">
                      {t('examDetail.points')}
                    </Label>
                    <Input
                      id={`questionRules.${index}.points`}
                      type="number"
                      min={0}
                      step="0.5"
                      placeholder={t('examDetail.points')}
                      {...form.register(`questionRules.${index}.points`)}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label htmlFor={`questionRules.${index}.sortOrder`} className="sr-only">
                      {t('examDetail.sortOrder')}
                    </Label>
                    <Input
                      id={`questionRules.${index}.sortOrder`}
                      type="number"
                      placeholder={t('examDetail.sortOrder')}
                      {...form.register(`questionRules.${index}.sortOrder`)}
                    />
                  </div>
                  <div className="flex items-center sm:col-span-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => rulesArray.remove(index)}>
                      {t('common.remove')}
                    </Button>
                  </div>
                </div>
              ))
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                rulesArray.append({ questionId: '', points: 1, sortOrder: rulesArray.fields.length })
              }
            >
              {t('examDetail.addRule')}
            </Button>
          </Surface>
        ) : null}

        {saveMutation.isError ? (
          <Alert variant="error">{(saveMutation.error as Error).message}</Alert>
        ) : null}
        {saved ? <Alert variant="success">{t('examDetail.saved')}</Alert> : null}

        <div className="max-w-3xl">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Spinner size="sm" label={t('common.loading')} /> : t('common.save')}
          </Button>
        </div>
      </form>
    </PageMotion>
  );
}
