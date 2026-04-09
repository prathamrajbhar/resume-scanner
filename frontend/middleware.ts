import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE_KEY = 'resume_scanner_token';
const PUBLIC_PATHS = new Set(['/login']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_KEY)?.value;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!token && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname || '/');
    return NextResponse.redirect(loginUrl);
  }

  if (token && isPublic) {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
