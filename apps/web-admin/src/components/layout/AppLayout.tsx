import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@cbt/ui';
import { useAuth } from '@/lib/auth';
import { RoleBadges, Sidebar } from './Sidebar';

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-primary-100/80 bg-white/95 backdrop-blur-sm">
        <div className="border-b border-primary-100/80 px-5 py-6">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-800 text-sm font-bold text-white"
            >
              C
            </div>
            <div>
              <p className="font-serif text-lg font-semibold leading-tight text-primary-950">
                {t('app.name')}
              </p>
              <p className="text-[11px] text-slate-500">{t('app.tagline')}</p>
            </div>
          </div>
        </div>
        <Sidebar />
        <div className="mt-auto border-t border-primary-100/80 p-4">
          {user ? (
            <div className="mb-3 space-y-2">
              <p className="text-sm font-medium text-slate-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
              <RoleBadges roles={user.roles} />
            </div>
          ) : null}
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            {t('nav.logout')}
          </Button>
        </div>
      </aside>
      <main id="main-content" className="mesh-panel flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-6 sm:p-8 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
