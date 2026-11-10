import type { RiskLevel } from './proctor-types';

/** Shared dark-surface overrides for @cbt/ui layout primitives on the proctor console. */
export const darkSurface =
  'border-slate-700/80 bg-slate-900/80 text-slate-100 shadow-none backdrop-blur-sm';

export const darkSurfaceMuted = 'border-slate-800 bg-slate-950/60 text-slate-300';

export const darkTableRow = 'border-slate-800 hover:bg-slate-800/40';

export const darkInput =
  'border-slate-700 bg-slate-800/80 text-slate-100 placeholder:text-slate-500';

export function riskBadgeVariant(level: RiskLevel | string) {
  switch (level) {
    case 'CRITICAL':
      return 'destructive' as const;
    case 'HIGH':
      return 'warning' as const;
    case 'MEDIUM':
      return 'accent' as const;
    default:
      return 'secondary' as const;
  }
}

export function scoreColorClass(score: number) {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-amber-400';
  if (score >= 20) return 'text-amber-300/90';
  return 'text-emerald-400';
}

export function severityBadgeVariant(severity: string) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'destructive' as const;
  if (severity === 'MEDIUM') return 'warning' as const;
  return 'secondary' as const;
}
