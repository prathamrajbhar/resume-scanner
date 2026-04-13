import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const TOKEN_COOKIE_KEY = 'resume_scanner_token';

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

const readTokenFromCookieHeader = (cookieHeader: string | null): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const rawCookie of cookies) {
    const [name, ...rest] = rawCookie.trim().split('=');
    if (name !== TOKEN_COOKIE_KEY) {
      continue;
    }

    const encoded = rest.join('=');
    if (!encoded) {
      return null;
    }

    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }

  return null;
};

type Context = {
  params: Promise<{ candidateId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { candidateId } = await context.params;
    const token = readTokenFromCookieHeader(request.headers.get('cookie'));

    if (!token) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const upstream = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { detail: detail || 'Failed to fetch candidate from backend' },
        { status: upstream.status }
      );
    }

    const candidate = (await upstream.json()) as {
      skills?: unknown;
      matched_roles?: unknown;
      shortlisted_roles?: unknown;
      shortlist_entries?: unknown;
    } & Record<string, unknown>;

    return NextResponse.json(
      {
        ...candidate,
        skills: toStringArray(candidate.skills),
        matched_roles: toStringArray(candidate.matched_roles),
        shortlisted_roles: toStringArray(candidate.shortlisted_roles),
        shortlist_entries: Array.isArray(candidate.shortlist_entries) ? candidate.shortlist_entries : [],
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query candidate';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
