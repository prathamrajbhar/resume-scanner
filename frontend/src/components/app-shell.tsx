'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeft,
  Settings,
  User as UserIcon,
  X,
  Users,
} from 'lucide-react';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { applyStoredTheme, clearStoredAuth, getStoredToken, getStoredUser } from '@/lib/storage';
import { User } from '@/types/resume';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppModal } from '@/components/ui/app-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProfileTabsModal } from '@/components/ui/profile-tabs-modal';
import { Separator } from '@/components/ui/separator';
import { SettingsModalContent } from '@/components/ui/settings-modal-content';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { href: '/chatbase', label: 'Chatbase', icon: Bot, badge: 'new' },
  { href: '/job-roles', label: 'Job Roles', icon: BriefcaseBusiness, badge: null },
  { href: '/analyze', label: 'Analyze', icon: BarChart3, badge: null },
  { href: '/candidates', label: 'Candidates', icon: Users, badge: null },
  { href: '/gmail', label: 'Gmail Sync', icon: Mail, badge: null },
];

export default function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [hasTempDashboardAccess, setHasTempDashboardAccess] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const isPublicRoute = pathname === '/login';
  const isChatFocusRoute = pathname.startsWith('/chatbase');

  const hydrateAuth = () => {
    setCurrentUser(getStoredUser());
    setHasToken(Boolean(getStoredToken()));
    if (typeof window !== 'undefined') {
      setHasTempDashboardAccess(window.localStorage.getItem('temp_dashboard_access') === '1');
    }
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

  const hasTempAccessFromStorage =
    typeof window !== 'undefined' && window.localStorage.getItem('temp_dashboard_access') === '1';

  const needsAuthRedirect =
    !isPublicRoute &&
    authHydrated &&
    !(hasTempDashboardAccess || hasTempAccessFromStorage) &&
    (!hasToken || !currentUser?.email);

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
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('temp_dashboard_access');
    }
    router.replace('/login');
  };

  const handleSignOutRequest = () => {
    setProfileMenuOpen(false);
    setIsSignOutConfirmOpen(true);
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

  if (isChatFocusRoute) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
        <main className="min-h-screen">{children}</main>
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
            'fixed inset-y-0 left-0 z-50 w-[280px] border-r border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-4 shadow-[var(--app-shadow-md)] transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
            compactDesktop ? 'lg:w-[90px]' : 'lg:w-[280px]'
          )}
        >
          <div className="flex h-full flex-col">
            <div className={cn('mb-4 flex items-center', compactDesktop ? 'justify-center' : 'justify-between')}>
              <Link
                href="/dashboard"
                className={cn(
                  'flex items-center rounded-lg transition-transform duration-200 hover:scale-[1.02] hover:opacity-90',
                  compactDesktop ? 'justify-center' : 'gap-3'
                )}
              >
                <Image
                  src="/assets/logo-icon.png"
                  width={24}
                  height={24}
                  alt="AI HR Copilot logo"
                  className="h-6 w-6 rounded"
                  priority
                />
                <div className={cn(compactDesktop && 'lg:hidden')}>
                  <p className="font-display text-base font-semibold">Resume Scanner</p>
                  <p className="text-xs text-[var(--app-muted)]">Production Workspace</p>
                </div>
              </Link>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}
                  aria-label={compactDesktop ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
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

            <div ref={profileMenuRef} className="relative mt-auto pt-3">
              {profileMenuOpen ? (
                <div className={cn(
                  'dropdown-pop absolute bottom-[calc(100%+10px)] z-20 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4 shadow-[var(--app-shadow-md)] transition duration-200 hover:scale-[1.02]',
                  compactDesktop && 'lg:left-full lg:ml-3 lg:w-[304px]'
                )}>
                  <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
                      {userInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--app-text)]">{currentUser?.full_name || 'Name unavailable'}</p>
                      <p className="truncate text-xs text-[var(--app-muted)]">{currentUser?.email || 'Email unavailable'}</p>
                    </div>
                  </div>

                  <div className="my-2 border-t border-[var(--app-border)]" />

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setIsProfileOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]"
                  >
                    <UserIcon className="h-4 w-4" />
                    View Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <div className="my-2 border-t border-[var(--app-border)]" />
                  <button
                    type="button"
                    onClick={handleSignOutRequest}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-2 text-sm text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
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
          <main className="px-4 pb-10 pt-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      <ProfileTabsModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      <ConfirmModal
        isOpen={isSignOutConfirmOpen}
        onClose={() => setIsSignOutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Sign out?"
        message="You will be logged out from this workspace on this browser."
        confirmLabel="Sign out"
        confirmIcon={<LogOut className="h-4 w-4" />}
      />

      <AppModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
        <SettingsModalContent onClose={() => setIsSettingsOpen(false)} />
      </AppModal>
    </div>
  );
}