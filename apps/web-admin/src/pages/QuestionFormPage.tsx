import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Input,
  Label,
  PageHeader,
  Select,
  Spinner,
  Surface,
  Textarea,
} from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

const questionSchema = z.object({
  bankId: z.string().uuid(),
  code: z.string().min(1).max(50),
  type: z.enum(['MULTIPLE_CHOICE', 'MULTIPLE_RESPONSE', 'TRUE_FALSE', 'ESSAY', 'NUMERIC']),
  difficulty: z.enum(['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD']),
  stem: z.string().min(1),
  choiceA: z.string().optional(),
  choiceB: z.string().optional(),
  choiceC: z.string().optional(),
  choiceD: z.string().optional(),
  correctChoice: z.string().optional(),
});

type QuestionForm = z.infer<typeof questionSchema>;

interface QuestionDetail {
  id: string;
  bankId: string;
  code: string;
  type: string;
  difficulty: string;
  version: { stem: string; choices?: Array<{ label: string; content: string; isCorrect: boolean }> } | null;
}

export function QuestionFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEdit = !!id;

  const { data: existing, isLoading } = useQuery({
    queryKey: ['question', id],
    queryFn: () => api.get<QuestionDetail>(`/api/v1/questions/${id}`),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<QuestionForm>({
    resolver: zodResolver(questionSchema),
    values: existing
      ? {
          bankId: existing.bankId,
          code: existing.code,
          type: existing.type as QuestionForm['type'],
          difficulty: existing.difficulty as QuestionForm['difficulty'],
          stem: existing.version?.stem ?? '',
          choiceA: existing.version?.choices?.[0]?.content,
          choiceB: existing.version?.choices?.[1]?.content,
          choiceC: existing.version?.choices?.[2]?.content,
          choiceD: existing.version?.choices?.[3]?.content,
          correctChoice: existing.version?.choices?.find((c) => c.isCorrect)?.label,
        }
      : {
          bankId: searchParams.get('bankId') ?? '',
          code: '',
          type: 'MULTIPLE_CHOICE',
          difficulty: 'MEDIUM',
          stem: '',
        },
  });

  const questionType = watch('type');

  const saveMutation = useMutation({
    mutationFn: (values: QuestionForm) => {
      const body = {
        bankId: values.bankId,
        code: values.code,
        type: values.type,
        difficulty: values.difficulty,
        version: {
          languageId: '00000000-0000-0000-0000-000000000001',
          stem: values.stem,
          stemFormat: 'markdown',
          choices:
            values.type === 'MULTIPLE_CHOICE' || values.type === 'MULTIPLE_RESPONSE'
              ? [
                  { label: 'A', content: values.choiceA ?? '', isCorrect: values.correctChoice === 'A', sortOrder: 0 },
                  { label: 'B', content: values.choiceB ?? '', isCorrect: values.correctChoice === 'B', sortOrder: 1 },
                  { label: 'C', content: values.choiceC ?? '', isCorrect: values.correctChoice === 'C', sortOrder: 2 },
                  { label: 'D', content: values.choiceD ?? '', isCorrect: values.correctChoice === 'D', sortOrder: 3 },
                ]
              : undefined,
        },
      };
      return isEdit
        ? api.put<QuestionDetail>(`/api/v1/questions/${id}`, body)
        : api.post<QuestionDetail>('/api/v1/questions', body);
    },
    onSuccess: (saved) => navigate(`/question-banks/${saved.bankId}`),
  });

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  return (
    <PageMotion className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          to="/question-banks"
          className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('questionBanks.backToList')}
        </Link>
      </div>

      <PageHeader
        title={isEdit ? t('questions.edit') : t('questions.create')}
        description={t('questions.formDescription')}
      />

      <Surface className="p-6">
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
          <input type="hidden" {...register('bankId')} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code" required>
                {t('questions.code')}
              </Label>
              <Input id="code" {...register('code')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">{t('questions.type')}</Label>
              <Select id="type" {...register('type')}>
                <option value="MULTIPLE_CHOICE">{t('questions.types.multipleChoice')}</option>
                <option value="MULTIPLE_RESPONSE">{t('questions.types.multipleResponse')}</option>
                <option value="TRUE_FALSE">{t('questions.types.trueFalse')}</option>
                <option value="ESSAY">{t('questions.types.essay')}</option>
                <option value="NUMERIC">{t('questions.types.numeric')}</option>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficulty">{t('questions.difficulty')}</Label>
            <Select id="difficulty" {...register('difficulty')}>
              <option value="VERY_EASY">{t('questions.difficulties.veryEasy')}</option>
              <option value="EASY">{t('questions.difficulties.easy')}</option>
              <option value="MEDIUM">{t('questions.difficulties.medium')}</option>
              <option value="HARD">{t('questions.difficulties.hard')}</option>
              <option value="VERY_HARD">{t('questions.difficulties.veryHard')}</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stem" required>
              {t('questions.stem')}
            </Label>
            <Textarea id="stem" rows={5} {...register('stem')} />
          </div>
          {(questionType === 'MULTIPLE_CHOICE' || questionType === 'MULTIPLE_RESPONSE') && (
            <fieldset className="space-y-3 rounded-md border border-slate-200 p-4">
              <legend className="px-1 text-sm font-medium">{t('questions.answerChoices')}</legend>
              {(['A', 'B', 'C', 'D'] as const).map((label) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-6 font-medium">{label}</span>
                  <Input {...register(`choice${label}`)} aria-label={t('questions.choiceLabel', { label })} />
                  {questionType === 'MULTIPLE_CHOICE' ? (
                    <input
                      type="radio"
                      value={label}
                      {...register('correctChoice')}
                      aria-label={t('questions.markCorrect', { label })}
                    />
                  ) : null}
                </div>
              ))}
            </fieldset>
          )}
          {saveMutation.isError ? (
            <Alert variant="error">{(saveMutation.error as Error).message}</Alert>
          ) : null}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Spinner size="sm" label={t('common.loading')} />
              ) : (
                t('common.save')
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Surface>
    </PageMotion>
  );
}
