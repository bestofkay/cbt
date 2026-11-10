import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, PageHeader, Spinner, Surface } from '@cbt/ui';
import { api } from '@/lib/api';
import { PageMotion } from '@/components/PageMotion';

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

interface Permission {
  id: string;
  code: string;
  name: string;
  resource: string;
  action: string;
}

export function RolesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const { data: roles, isLoading: rolesLoading, isError: rolesError } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<{ data: Role[] }>('/api/v1/roles'),
  });

  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get<{ data: Permission[] }>('/api/v1/permissions'),
  });

  const selectedRole = (roles?.data ?? []).find((r) => r.id === selectedRoleId) ?? null;

  useEffect(() => {
    if (selectedRole) {
      setSelectedCodes(new Set(selectedRole.permissions));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoleId, selectedRole?.permissions.join(',')]);

  useEffect(() => {
    if (!selectedRoleId && (roles?.data.length ?? 0) > 0) {
      setSelectedRoleId(roles!.data[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  const saveMutation = useMutation({
    mutationFn: ({ id, permissionCodes }: { id: string; permissionCodes: string[] }) =>
      api.put(`/api/v1/roles/${id}/permissions`, { permissionCodes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const isReadOnly = selectedRole?.isSystem && selectedRole.code === 'SUPER_ADMIN';

  const togglePermission = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const groupedPermissions = (permissions?.data ?? []).reduce<Record<string, Permission[]>>(
    (acc, perm) => {
      acc[perm.resource] = acc[perm.resource] ?? [];
      acc[perm.resource].push(perm);
      return acc;
    },
    {},
  );

  return (
    <PageMotion className="space-y-6">
      <PageHeader title={t('roles.title')} description={t('roles.description')} />

      {rolesLoading || permissionsLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" label={t('common.loading')} />
        </div>
      ) : rolesError ? (
        <Alert variant="error">{t('common.error')}</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <Surface className="h-fit overflow-hidden p-0">
            <ul role="list">
              {(roles?.data ?? []).map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                      selectedRoleId === role.id ? 'bg-primary-50 font-medium text-primary-900' : 'text-slate-700'
                    }`}
                  >
                    <span>{role.name}</span>
                    <Badge variant="secondary">{role.userCount}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface className="p-6">
            {selectedRole ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-serif text-xl font-semibold text-primary-950">{selectedRole.name}</h2>
                    {selectedRole.isSystem ? <Badge variant="outline">{t('roles.systemRole')}</Badge> : null}
                  </div>
                  {selectedRole.description ? (
                    <p className="mt-1 text-sm text-slate-600">{selectedRole.description}</p>
                  ) : null}
                  {isReadOnly ? (
                    <p className="mt-2 text-xs text-amber-700">{t('roles.superAdminReadOnly')}</p>
                  ) : null}
                </div>

                <div className="space-y-5">
                  {Object.entries(groupedPermissions).map(([resource, perms]) => (
                    <fieldset key={resource} className="space-y-2">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-primary-700/80">
                        {resource}
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={selectedCodes.has(perm.code)}
                              disabled={!!isReadOnly}
                              onChange={() => togglePermission(perm.code)}
                            />
                            {perm.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>

                {saveMutation.isError ? (
                  <Alert variant="error">{(saveMutation.error as Error).message}</Alert>
                ) : null}
                {saved ? <Alert variant="success">{t('roles.saved')}</Alert> : null}

                {!isReadOnly ? (
                  <Button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() =>
                      selectedRole &&
                      saveMutation.mutate({ id: selectedRole.id, permissionCodes: [...selectedCodes] })
                    }
                  >
                    {saveMutation.isPending ? (
                      <Spinner size="sm" label={t('common.loading')} />
                    ) : (
                      t('common.save')
                    )}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t('roles.selectRole')}</p>
            )}
          </Surface>
        </div>
      )}
    </PageMotion>
  );
}
