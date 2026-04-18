'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MapPin, Search, Trash2, UserRound } from 'lucide-react';
import { useCandidates, useDeleteCandidate, useJobs } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTopToast } from '@/components/ui/top-toast';

export default function CandidatesPage() {
  const { showToast } = useTopToast();
  const [query, setQuery] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [activeTab, setActiveTab] = useState<'shortlisted' | 'all'>('shortlisted');
  const [pendingDeleteCandidate, setPendingDeleteCandidate] = useState<{ id: string; name: string } | null>(null);
  const { data: roles = [] } = useJobs();
  const deleteCandidateMutation = useDeleteCandidate();
  const { data: candidates = [], isLoading, error } = useCandidates({
    roleId: selectedRoleId || undefined,
    shortlisted: activeTab === 'shortlisted',
  });

  const selectedRoleTitle = useMemo(() => {
    if (!selectedRoleId) {
      return '';
    }

    const role = roles.find((item: any) => item.id === selectedRoleId);
    return role?.title || '';
  }, [roles, selectedRoleId]);

  const filteredCandidates = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return candidates;

    return candidates.filter((candidate: any) => {
      const name = (candidate.full_name || '').toLowerCase();
      const skills = (candidate.skills || []).map((s: string) => s.toLowerCase());
      const location = (candidate.location || '').toLowerCase();
      
      return name.includes(term) || 
             skills.some((s: string) => s.includes(term)) || 
             location.includes(term);
    });
  }, [candidates, query]);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteCandidate) {
      return;
    }

    try {
      await deleteCandidateMutation.mutateAsync(pendingDeleteCandidate.id);
      showToast({
        message: 'Candidate deleted successfully',
        tone: 'success',
      });
      setPendingDeleteCandidate(null);
    } catch (deleteError) {
      showToast({
        message: deleteError instanceof Error ? deleteError.message : 'Failed to delete candidate',
        tone: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Candidates</CardTitle>
          <CardDescription>Shortlisted candidates workspace for final hiring decisions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 inline-flex rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('shortlisted')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeTab === 'shortlisted'
                  ? 'bg-white text-[var(--app-text)] shadow-sm'
                  : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              Shortlisted
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeTab === 'all'
                  ? 'bg-white text-[var(--app-text)] shadow-sm'
                  : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              All Candidates
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-subtle)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, skill, or location"
                className="pl-9"
              />
            </div>

            <select
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              className="h-10 min-w-[200px] rounded-md border border-gray-300 bg-white px-3 text-sm text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Filter by job role"
            >
              <option value="">All Roles</option>
              {roles.map((role: any) => (
                <option key={role.id} value={role.id}>
                  {role.title}
                </option>
              ))}
            </select>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery('');
                setSelectedRoleId('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-lg border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)]">
          Failed to load candidates.
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-[130px] animate-pulse rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCandidates.map((candidate: any) => (
            <Card key={candidate.id} className="transition-colors hover:bg-[var(--app-surface-soft)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-[var(--app-subtle)]" />
                    <h2 className="text-lg font-semibold">{candidate.full_name || 'Unknown Candidate'}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{(candidate.skills || []).length} skills</Badge>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteCandidate({ id: candidate.id, name: candidate.full_name || 'this candidate' })}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      aria-label={`Delete ${candidate.full_name || 'candidate'}`}
                      title="Delete candidate"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--app-muted)]">
                  <MapPin className="h-3.5 w-3.5" />
                  {candidate.location || 'Location not available'}
                </p>

                <p className="mt-2 line-clamp-2 text-sm text-[var(--app-muted)]">
                  {(candidate.skills || []).join(', ') || 'No extracted skills yet'}
                </p>

                {selectedRoleTitle ? (
                  <p className="mt-2 text-xs font-medium text-[var(--app-brand)]">Matched for: {selectedRoleTitle}</p>
                ) : Array.isArray(candidate.shortlisted_roles) && candidate.shortlisted_roles.length > 0 ? (
                  <p className="mt-2 text-xs font-medium text-[var(--app-brand)]">Matched for: {candidate.shortlisted_roles[0]}</p>
                ) : null}

                <Link href={`/candidates/${candidate.id}`} className="mt-4 inline-block text-sm font-medium text-[var(--app-brand)]">
                  View profile
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredCandidates.length === 0 ? (
        <p className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-[var(--app-muted)]">
          {activeTab === 'shortlisted'
            ? 'No shortlisted candidates yet. Go to Analyze and select candidates.'
            : selectedRoleTitle
              ? 'No candidates found for selected role. Try another role or upload resumes.'
              : 'No candidates matched your search.'}
          {activeTab === 'shortlisted' ? (
            <Link href="/chatbase" className="ml-1 font-medium text-[var(--app-brand)] underline-offset-2 hover:underline">
              Go to Analyze -&gt; Select candidates
            </Link>
          ) : null}
        </p>
      ) : null}

      {pendingDeleteCandidate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPendingDeleteCandidate(null);
            }
          }}
          role="presentation"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--app-text)]">Delete Candidate?</h3>
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              This will permanently delete this candidate and all related data. This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPendingDeleteCandidate(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteCandidateMutation.isPending}
                className="border border-red-300 bg-white text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleteCandidateMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}