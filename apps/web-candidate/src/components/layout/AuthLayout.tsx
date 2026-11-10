import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Surface } from '@cbt/ui';
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16 lg:py-20"
        aria-label={t('app.name')}
      >
        <div className="mx-auto w-full max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">
            {t('app.tagline')}
          </p>
          <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight tracking-tight text-primary-950 sm:text-6xl">
            {t('app.name')}
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-slate-600">
            {t('auth.heroDescription')}
          </p>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="flex flex-1 items-center justify-center px-6 py-12 lg:border-l lg:border-primary-100/60 lg:px-12 lg:py-20"
      >
        <div className="w-full max-w-md">
          <Surface className="p-8">
            <header className="mb-6">
              <h2 className="font-serif text-2xl font-semibold text-primary-950">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
            </header>
            {children}
          </Surface>
        </div>
      </motion.section>
    </div>
  );
}
