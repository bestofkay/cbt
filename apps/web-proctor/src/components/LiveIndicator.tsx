import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@cbt/ui';

interface LiveIndicatorProps {
  isFetching: boolean;
  lastUpdated?: Date;
  className?: string;
}

export function LiveIndicator({ isFetching, lastUpdated, className }: LiveIndicatorProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn('flex items-center gap-2 text-xs text-slate-400', className)}
      role="status"
      aria-live="polite"
      aria-label={t('sessions.liveStatus')}
    >
      <span className="relative flex h-2 w-2">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
          animate={{ scale: isFetching ? [1, 1.8, 1] : 1, opacity: isFetching ? [0.75, 0, 0.75] : 0.5 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-medium uppercase tracking-wider text-emerald-400/90">{t('sessions.live')}</span>
      {lastUpdated ? (
        <span className="text-slate-500" aria-hidden="true">
          · {t('sessions.updated', { time: lastUpdated.toLocaleTimeString() })}
        </span>
      ) : null}
    </div>
  );
}
