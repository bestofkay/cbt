import { Badge, cn } from '@cbt/ui';
import { riskBadgeVariant } from '@/lib/theme';
import type { RiskLevel } from '@/lib/proctor-types';

interface RiskBadgeProps {
  level: RiskLevel | string;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const variant = riskBadgeVariant(level);

  return (
    <Badge
      variant={variant}
      className={cn(
        variant === 'secondary' && 'border-slate-600 bg-slate-800 text-slate-300',
        variant === 'accent' && 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        variant === 'warning' && 'bg-amber-500/25 text-amber-200 border-amber-500/40',
        variant === 'destructive' && 'bg-red-500/20 text-red-300 border-red-500/40',
        className,
      )}
    >
      {level}
    </Badge>
  );
}
