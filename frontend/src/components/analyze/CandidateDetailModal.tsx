'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Share2, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCandidateById } from '@/lib/api';

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
  candidate_id?: string;
};

type CandidateProfile = {
  total_experience_years: number | null;
  degrees: Array<{ degree?: string | null; field?: string | null; cgpa?: number | null; college?: string | null; location?: string | null }>;
  experience_list: Array<{ role?: string | null; duration?: string | null }>;
  projects: string[];
  certifications: string[];
  awards: string[];
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
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [activeEducationIndex, setActiveEducationIndex] = useState<number | null>(0);

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

  useEffect(() => {
    if (!isOpen || !candidate?.candidate_id) {
      setProfile(null);
      return;
    }

    let active = true;
    (async () => {
      try {
        const response = await getCandidateById(candidate.candidate_id as string);
        if (!active) {
          return;
        }

        setProfile({
          total_experience_years: Number.isFinite(Number(response.total_experience_years))
            ? Number(response.total_experience_years)
            : Number.isFinite(Number(response.total_experience))
              ? Number(response.total_experience)
              : null,
          degrees: Array.isArray(response.degrees) ? response.degrees : [],
          experience_list: Array.isArray(response.experience_list) ? response.experience_list : [],
          projects: Array.isArray(response.projects) ? response.projects.filter((item) => typeof item === 'string') : [],
          certifications: Array.isArray(response.certifications) ? response.certifications.filter((item) => typeof item === 'string') : [],
          awards: Array.isArray(response.awards) ? response.awards.filter((item) => typeof item === 'string') : [],
        });
        setActiveEducationIndex(0);
      } catch {
        if (active) {
          setProfile(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen, candidate?.candidate_id]);

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

  const filteredDegrees = useMemo(() => {
    const source = profile?.degrees || [];
    return source.filter((item) => {
      const degreeValue = String(item?.degree || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!degreeValue) {
        return false;
      }

      return /\b(mba|pgdm|phd|doctorate|master|bachelor|m\.\s*tech|b\.\s*tech|m\.\s*e|b\.\s*e|m\.\s*sc|b\.\s*sc|msc|bsc|master of|bachelor of)\b/.test(
        degreeValue
      );
    });
  }, [profile?.degrees]);

  const cleanedProjects = useMemo(() => {
    const source = profile?.projects || [];
    return source.filter((entry) => {
      const normalized = String(entry || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!normalized) {
        return false;
      }
      if (/\b(personal information|date of birth|nationality|marital|gender|address|contact|email|phone)\b/.test(normalized)) {
        return false;
      }
      if (normalized.split(' ').length <= 1) {
        return false;
      }
      return true;
    });
  }, [profile?.projects]);

  const cleanedCertifications = useMemo(() => {
    const source = profile?.certifications || [];
    return source
      .map((entry) => String(entry || '').trim())
      .filter((entry) => entry.length > 0)
      .filter((entry, index, all) => all.findIndex((candidateEntry) => candidateEntry.toLowerCase() === entry.toLowerCase()) === index);
  }, [profile?.certifications]);

  const cleanedAwards = useMemo(() => {
    const source = profile?.awards || [];
    return source
      .map((entry) => String(entry || '').trim())
      .filter((entry) => entry.length > 0)
      .filter((entry, index, all) => all.findIndex((candidateEntry) => candidateEntry.toLowerCase() === entry.toLowerCase()) === index);
  }, [profile?.awards]);

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
        className={`w-full max-w-[1280px] max-h-[92vh] overflow-y-auto rounded-2xl bg-[var(--app-surface)] p-6 shadow-xl transform transition-all duration-300 ${
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

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--app-muted)] transition hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-col gap-6 lg:w-2/3">
            <section className="rounded-xl border border-[var(--app-border)] bg-white p-6 shadow-sm">
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
                        <div className={`h-2.5 rounded-full ${getBarColor(item.percentage)} ${getBarWidthClass(item.percentage)}`} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--app-muted)]">No skill competency data available.</p>
                )}
              </div>
            </section>

            <section className="w-full rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[var(--app-text)]">Experience</h3>
              <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Experience</p>
                <p className="mt-1 text-lg font-bold text-emerald-800">
                  {profile?.total_experience_years !== null && profile?.total_experience_years !== undefined
                    ? `${profile.total_experience_years.toFixed(1)} years`
                    : 'Not provided'}
                </p>
              </div>

              <div className="mt-4">
                {profile?.experience_list && profile.experience_list.length > 0 ? (
                  <ul className="relative ml-3 border-l border-slate-200 pl-5">
                    {profile.experience_list.map((item, idx) => (
                      <li key={`${item.role || 'role'}-${idx}`} className="mb-4 last:mb-0">
                        <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border border-slate-300 bg-white" />
                        <p className="font-semibold text-[var(--app-text)]">{item.role || 'Role not specified'}</p>
                        <p className="text-sm text-[var(--app-muted)]">{item.duration || 'Duration not specified'}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--app-muted)]">No structured experience entries found.</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-[var(--app-border)] bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[var(--app-text)]">Education</h3>
              <div className="mt-4 space-y-2">
                {filteredDegrees.length > 0 ? (
                  filteredDegrees.map((item, idx) => (
                    <button
                      key={`${item.degree || 'degree'}-${idx}`}
                      type="button"
                      onClick={() => setActiveEducationIndex((prev) => (prev === idx ? null : idx))}
                      className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-left transition hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--app-text)]">{item.degree || 'Degree not specified'}</p>
                          <p className="text-sm text-[var(--app-muted)]">
                            {item.field || 'Field not specified'}
                            {Number.isFinite(Number(item.cgpa)) ? ` | CGPA: ${Number(item.cgpa).toFixed(2)}` : ''}
                          </p>
                        </div>
                        <span className="text-sm text-[var(--app-muted)]">{activeEducationIndex === idx ? 'Hide details' : 'View details'}</span>
                      </div>
                      {activeEducationIndex === idx ? (
                        <div className="mt-3 grid gap-2 border-t border-[var(--app-border)] pt-3 text-sm">
                          <p className="text-[var(--app-text)]"><span className="font-semibold">College:</span> {item.college || 'Not available'}</p>
                          <p className="text-[var(--app-text)]"><span className="font-semibold">Location:</span> {item.location || 'Not available'}</p>
                        </div>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-[var(--app-muted)]">No valid degree entries found (MBA, M.Sc, B.Sc).</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-[var(--app-border)] bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[var(--app-text)]">Projects</h3>
              <div className="mt-4">
                {cleanedProjects.length > 0 ? (
                  <ul className="space-y-2">
                    {cleanedProjects.map((item) => (
                      <li key={item} className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)]">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--app-muted)]">No project details found.</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-[var(--app-border)] bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[var(--app-text)]">Certifications</h3>
              <div className="mt-4">
                {cleanedCertifications.length > 0 ? (
                  <ul className="space-y-2">
                    {cleanedCertifications.map((item) => (
                      <li key={item} className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)]">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--app-muted)]">No certification details found.</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-[var(--app-border)] bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-[var(--app-text)]">Awards</h3>
              <div className="mt-4">
                {cleanedAwards.length > 0 ? (
                  <ul className="space-y-2">
                    {cleanedAwards.map((item) => (
                      <li key={item} className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text)]">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--app-muted)]">No award details found.</p>
                )}
              </div>
            </section>
          </div>

          <aside className="lg:w-1/3 lg:sticky lg:top-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Match Score</p>
                <p className="mt-1 text-3xl font-bold text-emerald-800">{scoreText}</p>
              </div>

              <h3 className="mb-3 text-lg font-semibold text-gray-800">Role Requirement Match</h3>
              <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
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
                      <span className={`text-sm font-medium ${item.status === 'Matched' ? 'text-green-700' : 'text-gray-500'}`}>
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
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
