import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Badge, Button, cn } from '@cbt/ui';
import { useAuth } from '@/lib/auth';

function NavIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden
      className={cn('h-4 w-4 shrink-0', active ? 'text-primary-300' : 'text-slate-500')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        {t('common.skipToContent')}
      </a>

      <motion.aside
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/90 backdrop-blur-md"
      >
        <div className="border-b border-slate-800/80 px-6 py-6">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/40"
            >
              <span className="font-serif text-sm font-bold text-primary-300">CBT</span>
            </div>
            <div>
              <p className="font-serif text-lg font-semibold tracking-tight text-slate-100">
                {t('app.name')}
              </p>
              <p className="text-xs text-slate-500">{t('app.tagline')}</p>
            </div>
          </div>
        </div>

        <nav aria-label={t('nav.main')} className="flex-1 space-y-1 p-4">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                isActive
                  ? 'bg-primary/15 text-primary-200 ring-1 ring-primary/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
              )
            }
          >
            {({ isActive }) => (
              <>
                <NavIcon active={isActive} />
                {t('nav.sessions')}
              </>
            )}
          </NavLink>
          <NavLink
            to="/security"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                isActive
                  ? 'bg-primary/15 text-primary-200 ring-1 ring-primary/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
              )
            }
          >
            {t('nav.security')}
          </NavLink>
        </nav>

        <div className="border-t border-slate-800/80 p-4">
          {user ? (
            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <p className="truncate text-sm font-medium text-slate-200">
                {user.firstName} {user.lastName}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
              <Badge
                variant="secondary"
                className="mt-2 border-slate-700 bg-slate-800 text-slate-300"
              >
                {t('nav.role')}
              </Badge>
            </div>
          ) : null}
          <Button
            variant="outline"
            className="w-full border-slate-700 bg-transparent text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100"
            onClick={() => void logout()}
          >
            {t('nav.logout')}
          </Button>
        </div>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main-content" className="flex-1 overflow-auto p-6 sm:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
