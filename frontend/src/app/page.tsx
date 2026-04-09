'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Sparkles, Users } from 'lucide-react';
import StatCard from '@/components/stat-card';
import { getCandidates } from '@/lib/api';
import { Candidate } from '@/types/resume';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCandidates = async () => {
      setLoading(true);
      try {
        const data = await getCandidates();
        setCandidates(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch candidates');
      } finally {
        setLoading(false);
      }
    };

    void loadCandidates();
  }, []);

  const stats = useMemo(() => {
    const totalCandidates = candidates.length;
    const allSkills = candidates.flatMap((candidate) => candidate.skills || []);
    const uniqueSkills = new Set(allSkills.map((skill) => skill.toLowerCase()));
    const avgSkills = totalCandidates > 0 ? Math.round(allSkills.length / totalCandidates) : 0;

    return {
      totalCandidates,
      uniqueSkills: uniqueSkills.size,
      avgSkills,
    };
  }, [candidates]);

  return (
    <div className="space-y-6">
      <Card className="hero-grid overflow-hidden border-none bg-transparent shadow-none">
        <CardContent className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <Badge>Recruiting Workspace</Badge>
              <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight md:text-5xl">
                Production-ready hiring control center for screening and ranking.
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-[var(--app-muted)] md:text-base">
                Upload resumes, run matching, and move from shortlist to interview in one consistent interface designed for speed.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/chatbase">
                    Open Chatbase
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/analyze">Analyze Candidates</Link>
                </Button>
              </div>
            </div>

            <Card className="bg-[var(--app-surface-elevated)]">
              <CardHeader>
                <CardTitle className="text-base">Live Overview</CardTitle>
                <CardDescription>Current pipeline health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                  <p className="text-xs text-[var(--app-muted)]">Candidates</p>
                  <p className="mt-1 text-2xl font-semibold">{loading ? '...' : stats.totalCandidates}</p>
                </div>
                <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
                  <p className="text-xs text-[var(--app-muted)]">Skill Coverage</p>
                  <p className="mt-1 text-2xl font-semibold">{loading ? '...' : stats.uniqueSkills}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Candidates" value={loading ? '...' : String(stats.totalCandidates)} hint="Profiles indexed" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Average Skills" value={loading ? '...' : String(stats.avgSkills)} hint="Per resume" icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Skill Diversity" value={loading ? '...' : String(stats.uniqueSkills)} hint="Unique skills detected" icon={<BriefcaseBusiness className="h-4 w-4" />} />
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Candidates</CardTitle>
            <CardDescription>Latest parsed candidate profiles</CardDescription>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/candidates">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="rounded-lg border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">{error}</p> : null}

          {!loading && candidates.length === 0 ? (
            <p className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-muted)]">
              No candidates available yet. Upload resumes from Chatbase or Gmail sync.
            </p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {candidates.slice(0, 6).map((candidate) => (
              <Link
                key={candidate.id}
                href={`/candidates/${candidate.id}`}
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4 transition-colors hover:bg-[var(--app-surface-soft)]"
              >
                <p className="font-semibold">{candidate.full_name}</p>
                <p className="mt-1 text-sm text-[var(--app-muted)]">{(candidate.skills || []).slice(0, 4).join(', ') || 'No skills parsed yet'}</p>
              </Link>
            ))}
            {loading
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-24 animate-pulse rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
                ))
              : null}
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-3">
            <Button asChild variant="secondary" className="justify-between">
              <Link href="/chatbase">Chatbase <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="secondary" className="justify-between">
              <Link href="/gmail">Gmail Sync <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="secondary" className="justify-between">
              <Link href="/analyze">AI Analysis <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
