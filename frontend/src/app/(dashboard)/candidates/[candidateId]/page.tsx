'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { GraduationCap, Mail, MapPin, Phone } from 'lucide-react';
import { useCandidate } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CandidateDetailPage() {
  const params = useParams<{ candidateId: string }>();
  const id = params?.candidateId;

  const { data: candidate, isLoading, error } = useCandidate(id || '');

  if (isLoading) {
    return <div className="h-[220px] animate-pulse rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />;
  }

  if (error || !candidate) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)]">
          {error ? 'Failed to load candidate' : 'Candidate not found.'}
        </p>
        <Button asChild>
          <Link href="/candidates">Back to candidates</Link>
        </Button>
      </div>
    );
  }

  const skills = candidate.skills || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Button asChild variant="ghost" className="mb-2 w-fit px-0 text-[var(--app-muted)]">
            <Link href="/candidates">Back to candidates</Link>
          </Button>
          <CardTitle className="text-3xl">{candidate.full_name || 'Unknown Candidate'}</CardTitle>
          <CardDescription>Candidate profile generated from parsed resume content.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--app-subtle)]"><Mail className="h-3.5 w-3.5" />Email</p>
              <p className="font-medium">{candidate.email || 'Not available'}</p>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--app-subtle)]"><Phone className="h-3.5 w-3.5" />Phone</p>
              <p className="font-medium">{candidate.phone || 'Not available'}</p>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--app-subtle)]"><MapPin className="h-3.5 w-3.5" />Location</p>
              <p className="font-medium">{candidate.location || 'Not available'}</p>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-[var(--app-subtle)]">Experience</p>
              <p className="font-medium">{candidate.total_experience !== null ? `${candidate.total_experience} years` : 'Not available'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
          <CardDescription>Extracted and normalized from parsed documents</CardDescription>
        </CardHeader>
        <CardContent>
        {skills.length === 0 ? (
          <p className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-muted)]">No extracted skills yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill: string) => (
              <Badge key={skill} variant="secondary">{skill}</Badge>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-[var(--app-subtle)]" />
            <CardTitle>Education</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--app-muted)]">{candidate.education || 'Education details not available.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}