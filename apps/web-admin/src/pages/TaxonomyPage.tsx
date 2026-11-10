import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  Spinner,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
} from '@cbt/ui';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface BankOption {
  id: string;
  name: string;
  code: string;
}

interface Topic {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
}

interface BankDetail extends BankOption {
  topics: Topic[];
}

const categorySchema = z.object({
  name: z.string().min(1).max(150),
  slug: z.string().min(1).max(150),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});
type CategoryForm = z.infer<typeof categorySchema>;

const tagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
});
type TagForm = z.infer<typeof tagSchema>;

const topicSchema = z.object({
  bankId: z.string().uuid(),
  name: z.string().min(1).max(150),
  code: z.string().min(1).max(50),
});
type TopicForm = z.infer<typeof topicSchema>;

function normalizeTags(raw: Tag[] | { data: Tag[] } | undefined): Tag[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : raw.data;
}

export function TaxonomyPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('categories');

  const tabs = [
    { id: 'categories', label: t('taxonomy.tabs.categories') },
    { id: 'tags', label: t('taxonomy.tabs.tags') },
    { id: 'topics', label: t('taxonomy.tabs.topics') },
  ];

  const { data: categories, isLoading: categoriesLoading, isError: categoriesError } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: Category[] }>('/api/v1/categories'),
    enabled: tab === 'categories',
  });

  const { data: tagsRaw, isLoading: tagsLoading, isError: tagsError } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get<Tag[] | { data: Tag[] }>('/api/v1/tags'),
    enabled: tab === 'tags',
  });
  const tags = normalizeTags(tagsRaw);

  const { data: banks } = useQuery({
    queryKey: ['banks-for-topics'],
    queryFn: () => api.get<PaginatedResponse<BankOption>>('/api/v1/question-banks?page=1&pageSize=100'),
    enabled: tab === 'topics',
  });

  const [selectedBankId, setSelectedBankId] = useState('');

  const { data: bankDetail, isLoading: bankDetailLoading } = useQuery({
    queryKey: ['bank-detail-topics', selectedBankId],
    queryFn: () => api.get<BankDetail>(`/api/v1/question-banks/${selectedBankId}`),
    enabled: tab === 'topics' && !!selectedBankId,
  });

  const categoryForm = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', slug: '', description: '', sortOrder: 0 },
  });
  const createCategoryMutation = useMutation({
    mutationFn: (values: CategoryForm) => api.post('/api/v1/categories', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      categoryForm.reset({ name: '', slug: '', description: '', sortOrder: 0 });
    },
  });

  const tagForm = useForm<TagForm>({ resolver: zodResolver(tagSchema), defaultValues: { name: '', color: '' } });
  const createTagMutation = useMutation({
    mutationFn: (values: TagForm) => api.post('/api/v1/tags', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      tagForm.reset({ name: '', color: '' });
    },
  });

  const topicForm = useForm<TopicForm>({
    resolver: zodResolver(topicSchema),
    defaultValues: { bankId: '', name: '', code: '' },
  });
  const createTopicMutation = useMutation({
    mutationFn: (values: TopicForm) =>
      api.post(`/api/v1/banks/${values.bankId}/topics`, { name: values.name, code: values.code }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-detail-topics', variables.bankId] });
      topicForm.reset({ bankId: variables.bankId, name: '', code: '' });
    },
  });

  return (
    <PageMotion className="space-y-6">
      <PageHeader title={t('taxonomy.title')} description={t('taxonomy.description')} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'categories' ? (
        <div className="space-y-6">
          <Surface className="max-w-2xl space-y-4 p-6">
            <h2 className="font-serif text-lg font-semibold text-primary-950">{t('taxonomy.createCategory')}</h2>
            <form
              onSubmit={categoryForm.handleSubmit((v) => createCategoryMutation.mutate(v))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryName" required>
                    {t('questionBanks.name')}
                  </Label>
                  <Input id="categoryName" {...categoryForm.register('name')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categorySlug" required>
                    {t('taxonomy.slug')}
                  </Label>
                  <Input id="categorySlug" {...categoryForm.register('slug')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryDescription">{t('questionBanks.bankDescription')}</Label>
                <Textarea id="categoryDescription" rows={2} {...categoryForm.register('description')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categorySortOrder">{t('examDetail.sortOrder')}</Label>
                <Input id="categorySortOrder" type="number" {...categoryForm.register('sortOrder')} />
              </div>
              {createCategoryMutation.isError ? (
                <Alert variant="error">{(createCategoryMutation.error as Error).message}</Alert>
              ) : null}
              <Button type="submit" disabled={createCategoryMutation.isPending}>
                {createCategoryMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : (
                  t('common.create')
                )}
              </Button>
            </form>
          </Surface>

          {categoriesLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" label={t('common.loading')} />
            </div>
          ) : categoriesError ? (
            <Alert variant="error">{t('common.error')}</Alert>
          ) : (categories?.data.length ?? 0) === 0 ? (
            <EmptyState title={t('taxonomy.emptyCategoriesTitle')} description={t('taxonomy.emptyCategoriesDescription')} />
          ) : (
            <Surface className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t('questionBanks.name')}</TableHead>
                    <TableHead scope="col">{t('taxonomy.slug')}</TableHead>
                    <TableHead scope="col">{t('examDetail.sortOrder')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories!.data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-sm">{c.slug}</TableCell>
                      <TableCell>{c.sortOrder}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Surface>
          )}
        </div>
      ) : null}

      {tab === 'tags' ? (
        <div className="space-y-6">
          <Surface className="max-w-2xl space-y-4 p-6">
            <h2 className="font-serif text-lg font-semibold text-primary-950">{t('taxonomy.createTag')}</h2>
            <form onSubmit={tagForm.handleSubmit((v) => createTagMutation.mutate(v))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tagName" required>
                    {t('questionBanks.name')}
                  </Label>
                  <Input id="tagName" {...tagForm.register('name')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagColor">{t('taxonomy.color')}</Label>
                  <Input id="tagColor" type="color" className="h-10 p-1" {...tagForm.register('color')} />
                </div>
              </div>
              {createTagMutation.isError ? (
                <Alert variant="error">{(createTagMutation.error as Error).message}</Alert>
              ) : null}
              <Button type="submit" disabled={createTagMutation.isPending}>
                {createTagMutation.isPending ? (
                  <Spinner size="sm" label={t('common.loading')} />
                ) : (
                  t('common.create')
                )}
              </Button>
            </form>
          </Surface>

          {tagsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" label={t('common.loading')} />
            </div>
          ) : tagsError ? (
            <Alert variant="error">{t('common.error')}</Alert>
          ) : tags.length === 0 ? (
            <EmptyState title={t('taxonomy.emptyTagsTitle')} description={t('taxonomy.emptyTagsDescription')} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                >
                  {tag.color ? (
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  ) : null}
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'topics' ? (
        <div className="space-y-6">
          <div className="max-w-md space-y-2">
            <Label htmlFor="topic-bank">{t('taxonomy.selectBank')}</Label>
            <Select
              id="topic-bank"
              value={selectedBankId}
              onChange={(e) => {
                setSelectedBankId(e.target.value);
                topicForm.setValue('bankId', e.target.value);
              }}
            >
              <option value="">{t('taxonomy.selectBankPlaceholder')}</option>
              {(banks?.data ?? []).map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.code} — {bank.name}
                </option>
              ))}
            </Select>
          </div>

          {selectedBankId ? (
            <>
              <Surface className="max-w-2xl space-y-4 p-6">
                <h2 className="font-serif text-lg font-semibold text-primary-950">{t('taxonomy.createTopic')}</h2>
                <form
                  onSubmit={topicForm.handleSubmit((v) => createTopicMutation.mutate(v))}
                  className="space-y-4"
                >
                  <input type="hidden" {...topicForm.register('bankId')} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="topicName" required>
                        {t('questionBanks.name')}
                      </Label>
                      <Input id="topicName" {...topicForm.register('name')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="topicCode" required>
                        {t('questionBanks.code')}
                      </Label>
                      <Input id="topicCode" {...topicForm.register('code')} />
                    </div>
                  </div>
                  {createTopicMutation.isError ? (
                    <Alert variant="error">{(createTopicMutation.error as Error).message}</Alert>
                  ) : null}
                  <Button type="submit" disabled={createTopicMutation.isPending}>
                    {createTopicMutation.isPending ? (
                      <Spinner size="sm" label={t('common.loading')} />
                    ) : (
                      t('common.create')
                    )}
                  </Button>
                </form>
              </Surface>

              {bankDetailLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" label={t('common.loading')} />
                </div>
              ) : (bankDetail?.topics.length ?? 0) === 0 ? (
                <EmptyState title={t('taxonomy.emptyTopicsTitle')} description={t('taxonomy.emptyTopicsDescription')} />
              ) : (
                <Surface className="overflow-hidden p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">{t('questionBanks.name')}</TableHead>
                        <TableHead scope="col">{t('questionBanks.code')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bankDetail!.topics.map((topic) => (
                        <TableRow key={topic.id}>
                          <TableCell className="font-medium">{topic.name}</TableCell>
                          <TableCell className="font-mono text-sm">{topic.code}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Surface>
              )}
            </>
          ) : (
            <EmptyState
              title={t('taxonomy.selectBankTitle')}
              description={t('taxonomy.selectBankDescription')}
            />
          )}
        </div>
      ) : null}
    </PageMotion>
  );
}
