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

type Context = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const token = readTokenFromCookieHeader(request.headers.get('cookie'));
    if (!token) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await context.params;
    const upstream = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { detail: detail || 'Failed to fetch job from backend' },
        { status: upstream.status }
      );
    }

    const job = await upstream.json();
    return NextResponse.json(job, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query job';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const token = readTokenFromCookieHeader(request.headers.get('cookie'));
    if (!token) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await context.params;
    const payload = await request.json();
    const upstream = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
      method: 'PATCH',
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
        upstreamBody || { detail: 'Failed to update job role' },
        { status: upstream.status }
      );
    }

    return NextResponse.json(upstreamBody, { status: upstream.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update job role';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const token = readTokenFromCookieHeader(request.headers.get('cookie'));
    if (!token) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await context.params;
    const upstream = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { detail: detail || 'Failed to delete job role' },
        { status: upstream.status }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete job role';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
