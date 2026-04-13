'use client';

import { Button } from '@/components/ui/button';

type CandidateCardProps = {
  rank: number;
  name: string;
  score: number;
  topSkills: string[];
  compact?: boolean;
  onViewDetails: () => void;
};

const toneByRank: Record<number, string> = {
  1: 'bg-emerald-50 border-emerald-200',
  2: 'bg-blue-50 border-blue-200',
  3: 'bg-violet-50 border-violet-200',
};

export function CandidateCard({ rank, name, score, topSkills, compact = false, onViewDetails }: CandidateCardProps) {
  const cardTone = toneByRank[rank] || 'bg-[var(--app-surface-elevated)] border-[var(--app-border)]';

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm transition duration-200 hover:scale-[1.02] hover:shadow-lg ${cardTone} ${
        compact ? 'min-w-[220px]' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-[var(--app-text)]">Top {rank}</span>
        <span className="text-sm font-semibold text-[var(--app-text)]">{Math.round(score)}%</span>
      </div>

      <h3 className="truncate font-display text-base font-semibold text-[var(--app-text)]" title={name}>
        {name}
      </h3>

      {!compact ? (
        <p className="mt-2 line-clamp-2 text-sm text-[var(--app-muted)]">{topSkills.slice(0, 3).join(', ') || 'No top skills found'}</p>
      ) : null}

      <Button type="button" size="sm" variant="secondary" className="mt-4 w-full" onClick={onViewDetails}>
        View Details
      </Button>
    </article>
  );
}
