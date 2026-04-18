'use client';

import { Button } from '@/components/ui/button';

type CandidateCardProps = {
  rank: number;
  name: string;
  score: number;
  topSkills: string[];
  autoSelected?: boolean;
  compact?: boolean;
  onViewDetails: () => void;
  onDelete?: () => void;
};

const toneByRank: Record<number, string> = {
  1: 'bg-emerald-50 border-emerald-200',
  2: 'bg-blue-50 border-blue-200',
  3: 'bg-violet-50 border-violet-200',
};

export function CandidateCard({
  rank,
  name,
  score,
  topSkills,
  autoSelected = false,
  compact = false,
  onViewDetails,
  onDelete,
}: CandidateCardProps) {
  const cardTone = autoSelected
    ? 'bg-emerald-50 border-emerald-300'
    : toneByRank[rank] || 'bg-[var(--app-surface-elevated)] border-[var(--app-border)]';
  const skillText = topSkills.slice(0, 3).join(', ');
  const hasDelete = typeof onDelete === 'function';

  return (
    <article
      className={`flex h-full flex-col rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${cardTone} ${
        compact ? 'min-w-[240px]' : 'min-h-[220px]'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold tracking-wide text-[var(--app-text)]">Top {rank}</span>
          {autoSelected ? (
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-emerald-700">
              Auto Selected
            </span>
          ) : null}
        </div>
        <span className="rounded-full bg-white/90 px-2.5 py-1 text-sm font-semibold text-[var(--app-text)]">{Math.round(score)}%</span>
      </div>

      <h3 className="text-left font-display text-[1.72rem] font-semibold leading-tight text-[var(--app-text)] sm:text-[1.78rem]" title={name}>
        {name}
      </h3>

      {!compact ? (
        <p className="mt-3 line-clamp-3 text-left text-sm leading-relaxed text-[var(--app-muted)]" title={skillText || 'No top skills found'}>
          {skillText ? `Top skills: ${skillText}` : 'No top skills found'}
        </p>
      ) : null}

      <div className={`mt-auto pt-5 ${hasDelete ? 'grid grid-cols-2 gap-2' : ''}`}>
        <Button type="button" size="sm" variant="secondary" className="w-full" onClick={onViewDetails}>
          View Details
        </Button>
        {hasDelete ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50"
            onClick={onDelete}
          >
            Delete
          </Button>
        ) : null}
      </div>
    </article>
  );
}
