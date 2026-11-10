import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Spinner,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface BankDetail {
  id: string;
  name: string;
  code: string;
  description?: string;
  questions: Array<{
    id: string;
    code: string;
    type: string;
    difficulty: string;
    status: string;
    stemPreview: string;
  }>;
}

export function QuestionBankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['question-bank', id],
    queryFn: () => api.get<BankDetail>(`/api/v1/question-banks/${id}`),
    enabled: !!id,
  });

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
          to="/question-banks"
          className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('questionBanks.backToList')}
        </Link>
      </div>

      <PageHeader
        title={data.name}
        description={[data.code, data.description].filter(Boolean).join(' · ')}
        actions={
          <Button type="button" onClick={() => navigate(`/questions/new?bankId=${data.id}`)}>
            {t('questions.create')}
          </Button>
        }
      />

      {data.questions.length === 0 ? (
        <EmptyState
          title={t('questionBanks.noQuestionsTitle')}
          description={t('questionBanks.noQuestionsDescription')}
          action={
            <Button type="button" onClick={() => navigate(`/questions/new?bankId=${data.id}`)}>
              {t('questions.create')}
            </Button>
          }
        />
      ) : (
        <Surface className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('questions.code')}</TableHead>
                <TableHead scope="col">{t('questions.stem')}</TableHead>
                <TableHead scope="col">{t('questions.type')}</TableHead>
                <TableHead scope="col">{t('questions.difficulty')}</TableHead>
                <TableHead scope="col">{t('common.status')}</TableHead>
                <TableHead scope="col">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm">{q.code}</TableCell>
                  <TableCell className="max-w-xs truncate">{q.stemPreview}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{q.type}</Badge>
                  </TableCell>
                  <TableCell>{q.difficulty}</TableCell>
                  <TableCell>
                    <Badge variant={q.status === 'APPROVED' ? 'success' : 'warning'}>{q.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/questions/${q.id}/edit`}
                      className="text-sm font-medium text-primary hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {t('common.edit')}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Surface>
      )}
    </PageMotion>
  );
}
