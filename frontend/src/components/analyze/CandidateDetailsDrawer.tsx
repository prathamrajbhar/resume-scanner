'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CandidateResult = {
  id: string;
  name: string;
  score: number;
  top_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
};

type CandidateDetailsDrawerProps = {
  candidate: CandidateResult | null;
  isOpen: boolean;
  onClose: () => void;
};

export function CandidateDetailsDrawer({ candidate, isOpen, onClose }: CandidateDetailsDrawerProps) {
  if (!isOpen || !candidate) {
    return null;
  }

  const roundedScore = Math.max(0, Math.min(100, Math.round(candidate.score)));

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="presentation">
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-3 border-b border-[var(--app-border)] pb-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[var(--app-text)]">Details View</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{candidate.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--app-muted)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]"
            aria-label="Close details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="mb-6 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4">
          <h3 className="font-semibold text-[var(--app-text)]">Match Score</h3>
          <div className="mt-4 flex items-center gap-4">
            <div className="grid h-24 w-24 place-items-center rounded-full border-[10px] border-emerald-500 bg-white">
              <div className="text-sm font-semibold text-[var(--app-text)]">{roundedScore}%</div>
            </div>
            <p className="text-sm text-[var(--app-muted)]">Overall candidate-role compatibility score.</p>
          </div>
        </section>

        <section className="mb-6 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4">
          <h3 className="font-semibold text-[var(--app-text)]">Skill Competency Matrix</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Matched Skills</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--app-text)]">
                {candidate.matched_skills.length > 0 ? candidate.matched_skills.map((skill) => <li key={skill}>• {skill}</li>) : <li>No matched skills</li>}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Missing Skills</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--app-text)]">
                {candidate.missing_skills.length > 0 ? candidate.missing_skills.map((skill) => <li key={skill}>• {skill}</li>) : <li>No missing skills</li>}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4">
          <h3 className="font-semibold text-[var(--app-text)]">Role Requirements Map</h3>
          <div className="mt-3 space-y-2">
            {candidate.top_skills.slice(0, 5).map((skill) => (
              <div key={skill} className="flex items-center justify-between rounded-md border border-[var(--app-border)] bg-white px-3 py-2 text-sm">
                <span className="text-[var(--app-text)]">{skill}</span>
                <span className="text-emerald-700">Aligned</span>
              </div>
            ))}
            {candidate.top_skills.length === 0 ? <p className="text-sm text-[var(--app-muted)]">No mapped requirements available.</p> : null}
          </div>
        </section>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </aside>
    </div>
  );
}
