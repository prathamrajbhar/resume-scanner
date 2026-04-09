'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MapPin, Search, UserRound } from 'lucide-react';
import { getCandidates } from '@/lib/api';
import { Candidate } from '@/types/resume';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getCandidates();
        setCandidates(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load candidates');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredCandidates = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return candidates;
    }

    return candidates.filter((candidate) => {
      const inName = candidate.full_name.toLowerCase().includes(term);
      const inSkills = (candidate.skills || []).some((skill) => skill.toLowerCase().includes(term));
      const inLocation = (candidate.location || '').toLowerCase().includes(term);
      return inName || inSkills || inLocation;
    });
  }, [candidates, query]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Candidates</CardTitle>
          <CardDescription>Search, inspect, and open parsed candidate profiles.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-subtle)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, skill, or location"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {error ? <p className="rounded-lg border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)]">{error}</p> : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-[130px] animate-pulse rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCandidates.map((candidate) => (
            <Card key={candidate.id} className="transition-colors hover:bg-[var(--app-surface-soft)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-[var(--app-subtle)]" />
                    <h2 className="text-lg font-semibold">{candidate.full_name}</h2>
                  </div>
                  <Badge variant="secondary">{(candidate.skills || []).length} skills</Badge>
                </div>

                <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--app-muted)]">
                  <MapPin className="h-3.5 w-3.5" />
                  {candidate.location || 'Location not available'}
                </p>

                <p className="mt-2 line-clamp-2 text-sm text-[var(--app-muted)]">
                  {(candidate.skills || []).join(', ') || 'No extracted skills yet'}
                </p>

                <Link href={`/candidates/${candidate.id}`} className="mt-4 inline-block text-sm font-medium text-[var(--app-brand)]">
                  View profile
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredCandidates.length === 0 ? (
        <p className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-[var(--app-muted)]">No candidates matched your search.</p>
      ) : null}
    </div>
  );
}