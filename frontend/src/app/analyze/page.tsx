'use client';

import { useMemo, useState } from 'react';
import { AnalysisBadge } from '@/components/analyze/Badge';
import { AnalysisTable } from '@/components/analyze/AnalysisTable';
import { StatsCard } from '@/components/analyze/StatsCard';

type AnalysisReportRow = {
  id: string;
  filename: string;
  role: string;
  score: number;
  topSkills: string[];
};

const reportRows: AnalysisReportRow[] = [
  {
    id: 'cand-1',
    filename: 'Aarav_Shah_Backend.pdf',
    role: 'Senior Backend Engineer',
    score: 32,
    topSkills: ['Python', 'FastAPI', 'PostgreSQL'],
  },
  {
    id: 'cand-2',
    filename: 'Nina_Williams_FullStack.docx',
    role: 'Full Stack Product Engineer',
    score: 27,
    topSkills: ['React', 'TypeScript', 'Node.js'],
  },
  {
    id: 'cand-3',
    filename: 'Rahul_Verma_DataAnalyst.pdf',
    role: 'Talent Analytics Specialist',
    score: 21,
    topSkills: ['NLP', 'Tableau', 'Prompt Engineering'],
  },
  {
    id: 'cand-4',
    filename: 'Sara_Khan_Engineer.txt',
    role: 'Senior Backend Engineer',
    score: 18,
    topSkills: ['Django', 'System Design', 'Docker'],
  },
  {
    id: 'cand-5',
    filename: 'Fatima_Ali_MLEngineer.pdf',
    role: 'Talent Analytics Specialist',
    score: 16,
    topSkills: ['Machine Learning', 'PyTorch', 'NLP'],
  },
  {
    id: 'cand-6',
    filename: 'Rohan_Singh_Backend.docx',
    role: 'Senior Backend Engineer',
    score: 14,
    topSkills: ['Go', 'Redis', 'Kubernetes'],
  },
];

export default function AnalyzePage() {
  const [selectedRole, setSelectedRole] = useState<string>('All Roles');
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, boolean>>({});
  const [shortlistedCandidates, setShortlistedCandidates] = useState<Record<string, boolean>>({
    'cand-1': true,
    'cand-2': true,
  });

  const roleOptions = useMemo(() => {
    const roles = Array.from(new Set(reportRows.map((row) => row.role))).sort();
    return ['All Roles', ...roles];
  }, []);

  const filteredBaseRows = useMemo(() => {
    if (selectedRole === 'All Roles') {
      return reportRows;
    }

    return reportRows.filter((row) => row.role === selectedRole);
  }, [selectedRole]);

  const rankedRows = useMemo(() => {
    return [...filteredBaseRows]
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [filteredBaseRows]);

  const topFiveCandidates = useMemo(() => rankedRows.slice(0, 5), [rankedRows]);

  const totalResumes = rankedRows.length;

  const averageMatch = useMemo(() => {
    if (rankedRows.length === 0) {
      return 0;
    }

    const total = rankedRows.reduce((sum, row) => sum + row.score, 0);
    return Math.round(total / rankedRows.length);
  }, [rankedRows]);

  const selectedCount = useMemo(() => {
    return rankedRows.filter((row) => selectedCandidates[row.id]).length;
  }, [rankedRows, selectedCandidates]);

  const shortlistedCount = useMemo(() => {
    return rankedRows.filter((row) => shortlistedCandidates[row.id]).length;
  }, [rankedRows, shortlistedCandidates]);

  const toggleShortlist = (id: string) => {
    setShortlistedCandidates((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleSelect = (id: string) => {
    setSelectedCandidates((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-gray-900">System Overview</h1>
            <p className="text-sm text-gray-500">Real-time analytics of resume processing and skill matching.</p>
          </div>

          <div className="w-full lg:w-[300px]">
            <label htmlFor="role-filter" className="mb-2 block text-sm font-medium text-gray-600">
              Select Job Role
            </label>
            <select
              id="role-filter"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
              className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard
          title="Total Resumes"
          value={String(totalResumes)}
          subtitle="+12% from last month"
          subtitleTone="success"
          icon={<span aria-hidden="true">RS</span>}
        />
        <StatsCard
          title="Average Match"
          value={`${averageMatch}%`}
          subtitle={selectedRole === 'All Roles' ? 'Across all job roles' : selectedRole}
          icon={<span aria-hidden="true">AM</span>}
        />
        <StatsCard
          title="Shortlisted"
          value={String(shortlistedCount)}
          subtitle="Qualified Candidates"
          icon={<span aria-hidden="true">SC</span>}
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-gray-900">Top 5 Candidates</h2>
            <p className="mt-1 text-xs text-gray-500">Top candidates are ranked based on AI score</p>
          </div>
          <AnalysisBadge tone="neutral">{selectedCount} Candidates Selected</AnalysisBadge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {topFiveCandidates.map((candidate) => {
            const isSelected = Boolean(selectedCandidates[candidate.id]);
            const isTopOne = candidate.rank === 1;
            const isTopTwo = candidate.rank === 2;
            const isTopThree = candidate.rank === 3;

            const topStyleClass = isTopOne
              ? 'bg-green-50 border border-green-300'
              : isTopTwo
                ? 'bg-blue-50 border border-blue-300'
                : isTopThree
                  ? 'bg-gray-50 border border-gray-300'
                  : 'bg-white border border-gray-200';

            const topBadge = isTopOne ? 'Top 1' : isTopTwo ? 'Top 2' : isTopThree ? 'Top 3' : null;

            return (
              <article
                key={candidate.id}
                className={`h-full rounded-xl p-4 text-left shadow-sm transition hover:shadow-md ${
                  isSelected ? `${topStyleClass} ring-2 ring-blue-500` : topStyleClass
                }`}
              >
                <div className="flex h-full flex-col justify-between space-y-2 text-left">
                  <div className="flex items-center justify-between gap-2 text-left">
                  <p className="truncate text-sm font-semibold text-gray-900">{candidate.filename}</p>
                  {topBadge ? (
                    <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-gray-100 px-2 py-1 text-xs leading-none text-gray-600">
                      {topBadge}
                    </span>
                  ) : null}
                  </div>

                  <p className="text-sm text-gray-700">{candidate.score}% Match</p>
                  <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">Top skills: {candidate.topSkills.join(', ')}</p>

                  <button
                    type="button"
                    onClick={() => toggleSelect(candidate.id)}
                    className={`mt-auto w-full rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isSelected
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Final Select'}
                  </button>
                </div>
              </article>
            );
          })}

          {topFiveCandidates.length === 0 ? (
            <p className="col-span-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
              No candidates available for the selected role.
            </p>
          ) : null}
        </div>
      </section>

      <AnalysisTable
        rows={rankedRows}
        shortlistedById={shortlistedCandidates}
        selectedById={selectedCandidates}
        onToggleShortlist={toggleShortlist}
        onToggleSelect={toggleSelect}
      />
    </div>
  );
}
