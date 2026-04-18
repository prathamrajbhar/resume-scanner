'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CandidateResult = {
  id: string;
  name: string;
  score: number;
  final_score: number;
  education_score: number;
  academic_score: number;
  experience_score: number;
  skill_match_score: number;
  project_score: number;
  soft_skill_score: number;
  top_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  cgpa: number | null;
  cgpa_or_percentage: number | null;
  sgpa: number | null;
  degree: string | null;
  university: string | null;
  total_experience_years: number | null;
  relevant_experience_years: number | null;
  projects_count: number;
  soft_skills: string[];
  normalized_skills: string[];
  internships: string[];
  communication_score: number;
  leadership_score: number;
  teamwork_score: number;
  problem_solving_score: number;
  degrees: Array<{ degree: string | null; field: string | null; cgpa: number | null }>;
  experience_list: Array<{ role: string | null; duration: string | null }>;
  projects: string[];
  certifications: string[];
};

type CandidateDetailsDrawerProps = {
  candidate: CandidateResult | null;
  isOpen: boolean;
  onClose: () => void;
};

export function CandidateDetailsDrawer({ candidate, isOpen, onClose }: CandidateDetailsDrawerProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [activeCandidate, setActiveCandidate] = useState<CandidateResult | null>(candidate);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    education: true,
    experience: true,
    projects: false,
    certifications: false,
  });

  useEffect(() => {
    if (candidate) {
      setActiveCandidate(candidate);
    }
  }, [candidate]);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      return;
    }

    if (isRendered) {
      setIsClosing(true);
      const timer = window.setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, 320);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isRendered) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isRendered, onClose]);

  const candidateData: CandidateResult =
    activeCandidate ?? {
      id: '',
      name: '',
      score: 0,
      final_score: 0,
      education_score: 0,
      academic_score: 0,
      experience_score: 0,
      skill_match_score: 0,
      project_score: 0,
      soft_skill_score: 0,
      top_skills: [],
      matched_skills: [],
      missing_skills: [],
      cgpa: null,
      cgpa_or_percentage: null,
      sgpa: null,
      degree: null,
      university: null,
      total_experience_years: null,
      relevant_experience_years: null,
      projects_count: 0,
      soft_skills: [],
      normalized_skills: [],
      internships: [],
      communication_score: 0,
      leadership_score: 0,
      teamwork_score: 0,
      problem_solving_score: 0,
      degrees: [],
      experience_list: [],
      projects: [],
      certifications: [],
    };

  const roundedScore = Math.max(0, Math.min(100, Math.round(candidateData.score)));
  const formatPercent = (value: number) => `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between rounded-md border border-[var(--app-border)] bg-white px-3 py-2">
      <span className="text-sm text-[var(--app-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--app-text)]">{value}</span>
    </div>
  );
  const ScoreBar = ({ label, value }: { label: string; value: number }) => {
    const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
    return (
      <div className="rounded-md border border-[var(--app-border)] bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-[var(--app-muted)]">{label}</p>
          <p className="text-xs font-semibold text-[var(--app-text)]">{pct}%</p>
        </div>
        <progress
          value={pct}
          max={100}
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-surface-soft)] [&::-webkit-progress-bar]:bg-[var(--app-surface-soft)] [&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500"
          aria-label={`${label} progress`}
        />
      </div>
    );
  };
  const scoreCards = [
    { label: 'Education Score', value: candidateData.education_score || candidateData.academic_score },
    { label: 'Experience Score', value: candidateData.experience_score },
    { label: 'Skill Match', value: candidateData.skill_match_score },
    { label: 'Project Score', value: candidateData.project_score },
    { label: 'Soft Skill Score', value: candidateData.soft_skill_score },
    { label: 'Final Score', value: candidateData.final_score },
  ];

  const educationRows = useMemo(() => {
    if (candidateData.degrees.length > 0) {
      return candidateData.degrees;
    }

    if (candidateData.degree || candidateData.cgpa !== null) {
      return [
        {
          degree: candidateData.degree,
          field: null,
          cgpa: candidateData.cgpa,
        },
      ];
    }

    return [] as Array<{ degree: string | null; field: string | null; cgpa: number | null }>;
  }, [candidateData]);

  const experienceRows = useMemo(() => {
    if (candidateData.experience_list.length > 0) {
      return candidateData.experience_list;
    }

    if (candidateData.total_experience_years !== null || candidateData.relevant_experience_years !== null) {
      return [
        {
          role: candidateData.total_experience_years !== null ? `Total experience: ${candidateData.total_experience_years.toFixed(1)} years` : null,
          duration:
            candidateData.relevant_experience_years !== null
              ? `Relevant: ${candidateData.relevant_experience_years.toFixed(1)} years`
              : null,
        },
      ];
    }

    return [] as Array<{ role: string | null; duration: string | null }>;
  }, [candidateData]);

  const cleanedNormalizedSkills = useMemo(() => {
    const noise = new Set([
      'personal information', 'date of birth', 'dob', 'nationality', 'marital status', 'gender',
      'contact', 'email', 'phone', 'address', 'linkedin', 'summary', 'objective',
      'education', 'experience', 'projects', 'certifications', 'awards',
    ]);

    const source = Array.isArray(candidateData.normalized_skills) ? candidateData.normalized_skills : [];
    const cleaned = source
      .map((item) => String(item || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((item) => item.length >= 2 && item.length <= 40)
      .filter((item) => item.split(' ').length <= 5)
      .filter((item) => !noise.has(item))
      .filter((item) => !/\b\d{4,}\b/.test(item))
      .filter((item) => !(item.includes('@') || item.includes('http')));

    return [...new Set(cleaned)].slice(0, 24);
  }, [candidateData.normalized_skills]);

  if (!isRendered || !activeCandidate) {
    return null;
  }

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const AccordionSection = ({
    id,
    title,
    subtitle,
    children,
  }: {
    id: string;
    title: string;
    subtitle: string;
    children: React.ReactNode;
  }) => (
    <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)]">
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div>
          <h3 className="font-semibold text-[var(--app-text)]">{title}</h3>
          <p className="text-xs text-[var(--app-muted)]">{subtitle}</p>
        </div>
        <span className="text-lg leading-none text-[var(--app-muted)]">{openSections[id] ? '-' : '+'}</span>
      </button>
      {openSections[id] ? <div className="border-t border-[var(--app-border)] px-4 py-3">{children}</div> : null}
    </section>
  );

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen && !isClosing ? 'drawer-backdrop-enter' : 'drawer-backdrop-exit'} bg-black/45 backdrop-blur-md`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <aside
        className={`absolute right-3 top-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto rounded-[30px] border border-white/50 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-[0_24px_56px_rgba(15,23,42,0.35)] ${
          isOpen && !isClosing ? 'drawer-page-enter' : 'drawer-page-exit'
        }`}
      >
        <div className="mb-6 flex items-start justify-between gap-3 border-b border-[var(--app-border)] pb-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[var(--app-text)]">Details View</h2>
            <p className="mt-1 text-sm text-[var(--app-muted)]">{candidateData.name}</p>
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {scoreCards.map((item) => (
              <ScoreBar key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 lg:col-span-2">
            <AccordionSection
              id="education"
              title="Education"
              subtitle="Degrees, field, and CGPA"
            >
              <div className="space-y-2">
                {educationRows.length > 0 ? (
                  educationRows.map((entry, index) => (
                    <div
                      key={`${entry.degree || 'degree'}-${index}`}
                      className="rounded-md border border-[var(--app-border)] bg-white px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-[var(--app-text)]">{entry.degree || 'Degree not specified'}</p>
                      <p className="text-xs text-[var(--app-muted)]">
                        {entry.field || 'Field not specified'}
                        {entry.cgpa !== null ? ` | CGPA: ${entry.cgpa.toFixed(2)}` : ''}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--app-muted)]">No education entries extracted.</p>
                )}
              </div>
            </AccordionSection>

            <AccordionSection
              id="experience"
              title="Experience"
              subtitle="Roles and duration"
            >
              <div className="space-y-2">
                <DetailRow
                  label="Total Experience"
                  value={candidateData.total_experience_years !== null ? `${candidateData.total_experience_years.toFixed(1)} years` : 'Not provided'}
                />
                {experienceRows.length > 0 ? (
                  experienceRows.map((entry, index) => (
                    <div
                      key={`${entry.role || 'experience'}-${index}`}
                      className="rounded-md border border-[var(--app-border)] bg-white px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-[var(--app-text)]">{entry.role || 'Role not specified'}</p>
                      <p className="text-xs text-[var(--app-muted)]">{entry.duration || 'Duration not specified'}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--app-muted)]">No structured experience entries extracted.</p>
                )}
              </div>
            </AccordionSection>

            <AccordionSection
              id="projects"
              title="Projects"
              subtitle="Project highlights from resume"
            >
              <div className="space-y-2">
                <DetailRow label="Detected Projects" value={String(candidateData.projects.length || candidateData.projects_count || 0)} />
                {candidateData.projects.length > 0 ? (
                  <ul className="space-y-1 text-sm text-[var(--app-text)]">
                    {candidateData.projects.map((item) => (
                      <li key={item} className="rounded-md border border-[var(--app-border)] bg-white px-3 py-2">{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--app-muted)]">No project entries extracted.</p>
                )}
              </div>
            </AccordionSection>

            <AccordionSection
              id="certifications"
              title="Certifications"
              subtitle="Professional certifications and licenses"
            >
              {candidateData.certifications.length > 0 ? (
                <ul className="space-y-1 text-sm text-[var(--app-text)]">
                  {candidateData.certifications.map((item) => (
                    <li key={item} className="rounded-md border border-[var(--app-border)] bg-white px-3 py-2">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--app-muted)]">No certifications extracted.</p>
              )}
            </AccordionSection>
          </div>

          <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4">
            <h3 className="font-semibold text-[var(--app-text)]">Skill Evaluation</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Matched Skills</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--app-text)]">
                  {candidateData.matched_skills.length > 0 ? candidateData.matched_skills.map((skill) => <li key={skill}>• {skill}</li>) : <li>Not provided</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Missing Skills</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--app-text)]">
                  {candidateData.missing_skills.length > 0 ? candidateData.missing_skills.map((skill) => <li key={skill}>• {skill}</li>) : <li>None</li>}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4">
            <h3 className="font-semibold text-[var(--app-text)]">Soft Skills</h3>
            <div className="mt-3 grid gap-3">
              <ScoreBar label="Communication" value={candidateData.communication_score} />
              <ScoreBar label="Leadership" value={candidateData.leadership_score} />
              <ScoreBar label="Teamwork" value={candidateData.teamwork_score} />
              <ScoreBar label="Problem-solving" value={candidateData.problem_solving_score} />
            </div>
            <div className="mt-3 rounded-md border border-[var(--app-border)] bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">Extracted Soft Skills</p>
              <p className="mt-1 text-sm text-[var(--app-text)]">
                {candidateData.soft_skills.length > 0 ? candidateData.soft_skills.join(', ') : 'Not provided'}
              </p>
            </div>
            <p className="mt-3 text-xs text-[var(--app-muted)]">
              Composite soft skill score: {formatPercent(candidateData.soft_skill_score)}
            </p>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4">
          <h3 className="font-semibold text-[var(--app-text)]">Top Matched Skills Snapshot</h3>
          <div className="mt-3 space-y-2">
            {candidateData.top_skills.slice(0, 5).map((skill) => (
              <div key={skill} className="flex items-center justify-between rounded-md border border-[var(--app-border)] bg-white px-3 py-2 text-sm">
                <span className="text-[var(--app-text)]">{skill}</span>
                <span className="text-emerald-700">Aligned</span>
              </div>
            ))}
            {candidateData.top_skills.length === 0 ? <p className="text-sm text-[var(--app-muted)]">No matched skill snapshot available.</p> : null}
          </div>
          <div className="mt-4 rounded-md border border-[var(--app-border)] bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">Normalized Skills</p>
            {cleanedNormalizedSkills.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cleanedNormalizedSkills.map((skill) => (
                  <span key={skill} className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-2 py-1 text-xs text-[var(--app-text)]">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-[var(--app-text)]">Not provided</p>
            )}
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
