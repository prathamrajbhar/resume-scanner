import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const TOKEN_COOKIE_KEY = 'resume_scanner_token';

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

    const upstream = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { detail: detail || 'Failed to fetch jobs from backend' },
        { status: upstream.status }
      );
    }

    const jobs = await upstream.json();
    return NextResponse.json(jobs, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query jobs';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = readTokenFromCookieHeader(request.headers.get('cookie'));
    if (!token) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const upstream = await fetch(`${API_BASE_URL}/api/jobs/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const contentType = upstream.headers.get('content-type') || '';
    const upstreamBody = contentType.includes('application/json')
      ? await upstream.json()
      : { detail: await upstream.text() };

    if (!upstream.ok) {
      return NextResponse.json(
        upstreamBody || { detail: 'Failed to create job role' },
        { status: upstream.status }
      );
    }

    return NextResponse.json(upstreamBody, { status: upstream.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job role';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
