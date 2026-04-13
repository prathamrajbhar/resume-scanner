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

export async function GET(request: Request) {
  try {
    const token = readTokenFromCookieHeader(request.headers.get('cookie'));
    if (!token) {
      return NextResponse.json([], { status: 200 });
    }

    const requestUrl = new URL(request.url);
    const roleId = requestUrl.searchParams.get('role_id');
    const shortlisted = requestUrl.searchParams.get('shortlisted');
    const searchParams = new URLSearchParams();
    if (roleId) {
      searchParams.set('role_id', roleId);
    }
    if (shortlisted) {
      searchParams.set('shortlisted', shortlisted);
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    const upstream = await fetch(`${API_BASE_URL}/api/candidates${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { detail: detail || 'Failed to fetch candidates from backend' },
        { status: upstream.status }
      );
    }

    const candidates = (await upstream.json()) as Array<{
      skills?: unknown;
      matched_roles?: unknown;
      shortlisted_roles?: unknown;
      shortlist_entries?: unknown;
    } & Record<string, unknown>>;

    const normalized = candidates.map((candidate) => ({
      ...candidate,
      skills: toStringArray(candidate.skills),
      matched_roles: toStringArray(candidate.matched_roles),
      shortlisted_roles: toStringArray(candidate.shortlisted_roles),
      shortlist_entries: Array.isArray(candidate.shortlist_entries) ? candidate.shortlist_entries : [],
    }));

    return NextResponse.json(normalized, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query candidates';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
