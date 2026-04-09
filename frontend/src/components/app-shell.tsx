'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  Mail,
  Menu,
  PanelLeft,
  Settings,
  Users,
} from 'lucide-react';
import { applyStoredTheme, clearStoredAuth, getStoredToken, getStoredUser } from '@/lib/storage';
import { User } from '@/types/resume';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { href: '/chatbase', label: 'Chatbase', icon: Bot, badge: 'new' },
  { href: '/analyze', label: 'Analyze', icon: BarChart3, badge: null },
  { href: '/candidates', label: 'Candidates', icon: Users, badge: null },
  { href: '/gmail', label: 'Gmail Sync', icon: Mail, badge: null },
];

export default function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const isPublicRoute = pathname === '/login';

  const hydrateAuth = () => {
    setCurrentUser(getStoredUser());
    setHasToken(Boolean(getStoredToken()));
  };

  useEffect(() => {
    hydrateAuth();
    setAuthHydrated(true);
    applyStoredTheme();

    const onStorage = () => {
      hydrateAuth();
      applyStoredTheme();
    };
    const onUserUpdated = () => hydrateAuth();
    const onAuthUpdated = () => hydrateAuth();
    const onSettingsUpdated = () => applyStoredTheme();
    window.addEventListener('storage', onStorage);
    window.addEventListener('resume:user-updated', onUserUpdated);
    window.addEventListener('resume:auth-updated', onAuthUpdated);
    window.addEventListener('resume:settings-updated', onSettingsUpdated);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('resume:user-updated', onUserUpdated);
      window.removeEventListener('resume:auth-updated', onAuthUpdated);
      window.removeEventListener('resume:settings-updated', onSettingsUpdated);
    };
  }, []);

  const needsAuthRedirect = !isPublicRoute && authHydrated && (!hasToken || !currentUser?.email);

  useEffect(() => {
    if (!needsAuthRedirect) {
      return;
    }

    const nextPath = encodeURIComponent(pathname || '/');
    router.replace(`/login?next=${nextPath}`);
  }, [needsAuthRedirect, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const onClickOutside = (event: MouseEvent) => {
      if (!profileMenuRef.current) {
        return;
      }

      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [profileMenuOpen]);

  const userInitials = useMemo(() => {
    if (!currentUser?.full_name) {
      return 'HR';
    }

    return currentUser.full_name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [currentUser]);

  const isSignedIn = Boolean(currentUser?.email && hasToken);
  const compactDesktop = desktopSidebarCollapsed;

  const handleLogout = () => {
    clearStoredAuth();
    router.replace('/login');
  };

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!authHydrated || needsAuthRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-[var(--app-muted)]">
        <div className="surface-panel rounded-2xl px-6 py-5">Preparing your secure workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      ) : null}

      <div className="mx-auto flex min-h-screen w-full max-w-[1480px]">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-[280px] border-r border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-4 shadow-[var(--app-shadow-md)] transition-all duration-300 lg:sticky lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
            compactDesktop ? 'lg:w-[90px]' : 'lg:w-[280px]'
          )}
        >
          <div className="flex h-full flex-col">
            <div className={cn('mb-4 flex items-center', compactDesktop ? 'justify-center' : 'justify-between')}>
              <Link href="/" className={cn('flex items-center', compactDesktop ? 'justify-center' : 'gap-3')}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--app-brand)] text-sm font-bold text-white">
                  RS
                </span>
                <div className={cn(compactDesktop && 'lg:hidden')}>
                  <p className="font-display text-base font-semibold">Resume Scanner</p>
                  <p className="text-xs text-[var(--app-muted)]">Production Workspace</p>
                </div>
              </Link>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(false)}>
                <Menu className="h-4 w-4" />
              </Button>
            </div>

            <Separator className="mb-3" />

            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center rounded-lg px-3 py-2 text-sm font-medium',
                      compactDesktop ? 'lg:justify-center' : 'justify-between',
                      active
                        ? 'bg-[var(--app-brand)] text-white'
                        : 'text-[var(--app-muted)] hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]'
                    )}
                    title={compactDesktop ? item.label : undefined}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={cn(compactDesktop && 'lg:hidden')}>{item.label}</span>
                    </span>
                    {item.badge ? (
                      <Badge
                        variant={active ? 'secondary' : 'default'}
                        className={cn('text-[10px] uppercase', compactDesktop && 'lg:hidden')}
                      >
                        {item.badge}
                      </Badge>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div ref={profileMenuRef} className="relative mt-3">
              {profileMenuOpen ? (
                <div className={cn(
                  'absolute bottom-[calc(100%+8px)] z-20 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-2 shadow-[var(--app-shadow-md)]',
                  compactDesktop && 'lg:left-full lg:ml-3 lg:w-[220px]'
                )}>
                  <Link href="/profile" className="block rounded-md px-3 py-2 text-sm text-[var(--app-muted)] hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]">
                    Profile
                  </Link>
                  <Link href="/settings" className="block rounded-md px-3 py-2 text-sm text-[var(--app-muted)] hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]">
                    Settings
                  </Link>
                  {isSignedIn ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)]"
                    >
                      Sign out
                    </button>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className={cn(
                  'w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-2.5 text-left hover:bg-[var(--app-surface-soft)]',
                  compactDesktop && 'lg:px-2'
                )}
              >
                <div className={cn('flex items-center gap-2.5', compactDesktop && 'lg:justify-center')}>
                  <Avatar>
                    {currentUser?.avatar_url ? <AvatarImage src={currentUser.avatar_url} alt={currentUser.full_name || 'User'} /> : null}
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className={cn('min-w-0', compactDesktop && 'lg:hidden')}>
                    <p className="truncate text-sm font-medium">{currentUser?.full_name || 'Guest recruiter'}</p>
                    <p className="truncate text-xs text-[var(--app-muted)]">{currentUser?.email || 'Open menu'}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" className="lg:hidden" onClick={() => setMobileOpen((prev) => !prev)}>
                  <Menu className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" className="hidden lg:inline-flex" onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}>
                  <PanelLeft className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--app-subtle)]">Recruiter Console</p>
                  <p className="text-sm font-semibold">Hiring Command Center</p>
                </div>
              </div>
              <Button asChild variant="secondary" size="icon">
                <Link href="/settings" aria-label="Open settings">
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </header>

          <main className="px-4 pb-10 pt-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}