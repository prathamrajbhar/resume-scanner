'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearStoredAuth, clearStoredChats, getStoredUser, setStoredUser } from '@/lib/storage';
import { User } from '@/types/resume';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

type ProfileModalContentProps = {
  onClose?: () => void;
};

export function ProfileModalContent({ onClose }: ProfileModalContentProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);
    setName(storedUser?.full_name || '');
    setEmail(storedUser?.email || '');

    const onUserUpdated = () => {
      const nextUser = getStoredUser();
      setUser(nextUser);
      setName(nextUser?.full_name || '');
      setEmail(nextUser?.email || '');
    };
    window.addEventListener('resume:user-updated', onUserUpdated);

    return () => {
      window.removeEventListener('resume:user-updated', onUserUpdated);
    };
  }, []);

  const initials = useMemo(() => {
    if (!name.trim()) {
      return 'HR';
    }

    return name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [name]);

  const handleSave = (event: FormEvent) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    const nextName = name.trim();
    const nextEmail = email.trim();

    if (!nextName || !nextEmail) {
      setStatus('Name and email are required.');
      return;
    }

    const confirmed = window.confirm('Save profile changes?');
    if (!confirmed) {
      return;
    }

    const nextUser: User = {
      ...user,
      full_name: nextName,
      email: nextEmail,
    };

    setStoredUser(nextUser);
    setUser(nextUser);
    setStatus('Profile updated successfully.');
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm('Delete account and clear all local data? This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    clearStoredChats();
    clearStoredAuth();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('temp_dashboard_access');
    }
    onClose?.();
    router.replace('/login');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14">
            {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.full_name || 'User'} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{name || 'Name unavailable'}</p>
            <p className="truncate text-sm text-gray-600">{email || 'Email unavailable'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Account</p>
        <div className="space-y-2">
          <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800"
            placeholder="Enter your name"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800"
            placeholder="Enter your email"
          />
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">User ID</p>
          <p className="mt-1 break-all text-sm text-gray-700">{user?.id || 'Unavailable'}</p>
        </div>

        {status ? <p className="text-sm text-gray-600">{status}</p> : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="destructive" onClick={handleDeleteAccount}>
            Delete account
          </Button>
          <div className="flex items-center gap-2">
            {onClose ? (
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
            ) : null}
            <Button type="submit">Save</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
