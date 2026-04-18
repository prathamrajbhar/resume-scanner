'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAnalysisResults, useJobs } from '@/lib/hooks';
import { StatsCard } from '@/components/analyze/StatsCard';
import { Button } from '@/components/ui/button';
import { CandidateCard } from '@/components/analyze/CandidateCard';
import { CandidateDetailsDrawer } from '@/components/analyze/CandidateDetailsDrawer';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { confirmAutoSelection, deleteCandidate, getCandidates, sendInterviewEmail } from '@/lib/api';
import { Trash2 } from 'lucide-react';

type CandidateResult = {
  id: string;
  resume_id: string;
  name: string;
  email: string | null;
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
  auto_selected: boolean;
  selected: boolean;
  selection_status: string;
  degrees: Array<{ degree: string | null; field: string | null; cgpa: number | null }>;
  experience_list: Array<{ role: string | null; duration: string | null }>;
  projects: string[];
  certifications: string[];
};

export default function AnalyzePage() {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<CandidateResult | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmSelectionModal, setShowConfirmSelectionModal] = useState(false);
  const [isConfirmingSelection, setIsConfirmingSelection] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [reviewDismissedForJobId, setReviewDismissedForJobId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: jobs = [] } = useJobs();
  const { data: analyses = [], isLoading: isLoadingAnalyses, refetch } = useAnalysisResults(selectedJobId);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  const selectedJob = useMemo(() => {
    return jobs.find((job: any) => String(job?.id || '') === selectedJobId) || null;
  }, [jobs, selectedJobId]);

  const rows: CandidateResult[] = useMemo(() => {
    return (analyses || [])
      .map((row: any) => {
        const rawScore = Number(row.score);
        const rawFinalScore = Number(row.final_score);
        const finalScorePercent = Number.isFinite(rawFinalScore)
          ? (rawFinalScore <= 1 ? rawFinalScore * 100 : rawFinalScore)
          : 0;
        const resolvedScore = Number.isFinite(rawScore) && rawScore > 0
          ? rawScore
          : finalScorePercent;
        const resolvedFinalScore = Number.isFinite(rawFinalScore) && rawFinalScore > 0
          ? (rawFinalScore <= 1 ? rawFinalScore : rawFinalScore / 100)
          : resolvedScore / 100;

        const matchedSkills = Array.isArray(row.matched_skills)
          ? row.matched_skills.filter((skill: unknown) => typeof skill === 'string')
          : [];
        const missingSkills = Array.isArray(row.missing_skills)
          ? row.missing_skills.filter((skill: unknown) => typeof skill === 'string')
          : [];
        const topSkillsFromApi = Array.isArray(row.top_skills)
          ? row.top_skills.filter((skill: unknown) => typeof skill === 'string')
          : [];
        const computedTopSkills = topSkillsFromApi.length > 0
          ? topSkillsFromApi
          : matchedSkills.length > 0
            ? matchedSkills.slice(0, 3)
            : missingSkills.slice(0, 3);

        return {
          final_score: resolvedFinalScore,
          id: String(row.id),
          resume_id: String(row.resume_id || ''),
          name: row.name || 'Unknown candidate',
          email: typeof row.email === 'string' && row.email.trim() ? row.email : null,
          score: Math.max(0, Math.min(100, Math.round(resolvedScore))),
          education_score: Number(row.education_score || row.academic_score || 0),
          academic_score: Number(row.academic_score || 0),
          experience_score: Number(row.experience_score || 0),
          skill_match_score: Number(row.skill_match_score || 0),
          project_score: Number(row.project_score || 0),
          soft_skill_score: Number(row.soft_skill_score || 0),
          top_skills: computedTopSkills,
          matched_skills: matchedSkills,
          missing_skills: missingSkills,
          cgpa: Number.isFinite(Number(row.cgpa)) ? Number(row.cgpa) : null,
          cgpa_or_percentage: Number.isFinite(Number(row.cgpa_or_percentage)) ? Number(row.cgpa_or_percentage) : null,
          sgpa: Number.isFinite(Number(row.sgpa)) ? Number(row.sgpa) : null,
          degree: typeof row.degree === 'string' && row.degree.trim() ? row.degree : null,
          university: typeof row.university === 'string' && row.university.trim() ? row.university : null,
          total_experience_years: Number.isFinite(Number(row.total_experience_years)) ? Number(row.total_experience_years) : null,
          relevant_experience_years: Number.isFinite(Number(row.relevant_experience_years)) ? Number(row.relevant_experience_years) : null,
          projects_count: Number.isFinite(Number(row.projects_count)) ? Number(row.projects_count) : 0,
          soft_skills: Array.isArray(row.soft_skills) ? row.soft_skills.filter((i: unknown) => typeof i === 'string') : [],
          normalized_skills: Array.isArray(row.normalized_skills) ? row.normalized_skills.filter((i: unknown) => typeof i === 'string') : [],
          internships: Array.isArray(row.internships) ? row.internships.filter((i: unknown) => typeof i === 'string') : [],
          communication_score: Number(row.communication_score || 0),
          leadership_score: Number(row.leadership_score || 0),
          teamwork_score: Number(row.teamwork_score || 0),
          problem_solving_score: Number(row.problem_solving_score || 0),
          auto_selected: Boolean(row.auto_selected),
          selected: Boolean(row.selected),
          selection_status: typeof row.selection_status === 'string' ? row.selection_status : 'rejected',
          degrees: Array.isArray(row.degrees)
            ? row.degrees
                .map((entry: any) => ({
                  degree: typeof entry?.degree === 'string' && entry.degree.trim() ? entry.degree : null,
                  field: typeof entry?.field === 'string' && entry.field.trim() ? entry.field : null,
                  cgpa: Number.isFinite(Number(entry?.cgpa)) ? Number(entry.cgpa) : null,
                }))
                .filter((entry: { degree: string | null; field: string | null; cgpa: number | null }) => Boolean(entry.degree || entry.field || entry.cgpa !== null))
            : [],
          experience_list: Array.isArray(row.experience_list)
            ? row.experience_list
                .map((entry: any) => ({
                  role: typeof entry?.role === 'string' && entry.role.trim() ? entry.role : null,
                  duration: typeof entry?.duration === 'string' && entry.duration.trim() ? entry.duration : null,
                }))
                .filter((entry: { role: string | null; duration: string | null }) => Boolean(entry.role || entry.duration))
            : [],
          projects: Array.isArray(row.projects) ? row.projects.filter((i: unknown) => typeof i === 'string') : [],
          certifications: Array.isArray(row.certifications) ? row.certifications.filter((i: unknown) => typeof i === 'string') : [],
        };
      })
      .sort((a, b) => b.final_score - a.final_score);
  }, [analyses]);

  const topCandidates = rows.slice(0, 5);
  const moreCandidates = rows.slice(5);
  const autoSelectedCandidates = rows.filter((row) => row.auto_selected);
  const pendingAutoSelectedCandidates = rows.filter((row) => row.auto_selected && row.selection_status === 'pending');
  const confirmedCandidates = rows.filter((row) => row.selected || row.selection_status === 'confirmed');
  const requiresHrConfirmation = Boolean(selectedJob?.require_hr_confirmation);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    if (reviewDismissedForJobId && reviewDismissedForJobId !== selectedJobId) {
      setReviewDismissedForJobId(null);
    }

    if (
      requiresHrConfirmation &&
      pendingAutoSelectedCandidates.length > 0 &&
      reviewDismissedForJobId !== selectedJobId
    ) {
      setShowConfirmSelectionModal(true);
    }
  }, [
    selectedJobId,
    requiresHrConfirmation,
    pendingAutoSelectedCandidates.length,
    reviewDismissedForJobId,
  ]);

  const totalResumes = rows.length;
  const averageMatch = useMemo(() => {
    if (totalResumes === 0) return 0;
    return Math.round(rows.reduce((sum, r) => sum + r.score, 0) / totalResumes);
  }, [rows, totalResumes]);

  const shortlistedCount = rows.filter((row) => row.score >= 70).length;
  const selectedCount = confirmedCandidates.length;

  const normalizeName = (value: string) =>
    String(value || '')
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const resolveCandidateIdForDelete = async (candidate: CandidateResult): Promise<string | null> => {
    if (candidate.resume_id) {
      return candidate.resume_id;
    }

    const allCandidates = await getCandidates();
    const targetKey = normalizeName(candidate.name);
    const matches = allCandidates.filter((item: any) => normalizeName(String(item?.full_name || '')) === targetKey);

    if (matches.length === 1) {
      return String(matches[0].id || '');
    }

    return null;
  };

  const confirmDeleteCandidate = async () => {
    if (!candidateToDelete) {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      const resolvedCandidateId = await resolveCandidateIdForDelete(candidateToDelete);
      if (!resolvedCandidateId) {
        setActionError('Unable to delete: candidate id is missing. Please refresh analysis once and try again.');
        setCandidateToDelete(null);
        return;
      }

      await deleteCandidate(resolvedCandidateId);
      if (selectedCandidate?.resume_id === candidateToDelete.resume_id || selectedCandidate?.name === candidateToDelete.name) {
        setSelectedCandidate(null);
      }
      setCandidateToDelete(null);
      await refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete candidate.');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmAutoSelection = async () => {
    if (!selectedJobId || pendingAutoSelectedCandidates.length === 0) {
      setShowConfirmSelectionModal(false);
      return;
    }

    setIsConfirmingSelection(true);
    setActionError(null);
    try {
      await confirmAutoSelection({
        job_id: selectedJobId,
        resume_ids: pendingAutoSelectedCandidates.map((row) => row.resume_id).filter(Boolean),
      });
      setShowConfirmSelectionModal(false);
      await refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to confirm selection.');
    } finally {
      setIsConfirmingSelection(false);
    }
  };

  const handleReviewSelection = () => {
    if (selectedJobId) {
      setReviewDismissedForJobId(selectedJobId);
    }
    setShowConfirmSelectionModal(false);
  };

  const handleSendInterviewEmail = async () => {
    const candidateEmails = confirmedCandidates
      .map((candidate) => candidate.email)
      .filter((email): email is string => Boolean(email && email.trim()));

    if (candidateEmails.length === 0) {
      setActionError('No confirmed candidates have a valid email address to send interview invites.');
      return;
    }

    setIsSendingEmail(true);
    setActionError(null);
    try {
      await sendInterviewEmail({
        candidate_emails: candidateEmails,
        job_role: String(selectedJob?.title || 'Selected Role'),
        template: 'Interview Invitation',
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to send interview email.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--app-text)]">Talent Analysis</h1>
          <p className="text-sm text-[var(--app-muted)]">AI-powered ranking and candidate selection reports.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedJobId} 
            onChange={(e) => setSelectedJobId(e.target.value)}
            title="Select job role"
            aria-label="Select job role"
            className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[var(--app-focus)]"
          >
            {jobs.length === 0 ? <option value="">No job roles</option> : null}
            {jobs.map((job: any) => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>
          <Button 
            onClick={() => void refetch()}
            disabled={!selectedJobId || isLoadingAnalyses}
            variant="secondary"
          >
            {isLoadingAnalyses ? 'Refreshing...' : 'Re-run Analysis'}
          </Button>
          <Button
            onClick={() => void handleSendInterviewEmail()}
            disabled={confirmedCandidates.length === 0 || isSendingEmail}
          >
            {isSendingEmail ? 'Sending...' : 'Send Interview Email'}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Resumes" value={String(totalResumes)} subtitle="Profiles analyzed" />
        <StatsCard title="Average Match %" value={`${averageMatch}%`} subtitle="Across ranked candidates" />
        <StatsCard title="Shortlisted Candidates" value={String(shortlistedCount)} subtitle="Score 70% and above" subtitleTone="success" />
        <StatsCard title="Selected Candidates" value={String(selectedCount)} subtitle="Details view focus" subtitleTone="success" />
      </div>

      {autoSelectedCandidates.length > 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {autoSelectedCandidates.length} candidate{autoSelectedCandidates.length === 1 ? '' : 's'} auto selected for this role.
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">
          {actionError}
        </div>
      ) : null}

      {!isLoadingAnalyses && rows.length === 0 ? (
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-10 text-center shadow-[var(--app-shadow-sm)]">
          <p className="text-lg font-semibold text-[var(--app-text)]">Upload resumes and run analysis to see results</p>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-[var(--app-text)]">Top Candidates</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {topCandidates.map((candidate, index) => (
                <CandidateCard
                  key={candidate.id}
                  rank={index + 1}
                  name={candidate.name}
                  score={candidate.score}
                  topSkills={candidate.top_skills}
                  autoSelected={candidate.auto_selected}
                  onViewDetails={() => setSelectedCandidate(candidate)}
                  onDelete={() => setCandidateToDelete(candidate)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-display text-xl font-semibold text-[var(--app-text)]">More Candidates</h3>

            <div className="flex gap-4 overflow-x-auto pb-2">
              {moreCandidates.length > 0 ? (
                moreCandidates.map((candidate, index) => (
                  <CandidateCard
                    key={candidate.id}
                    rank={index + 6}
                    name={candidate.name}
                    score={candidate.score}
                    topSkills={candidate.top_skills}
                    autoSelected={candidate.auto_selected}
                    compact
                    onViewDetails={() => setSelectedCandidate(candidate)}
                    onDelete={() => setCandidateToDelete(candidate)}
                  />
                ))
              ) : (
                <p className="text-sm text-[var(--app-muted)]">No additional candidates.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <ConfirmModal
        isOpen={showConfirmSelectionModal}
        onClose={handleReviewSelection}
        onConfirm={handleConfirmAutoSelection}
        title="Confirm Auto Selection"
        message={`${pendingAutoSelectedCandidates.length} candidates meet the criteria. Do you want to confirm selection?`}
        confirmLabel={isConfirmingSelection ? 'Confirming...' : 'Confirm'}
        cancelDisabled={isConfirmingSelection}
        confirmDisabled={isConfirmingSelection}
      />

      <ConfirmModal
        isOpen={Boolean(candidateToDelete)}
        onClose={() => {
          if (!deleting) {
            setCandidateToDelete(null);
          }
        }}
        onConfirm={confirmDeleteCandidate}
        title="Delete candidate?"
        message={candidateToDelete ? `${candidateToDelete.name} will be removed from candidates and analysis records.` : ''}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        confirmIcon={<Trash2 className="h-4 w-4" />}
        confirmDisabled={deleting}
        cancelDisabled={deleting}
      />

      <CandidateDetailsDrawer
        candidate={selectedCandidate}
        isOpen={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  );
}
