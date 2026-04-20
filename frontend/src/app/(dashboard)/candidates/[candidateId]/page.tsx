'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, GraduationCap, Mail, MapPin, Phone } from 'lucide-react';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { useCandidate } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteCandidate } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function CandidateDetailPage() {
  const router = useRouter();
  const params = useParams<{ candidateId: string }>();
  const id = params?.candidateId;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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
          <Link href="/candidates">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    );
  }

  const skills = candidate.skills || [];
  const degrees = candidate.degrees || [];
  const totalExperience = candidate.total_experience !== null ? `${candidate.total_experience} years` : 'Not available';

  const handleDelete = async () => {
    if (!candidate?.id || isDeleting) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteCandidate(candidate.id);
      router.push('/candidates');
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="rounded-xl border border-gray-100 shadow-sm">
            <CardHeader className="space-y-3">
              <Button asChild variant="ghost" className="w-fit px-0 text-[var(--app-muted)]">
                <Link href="/candidates">
                  <ChevronLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex flex-col gap-2">
                <CardTitle className="text-3xl">{candidate.full_name || 'Unknown Candidate'}</CardTitle>
                <CardDescription>Candidate profile generated from parsed resume content.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col rounded-lg bg-gray-50 p-4">
                  <span className="text-xs text-gray-400">Email</span>
                  <span className="text-sm font-medium text-gray-800">{candidate.email || 'Not available'}</span>
                </div>
                <div className="flex flex-col rounded-lg bg-gray-50 p-4">
                  <span className="text-xs text-gray-400">Phone</span>
                  <span className="text-sm font-medium text-gray-800">{candidate.phone || 'Not available'}</span>
                </div>
                <div className="flex flex-col rounded-lg bg-gray-50 p-4">
                  <span className="text-xs text-gray-400">Location</span>
                  <span className="text-sm font-medium text-gray-800">{candidate.location || 'Not available'}</span>
                </div>
                <div className="flex flex-col rounded-lg bg-gray-50 p-4">
                  <span className="text-xs text-gray-400">Experience</span>
                  <span className="text-sm font-medium text-gray-800">{totalExperience}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold mb-0">Skills</CardTitle>
              <CardDescription>Extracted and normalized from parsed documents</CardDescription>
            </CardHeader>
            <CardContent>
              {skills.length === 0 ? (
                <p className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-muted)]">
                  No extracted skills yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill: string) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-gray-100 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-[var(--app-subtle)]" />
                <CardTitle className="text-lg font-semibold mb-0">Education</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {degrees.length > 0 ? (
                degrees.map((degree, index) => (
                  <div key={`${degree.degree || 'degree'}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-800">{degree.degree || 'Degree not available'}</p>
                    <p className="text-xs text-gray-500">{degree.field || degree.college || degree.location || candidate.education || 'Education details not available.'}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--app-muted)]">{candidate.education || 'Education details not available.'}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="rounded-xl border border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-md font-semibold mb-0">Quick Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 leading-6">
                Strong candidate with AI background and problem-solving skills. Resume data shows technical breadth across web, machine learning, and collaboration-focused skills.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-md font-semibold mb-0">Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button asChild className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700">
                <Link href={`/candidate/enrich/${candidate.id}`}>Candidate Enrichment</Link>
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setIsDeleteConfirmOpen(true)}
              >
                Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete candidate?"
        message="This will permanently remove the candidate and all local resume data."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        confirmDisabled={isDeleting}
      />
    </div>
  );
}