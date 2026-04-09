'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, IdCard, ShieldCheck } from 'lucide-react';
import { getStoredUser } from '@/lib/storage';
import { User } from '@/types/resume';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const initials = useMemo(() => {
    if (!user?.full_name) {
      return 'HR';
    }

    return user.full_name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <Badge className="w-fit">Account</Badge>
          <CardTitle className="text-3xl">Profile</CardTitle>
          <CardDescription>Authenticated recruiter identity used across this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
            <Avatar className="h-14 w-14">
              {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.full_name || 'User'} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{user?.full_name || 'Name unavailable'}</p>
              <p className="text-sm text-[var(--app-muted)]">{user?.email || 'Email unavailable'}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--app-subtle)]"><IdCard className="h-3.5 w-3.5" />User ID</p>
              <p className="break-all text-sm">{user?.id || 'Unavailable'}</p>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--app-subtle)]"><ShieldCheck className="h-3.5 w-3.5" />Auth provider</p>
              <p className="text-sm">Google OAuth</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/settings">Open Settings</Link>
            </Button>
            <Button asChild variant="secondary">
              <a href="https://myaccount.google.com/" target="_blank" rel="noreferrer">
                Manage Google Account
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
