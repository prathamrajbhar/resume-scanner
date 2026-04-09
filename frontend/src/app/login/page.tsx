'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { googleLogin } from '@/lib/api';
import { getStoredToken, getStoredUser, setStoredToken, setStoredUser } from '@/lib/storage';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

const resolveNextPath = (value: string | null): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => resolveNextPath(searchParams.get('next')), [searchParams]);

  useEffect(() => {
    const hasSession = Boolean(getStoredToken() && getStoredUser()?.email);
    if (hasSession) {
      router.replace(nextPath);
    }
  }, [nextPath, router]);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setLoading(true);
    setError(null);

    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }

      const response = await googleLogin({
        id_token: credentialResponse.credential,
      });

      setStoredToken(response.access_token);
      setStoredUser(response.user);
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-5 py-14 sm:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[var(--app-bg)]" />
      <div className="pointer-events-none absolute left-[-120px] top-[-120px] -z-10 h-[300px] w-[300px] rounded-full bg-blue-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-140px] right-[-80px] -z-10 h-[320px] w-[320px] rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="mx-auto grid max-w-5xl items-stretch gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="hidden lg:block">
          <CardHeader>
            <Badge className="w-fit">Resume Scanner</Badge>
            <CardTitle className="mt-2 text-4xl leading-tight">
            One secure workspace for faster hiring decisions.
            </CardTitle>
            <CardDescription className="max-w-lg text-sm">
            Sign in to upload resumes, run candidate ranking, and manage your hiring pipeline with protected access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--app-subtle)]"><ShieldCheck className="h-3.5 w-3.5" />Secure API access</p>
                <p className="text-sm">All workflow endpoints require authenticated tokens.</p>
              </div>
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--app-subtle)]"><Sparkles className="h-3.5 w-3.5" />Role-ready dashboard</p>
                <p className="text-sm">Candidates, Chatbase, Analysis, and Gmail sync in one flow.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge className="w-fit">Account Access</Badge>
            <CardTitle className="mt-2 flex items-center gap-2 text-3xl sm:text-4xl"><LockKeyhole className="h-6 w-6" />Sign in</CardTitle>
            <CardDescription>Use your Google account to continue to your workspace.</CardDescription>
          </CardHeader>
          <CardContent>

          {!GOOGLE_CLIENT_ID ? (
            <p className="rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">
              Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend environment configuration.
            </p>
          ) : (
            <div className="flex min-h-14 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--app-muted)]">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-[var(--app-text)]" />
                  Verifying account...
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google login failed. Please try again.')}
                  useOneTap
                  theme="outline"
                  size="large"
                  shape="pill"
                />
              )}
            </div>
          )}

            {error ? <p className="mt-4 rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">{error}</p> : null}

            <p className="mt-5 text-xs text-[var(--app-subtle)]">By continuing, you agree to your organization access policies.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6 text-center text-[var(--app-muted)]">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-5">Loading login...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
