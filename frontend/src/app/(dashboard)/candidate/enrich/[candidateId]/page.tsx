'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { enrichCandidateProfile, extractCandidatePreview, suggestCandidateSkills } from '@/lib/api';
import { useCandidate } from '@/lib/hooks';
import { CandidateEnrichmentResponse, CandidatePreviewResponse, ProfessionalInsight, SkillSuggestion } from '@/types/resume';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function getInsightByKey(result: CandidateEnrichmentResponse | null, key: string): ProfessionalInsight | null {
  if (!result) {
    return null;
  }

  return result.insights.find((item) => item.key === key) || null;
}

function scoreColor(score: number): string {
  if (score >= 75) {
    return 'text-emerald-600';
  }
  if (score >= 55) {
    return 'text-amber-600';
  }
  return 'text-rose-600';
}

function scoreBarClass(score: number): string {
  if (score >= 75) {
    return 'bg-emerald-500';
  }
  if (score >= 55) {
    return 'bg-blue-500';
  }
  return 'bg-rose-500';
}

function scoreWidthClass(score: number): string {
  if (score <= 0) return 'w-0';
  if (score <= 10) return 'w-[10%]';
  if (score <= 20) return 'w-[20%]';
  if (score <= 30) return 'w-[30%]';
  if (score <= 40) return 'w-[40%]';
  if (score <= 50) return 'w-[50%]';
  if (score <= 60) return 'w-[60%]';
  if (score <= 70) return 'w-[70%]';
  if (score <= 80) return 'w-[80%]';
  if (score <= 90) return 'w-[90%]';
  return 'w-full';
}

function normalizeLinkedInUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function readabilityBadgeClass(value: CandidatePreviewResponse['readability']): string {
  if (value === 'good') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (value === 'average') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function confidenceBadgeClass(value: SkillSuggestion['confidence']): string {
  if (value === 'high') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (value === 'medium') {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-slate-100 text-slate-600';
}

function renderHighlightedKeywords(text: string, keywords: string[]) {
  if (!text.trim()) {
    return <p className="text-sm text-gray-500">Start typing profile text to preview extracted signals.</p>;
  }

  if (!keywords.length) {
    return <p className="text-sm text-gray-700">{text}</p>;
  }

  const escapedKeywords = keywords.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
  const segments = text.split(expression);

  return (
    <p className="text-sm text-gray-700">
      {segments.map((segment, index) => {
        const matched = keywords.some((keyword) => keyword.toLowerCase() === segment.toLowerCase());
        if (matched) {
          return (
            <mark key={`${segment}-${index}`} className="rounded bg-yellow-100 px-1 text-gray-800">
              {segment}
            </mark>
          );
        }
        return <span key={`${segment}-${index}`}>{segment}</span>;
      })}
    </p>
  );
}

export default function CandidateEnrichmentPage() {
  const params = useParams<{ candidateId: string }>();
  const candidateId = params?.candidateId || '';

  const { data: candidate, isLoading: isLoadingCandidate } = useCandidate(candidateId);

  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [profileText, setProfileText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CandidateEnrichmentResponse | null>(null);
  const [preview, setPreview] = useState<CandidatePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [skillSuggestions, setSkillSuggestions] = useState<SkillSuggestion[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [result]);

  useEffect(() => {
    const input = profileText.trim();
    if (!input) {
      setPreview(null);
      setSkillSuggestions([]);
      setPreviewError(null);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsPreviewLoading(true);
        setPreviewError(null);

        const [previewResponse, suggestionResponse] = await Promise.all([
          extractCandidatePreview({ text: input }),
          suggestCandidateSkills({ text: input }),
        ]);

        if (isCancelled) {
          return;
        }

        setPreview(previewResponse);
        setSkillSuggestions((suggestionResponse.suggestions || []).slice(0, 10));
      } catch (livePreviewError) {
        if (isCancelled) {
          return;
        }

        setPreviewError(livePreviewError instanceof Error ? livePreviewError.message : 'Failed to load live preview.');
      } finally {
        if (!isCancelled) {
          setIsPreviewLoading(false);
        }
      }
    }, 500);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [profileText]);

  const addSuggestedSkill = (name: string) => {
    setSelectedSkills((previous) => {
      if (previous.some((item) => item.toLowerCase() === name.toLowerCase())) {
        return previous;
      }
      return [...previous, name];
    });
  };

  const removeSelectedSkill = (name: string) => {
    setSelectedSkills((previous) => previous.filter((item) => item.toLowerCase() !== name.toLowerCase()));
  };

  const candidateLabel = useMemo(() => candidate?.full_name || 'Candidate', [candidate?.full_name]);

  const handleAnalyze = async (event: FormEvent) => {
    event.preventDefault();

    if (!candidateId) {
      setError('Candidate id is missing.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await enrichCandidateProfile({
        candidate_id: candidateId,
        linkedin_url: normalizeLinkedInUrl(linkedinUrl) || undefined,
        profile_text: profileText.trim() || undefined,
      });
      setResult(response);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Failed to enrich candidate profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const communication = getInsightByKey(result, 'communication');
  const domain = getInsightByKey(result, 'domain');
  const learning = getInsightByKey(result, 'learning');
  const stability = getInsightByKey(result, 'stability');
  const profilePreviewItems = [
    { label: 'Candidate', value: candidateLabel },
    { label: 'Email', value: candidate?.email || 'Not available' },
    { label: 'Experience', value: candidate?.total_experience !== null && candidate?.total_experience !== undefined ? `${candidate.total_experience} years` : 'Not available' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 space-y-1">
            <Button asChild variant="ghost" className="w-fit px-0 text-[var(--app-muted)]">
              <Link href="/candidates">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h2 className="text-xl font-semibold text-gray-800">Candidate Enrichment</h2>
            <p className="text-sm text-gray-500">Enhance evaluation using resume + LinkedIn insights</p>
          </div>

          <form onSubmit={handleAnalyze} className="flex flex-col gap-5">
            <div>
              <label htmlFor="linkedin-url" className="text-sm text-gray-500">
                LinkedIn URL (optional)
              </label>
              <input
                id="linkedin-url"
                type="text"
                inputMode="url"
                value={linkedinUrl}
                onChange={(event) => setLinkedinUrl(event.target.value)}
                placeholder="https://www.linkedin.com/in/candidate-profile"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="profile-text" className="text-sm text-gray-500">
                Paste LinkedIn Summary (optional)
              </label>
              <textarea
                id="profile-text"
                value={profileText}
                onChange={(event) => setProfileText(event.target.value)}
                placeholder="Paste candidate's LinkedIn summary, experience, or any public info..."
                rows={5}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-gray-700">Live Preview</h4>
                  {isPreviewLoading ? <span className="text-xs text-gray-500">Analyzing...</span> : null}
                </div>

                {previewError ? <p className="text-xs text-rose-600">{previewError}</p> : null}

                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {(preview?.skills || []).length ? (
                        (preview?.skills || []).map((skill) => (
                          <span key={skill} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">No skills detected yet.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Keywords</p>
                    <div className="rounded-md border border-gray-200 bg-white p-2">{renderHighlightedKeywords(profileText, preview?.keywords || [])}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Readability</p>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${readabilityBadgeClass(preview?.readability || 'poor')}`}>
                      {preview?.readability || 'poor'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-gray-700">Suggested Skills</h4>
                <span className="text-xs text-gray-500">Top 10, add manually</span>
              </div>

              <div className="space-y-2">
                {skillSuggestions.length ? (
                  skillSuggestions.slice(0, 10).map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700">{item.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${confidenceBadgeClass(item.confidence)}`}>
                          {item.confidence}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => addSuggestedSkill(item.name)}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        + Add
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">Add profile text to get AI skill suggestions.</p>
                )}
              </div>

              <div className="mt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Selected skills (HR confirmed)</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSkills.length ? (
                    selectedSkills.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => removeSelectedSkill(skill)}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                      >
                        {skill} x
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">No suggested skills added yet.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-gray-400">Better input = better insights</span>
              <Button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700">
                {isSubmitting ? 'Analyzing profile...' : 'Analyze Profile'}
              </Button>
            </div>

            {!linkedinUrl.trim() && !profileText.trim() ? (
              <p className="text-sm text-amber-700">Add LinkedIn summary for better insights</p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">
                {error}
              </p>
            ) : null}
          </form>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">What we analyze</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Communication quality</li>
              <li>• Domain alignment</li>
              <li>• Learning & certifications</li>
              <li>• Career consistency</li>
            </ul>
          </div>

          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700 shadow-sm">
            <p className="font-semibold">Strong results come from:</p>
            <ul className="mt-2 space-y-1">
              <li>LinkedIn About section</li>
              <li>Experience descriptions</li>
              <li>Certifications</li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Preview</h3>
            <div className="space-y-3">
              {profilePreviewItems.map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="text-sm font-medium text-gray-800">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {result ? (
        <div ref={resultsRef} className="mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-lg font-semibold text-gray-800">Professional Insights</h3>
          <p className="mb-4 text-sm text-gray-500">AI-powered insights generated from resume content and your optional profile input.</p>

          {result.guidance_message ? <p className="mb-4 text-sm text-amber-700">{result.guidance_message}</p> : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[communication, domain, learning, stability].map((insight, index) => {
              const score = Math.round(insight?.score || 0);
              return (
                <div key={insight?.key || index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">{insight?.title || 'Insight'}</p>
                  <div className="mt-2 h-2 w-full rounded bg-gray-200">
                    <div className={`h-2 rounded ${scoreBarClass(score)} ${scoreWidthClass(score)}`} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className={`text-sm font-semibold ${scoreColor(score)}`}>{score}%</p>
                    <p className="text-xs text-gray-500">{insight?.explanation || 'No explanation available yet.'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
