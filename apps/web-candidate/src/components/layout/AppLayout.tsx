import { Link, NavLink, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Badge, Button, cn } from '@cbt/ui';
import { useAuth } from '@/lib/auth';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    isActive
      ? 'bg-primary-50 text-primary-800'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  );

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-8">
            <div>
              <p className="font-serif text-xl font-semibold tracking-tight text-primary-800">
                {t('app.name')}
              </p>
              <p className="hidden text-xs text-slate-500 sm:block">{t('app.tagline')}</p>
            </div>
            <nav aria-label={t('nav.main')} className="hidden flex-wrap items-center gap-1 lg:flex">
              <NavLink to="/" end className={navLinkClass}>
                {t('nav.lobby')}
              </NavLink>
              <NavLink to="/results" className={navLinkClass}>
                {t('nav.results')}
              </NavLink>
              <NavLink to="/notifications" className={navLinkClass}>
                {t('nav.notifications')}
              </NavLink>
              <NavLink to="/support" className={navLinkClass}>
                {t('nav.support')}
              </NavLink>
              <NavLink to="/profile" className={navLinkClass}>
                {t('nav.profile')}
              </NavLink>
              <NavLink to="/security" className={navLinkClass}>
                {t('nav.security')}
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div
                className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 sm:flex"
                aria-label={`${user.firstName} ${user.lastName}`}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white"
                  aria-hidden="true"
                >
                  {initials}
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {user.firstName} {user.lastName}
                </span>
              </div>
            ) : null}
            <Badge variant="secondary" className="sm:hidden">
              {user?.firstName}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              {t('nav.logout')}
            </Button>
          </div>
        </div>

        <nav
          aria-label={t('nav.main')}
          className="flex flex-wrap gap-1 border-t border-slate-100 px-6 py-2 lg:hidden"
        >
          <NavLink to="/" end className={navLinkClass}>
            {t('nav.lobby')}
          </NavLink>
          <NavLink to="/results" className={navLinkClass}>
            {t('nav.results')}
          </NavLink>
          <NavLink to="/notifications" className={navLinkClass}>
            {t('nav.notifications')}
          </NavLink>
          <NavLink to="/support" className={navLinkClass}>
            {t('nav.support')}
          </NavLink>
          <NavLink to="/profile" className={navLinkClass}>
            {t('nav.profile')}
          </NavLink>
          <NavLink to="/security" className={navLinkClass}>
            {t('nav.security')}
          </NavLink>
        </nav>
      </header>

      <motion.main
        id="main-content"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-6xl px-6 py-8"
      >
        <Outlet />
      </motion.main>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-slate-400">
        <Link
          to="/certificates/verify"
          className="hover:text-slate-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t('nav.verifyCertificate')}
        </Link>
      </footer>
    </div>
  );
}
