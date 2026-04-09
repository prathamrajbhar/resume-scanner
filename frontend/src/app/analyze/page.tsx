'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { analyzeJobDescription } from '@/lib/api';
import { AnalyzeResponse, ScoringModel } from '@/types/resume';
import { useMemo } from 'react';
import { ArrowUpRight, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const modelOptions: ScoringModel[] = ['ensemble', 'hybrid', 'bert', 'tf-idf'];

export default function AnalyzePage() {
  const [jobDescription, setJobDescription] = useState('');
  const [modelType, setModelType] = useState<ScoringModel>('ensemble');
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topCandidate = useMemo(() => result?.candidates?.[0], [result]);

  const handleAnalyze = async (event: FormEvent) => {
    event.preventDefault();
    if (!jobDescription.trim()) {
      setError('Please provide a job description.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await analyzeJobDescription({
        message: jobDescription,
        chat_id: chatId,
        model_type: modelType,
      });

      setResult(response);
      setChatId(response.chat_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Badge className="w-fit">Candidate Ranking</Badge>
          <CardTitle className="text-3xl">Analyze Candidate Fit</CardTitle>
          <CardDescription>Use job description matching to score candidate quality by model.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label htmlFor="modelType" className="mb-2 block text-sm font-medium">
                Scoring model
              </label>
              <select
                id="modelType"
                value={modelType}
                onChange={(event) => setModelType(event.target.value as ScoringModel)}
                className="h-10 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm"
              >
                {modelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="jobDescription" className="mb-2 block text-sm font-medium">
                Job description
              </label>
              <Textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Example: Senior Backend Engineer with Python, FastAPI, PostgreSQL, AWS, and strong system design experience..."
                className="min-h-[220px]"
              />
            </div>

            {error ? <p className="rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">{error}</p> : null}

            <Button type="submit" disabled={loading}>
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-base">Top match</CardTitle>
              </div>
              <CardDescription>Highest scoring candidate from this run</CardDescription>
            </CardHeader>
            <CardContent>
            {topCandidate ? (
              <>
                <h2 className="text-2xl font-semibold">{topCandidate.full_name}</h2>
                <p className="mt-1 text-sm text-[var(--app-muted)]">Score: {Math.round(topCandidate.score)} / 100</p>
                <Button asChild className="mt-4">
                  <Link href={`/candidates/${topCandidate.id}`}>Open candidate</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-[var(--app-muted)]">No ranked candidates returned.</p>
            )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ranked Candidates</CardTitle>
              <CardDescription>{result.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.candidates.map((candidate) => (
                  <article key={candidate.id} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{candidate.full_name}</p>
                        <p className="mt-1 text-sm text-[var(--app-muted)]">
                          {(candidate.matching_skills || []).slice(0, 6).join(', ') || 'No matching skills provided'}
                        </p>
                      </div>
                      <Badge>{Math.round(candidate.score)}</Badge>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="mt-2 px-0 text-[var(--app-brand)]">
                      <Link href={`/candidates/${candidate.id}`}>
                        Open profile
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </article>
                ))}

                {result.candidates.length === 0 ? (
                  <p className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-muted)]">
                    No candidates found. Upload resumes first in Chatbase.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}