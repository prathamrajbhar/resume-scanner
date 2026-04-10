import { cn } from '@/lib/utils';

type BadgeTone = 'neutral' | 'success' | 'green';

type AnalysisBadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border border-gray-200 bg-gray-100 text-gray-600',
  success: 'border border-emerald-200 bg-emerald-100 text-emerald-700',
  green: 'border border-green-200 bg-green-100 text-green-700',
};

export function AnalysisBadge({ children, tone = 'neutral', className }: AnalysisBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
