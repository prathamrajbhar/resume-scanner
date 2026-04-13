'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAnalysisResults, useJobs } from '@/lib/hooks';
import { StatsCard } from '@/components/analyze/StatsCard';
import { Button } from '@/components/ui/button';
import { CandidateCard } from '@/components/analyze/CandidateCard';
import { CandidateDetailsDrawer } from '@/components/analyze/CandidateDetailsDrawer';

type CandidateResult = {
  id: string;
  name: string;
  score: number;
  top_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
};

export default function AnalyzePage() {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null);

  const { data: jobs = [] } = useJobs();
  const { data: analyses = [], isLoading: isLoadingAnalyses, refetch } = useAnalysisResults(selectedJobId);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  const rows: CandidateResult[] = useMemo(() => {
    return (analyses || [])
      .map((row: any) => ({
        id: String(row.id),
        name: row.name || 'Unknown candidate',
        score: Math.round(Number(row.score || 0)),
        top_skills: Array.isArray(row.top_skills) ? row.top_skills : [],
        matched_skills: Array.isArray(row.matched_skills) ? row.matched_skills : [],
        missing_skills: Array.isArray(row.missing_skills) ? row.missing_skills : [],
      }))
      .sort((a, b) => b.score - a.score);
  }, [analyses]);

  const topCandidates = rows.slice(0, 5);
  const moreCandidates = rows.slice(5);

  const totalResumes = rows.length;
  const averageMatch = useMemo(() => {
    if (totalResumes === 0) return 0;
    return Math.round(rows.reduce((sum, r) => sum + r.score, 0) / totalResumes);
  }, [rows, totalResumes]);

  const shortlistedCount = rows.filter((row) => row.score >= 70).length;
  const selectedCount = selectedCandidate ? 1 : 0;

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
        </div>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Resumes" value={String(totalResumes)} subtitle="Profiles analyzed" />
        <StatsCard title="Average Match %" value={`${averageMatch}%`} subtitle="Across ranked candidates" />
        <StatsCard title="Shortlisted Candidates" value={String(shortlistedCount)} subtitle="Score 70% and above" subtitleTone="success" />
        <StatsCard title="Selected Candidates" value={String(selectedCount)} subtitle="Details view focus" subtitleTone="success" />
      </div>

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
                  onViewDetails={() => setSelectedCandidate(candidate)}
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
                    compact
                    onViewDetails={() => setSelectedCandidate(candidate)}
                  />
                ))
              ) : (
                <p className="text-sm text-[var(--app-muted)]">No additional candidates.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <CandidateDetailsDrawer
        candidate={selectedCandidate}
        isOpen={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  );
}
