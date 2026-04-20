'use client';

import Image from 'next/image';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { CredentialResponse } from '@react-oauth/google';
import { googleLogin } from '@/lib/api';
import { getStoredToken, getStoredUser, setProfileSetupRequired, setStoredToken, setStoredUser } from '@/lib/storage';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleButton } from '@/components/auth/google-button';

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
    if (typeof window !== 'undefined') {
      const { protocol, hostname, pathname, search, hash } = window.location;
      const isCanonicalLocalhost = protocol === 'http:' && hostname === 'localhost';

      // Google OAuth JavaScript origins are usually configured for localhost in dev.
      // Redirect from LAN/127 hosts to avoid origin_mismatch failures.
      if (!isCanonicalLocalhost) {
        const redirectUrl = `http://localhost:3000${pathname}${search}${hash}`;
        window.location.replace(redirectUrl);
        return;
      }
    }

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

      const userForStorage = response.is_new_user
        ? { ...response.user, full_name: null }
        : response.user;

      setStoredToken(response.access_token);
      setStoredUser(userForStorage);
      const missingName = !userForStorage.full_name || userForStorage.full_name.trim().length === 0;
      setProfileSetupRequired(Boolean(response.is_new_user || missingName));
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-120px] h-[280px] w-[520px] -translate-x-1/2 rounded-full bg-[var(--app-brand-soft)] blur-3xl" />
      </div>

      <div className="surface-panel-strong relative mx-auto flex w-full max-w-sm flex-col rounded-2xl p-6 text-center shadow-md">
        <div className="mb-4 flex flex-col items-center gap-3">
          <Image
            src="/assets/logo-icon.png"
            width={40}
            height={40}
            alt="AI HR Copilot logo"
            className="mb-3 h-10 w-10 rounded"
            priority
          />
          <h2 className="mb-2 text-2xl font-semibold tracking-tight text-[var(--app-text)]">Welcome to AI HR Copilot</h2>
          <p className="mb-1 text-sm text-gray-500">Sign in or create an account to continue</p>
          <h1 className="text-lg font-medium text-[var(--app-text)]">Log in or sign up</h1>
          <p className="text-sm text-gray-400">Continue to AI HR Copilot</p>
        </div>

        <div className="grid gap-4">
          <GoogleButton
            loading={loading}
            disabled={!GOOGLE_CLIENT_ID}
            onSuccess={handleGoogleSuccess}
            onError={() => {
              const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown-origin';
              setError(`Google sign-in failed for origin ${origin}. Use http://localhost:3000 or add this origin in Google Cloud OAuth settings.`);
            }}
          />

          {error ? (
            <p className="rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] px-3 py-2 text-sm text-[var(--app-danger-text)]">
              {error}
            </p>
          ) : null}
        </div>
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
