'use client';

import { useState } from 'react';
import { Inbox, MailCheck, UserPlus, Workflow } from 'lucide-react';
import { useSyncGmail } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function GmailPage() {
  const syncGmailMutation = useSyncGmail();
  const [result, setResult] = useState<any | null>(null);

  const handleFetch = async () => {
    try {
      const data = await syncGmailMutation.mutateAsync();
      setResult(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loading = syncGmailMutation.isPending;
  const error = syncGmailMutation.error;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Badge className="w-fit">Automation</Badge>
          <CardTitle className="text-3xl">Gmail Resume Sync</CardTitle>
          <CardDescription>Scan inbox attachments and convert resumes into candidates automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleFetch} disabled={loading} className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            {loading ? 'Syncing...' : 'Fetch Resumes from Gmail'}
          </Button>
          {error ? (
            <p className="mt-4 rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">
              Failed to sync Gmail resumes. Please ensure you are logged in with Google.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2"><Workflow className="h-4 w-4" />Status</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold capitalize">{result.status || 'Success'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2"><MailCheck className="h-4 w-4" />Processed Attachments</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{result.processed_count || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2"><UserPlus className="h-4 w-4" />New Candidates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{result.new_candidates_count || 0}</p>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}