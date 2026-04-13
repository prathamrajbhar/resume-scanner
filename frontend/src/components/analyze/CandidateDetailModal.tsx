'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Share2, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type CandidateSkillPercentage = {
  skill: string;
  percentage: number;
  is_na?: boolean;
};

export type RequiredSkillEntry = {
  skill: string;
  level?: string;
};

export type CandidateDetailData = {
  rank: number;
  candidate_name: string;
  match_score: number;
  top_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  skills_with_percentage: CandidateSkillPercentage[];
  required_skills?: RequiredSkillEntry[];
};

type CandidateDetailModalProps = {
  candidate: CandidateDetailData | null;
  isOpen: boolean;
  onClose: () => void;
  role: string;
};

const getBarColor = (percentage: number) => {
  if (percentage >= 70) {
    return 'bg-emerald-500';
  }
  if (percentage >= 40) {
    return 'bg-amber-500';
  }
  return 'bg-slate-300';
};

const getBarWidthClass = (percentage: number) => {
  if (percentage >= 100) {
    return 'w-full';
  }
  if (percentage >= 75) {
    return 'w-3/4';
  }
  if (percentage >= 50) {
    return 'w-1/2';
  }
  if (percentage >= 25) {
    return 'w-1/4';
  }
  return 'w-0';
};

export function CandidateDetailModal({ candidate, isOpen, onClose, role }: CandidateDetailModalProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAnimateIn(false);
    const raf = window.requestAnimationFrame(() => setAnimateIn(true));

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      setShareFeedback(null);
    };
  }, [isOpen, onClose]);

  const requirementRows = useMemo(() => {
    if (!candidate) {
      return [] as Array<{ skill: string; status: 'Matched' | 'Missing' }>;
    }

    if (candidate.required_skills && candidate.required_skills.length > 0) {
      return candidate.required_skills.map((item) => ({
        skill: item.skill,
        status: candidate.matched_skills.includes(item.skill) ? ('Matched' as const) : ('Missing' as const),
      }));
    }

    const matchedSource = candidate.matched_skills.length > 0 ? candidate.matched_skills : candidate.top_skills;
    const matched = matchedSource.map((skill) => ({ skill, status: 'Matched' as const }));
    const missing = candidate.missing_skills.map((skill) => ({ skill, status: 'Missing' as const }));
    return [...matched, ...missing];
  }, [candidate]);

  const competencyRows = useMemo(() => {
    if (!candidate) {
      return [] as CandidateSkillPercentage[];
    }

    if (candidate.skills_with_percentage.length > 0) {
      return candidate.skills_with_percentage;
    }

    if (candidate.required_skills && candidate.required_skills.length > 0) {
      return candidate.required_skills.map((item) => {
        const isMatched = candidate.matched_skills.includes(item.skill);
        if (!isMatched) {
          return { skill: item.skill, percentage: 0, is_na: true };
        }

        const normalizedLevel = String(item.level || '').toLowerCase();
        const percentage = normalizedLevel === 'expert' ? 90 : normalizedLevel === 'intermediate' ? 75 : 60;
        return { skill: item.skill, percentage };
      });
    }

    const matchedSource = candidate.matched_skills.length > 0 ? candidate.matched_skills : candidate.top_skills;
    return [
      ...matchedSource.map((skill) => ({ skill, percentage: 75 })),
      ...candidate.missing_skills.map((skill) => ({ skill, percentage: 0, is_na: true })),
    ];
  }, [candidate]);

  if (!isOpen || !candidate) {
    return null;
  }

  const scoreText = `${Math.round(candidate.match_score)}%`;

  const handleExportPdf = () => {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      return;
    }

    const skillsHtml = candidate.skills_with_percentage
      .map((item) => `<li>${item.skill}: ${Math.round(item.percentage)}%</li>`)
      .join('');

    const reqHtml = requirementRows
      .map((item) => `<li>${item.skill} - ${item.status}</li>`)
      .join('');

    popup.document.write(`
      <html>
        <head><title>${candidate.candidate_name} - Candidate Detail</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>${candidate.candidate_name}</h2>
          <p>Role: ${role || 'Selected role'}</p>
          <p>Match Score: ${scoreText}</p>
          <h3>Skill Competency Matrix</h3>
          <ul>${skillsHtml}</ul>
          <h3>Role Requirement Match</h3>
          <ul>${reqHtml}</ul>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleShare = async () => {
    const summary = `${candidate.candidate_name} (${scoreText}) for ${role || 'selected role'}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Candidate Insight',
          text: summary,
        });
        setShareFeedback('Shared successfully.');
        return;
      } catch {
        setShareFeedback('Share cancelled.');
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(summary);
      setShareFeedback('Summary copied to clipboard.');
    } catch {
      setShareFeedback('Unable to share on this browser.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        className={`w-full max-w-[1100px] max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl transform transition-all duration-300 ${
          animateIn ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Candidate details"
      >
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-[var(--app-border)] pb-4">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-[var(--app-text)]">{candidate.candidate_name}</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{role || 'Selected role'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {candidate.top_skills.length > 0 ? (
                candidate.top_skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  No top skills found
                </span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-emerald-200 bg-emerald-50 text-lg font-bold text-emerald-700">
              {scoreText}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[var(--app-muted)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-10">
          <div className="lg:col-span-7 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
            <h3 className="mb-4 text-xl font-semibold text-[var(--app-text)]">Skill Competency Matrix</h3>

            <div className="space-y-4">
              {competencyRows.length > 0 ? (
                competencyRows.map((item) => (
                  <div key={item.skill}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium uppercase tracking-wide text-[var(--app-text)]">{item.skill}</span>
                        <span className="font-semibold text-[var(--app-muted)]">{item.is_na ? 'N/A' : `${Math.round(item.percentage)}%`}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200">
                      <div
                        className={`h-2.5 rounded-full ${getBarColor(item.percentage)} ${getBarWidthClass(item.percentage)}`}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--app-muted)]">No skill competency data available.</p>
              )}
            </div>
          </div>

          <aside className="lg:col-span-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Role Requirement Match</h3>
            <div className="space-y-2">
              {requirementRows.length > 0 ? (
                requirementRows.map((item) => (
                  <div
                    key={`${item.skill}-${item.status}`}
                    className={`flex items-center justify-between rounded-lg px-3 py-1.5 transition-colors ${
                      item.status === 'Matched'
                        ? 'border border-green-100 bg-green-50 text-green-700 hover:bg-green-100/60'
                        : 'border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {item.status === 'Matched' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm leading-4">{item.skill}</span>
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        item.status === 'Matched' ? 'text-green-700' : 'text-gray-500'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No requirement data available.</p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                onClick={handleExportPdf}
                className="border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
              <Button
                type="button"
                onClick={handleShare}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>

            {shareFeedback ? <p className="mt-3 text-right text-xs text-gray-500">{shareFeedback}</p> : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
