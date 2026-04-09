'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, MoonStar, Trash2 } from 'lucide-react';
import {
  applyStoredTheme,
  clearStoredAuth,
  clearStoredChats,
  defaultSettings,
  getStoredSettings,
  getStoredUser,
  setStoredSettings,
} from '@/lib/storage';
import { AppSettings, AppTheme } from '@/types/resume';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const themes: AppTheme[] = ['light', 'dark', 'system'];

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setSettings(getStoredSettings());

    const user = getStoredUser();
    setEmail(user?.email || '');
    setFullName(user?.full_name || '');
  }, []);

  const handleSavePreferences = (event: FormEvent) => {
    event.preventDefault();
    setStoredSettings(settings);
    applyStoredTheme();
    setError(null);
    setStatus('Preferences saved.');
  };

  const handleDeleteAllChats = () => {
    const confirmed = window.confirm('Delete all chat history and uploaded chat session files?');
    if (!confirmed) {
      return;
    }

    clearStoredChats();
    setError(null);
    setStatus('All chats deleted.');
  };

  const handleSignOut = () => {
    clearStoredAuth();
    router.replace('/login');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Settings</CardTitle>
          <CardDescription>Control theme, notifications, account actions, and local data management.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePreferences} className="space-y-5">
            <div>
              <label htmlFor="theme" className="mb-2 flex items-center gap-2 text-sm font-medium">
                <MoonStar className="h-4 w-4" />
                Theme
              </label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    theme: event.target.value as AppTheme,
                  }))
                }
                className="h-10 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm"
              >
                {themes.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4" />Notifications</p>
              <div className="space-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--app-muted)]">Candidate ranking alerts</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.candidateAlerts}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          candidateAlerts: event.target.checked,
                        },
                      }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--app-muted)]">Chat summary updates</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.chatSummaries}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          chatSummaries: event.target.checked,
                        },
                      }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--app-muted)]">Product update notices</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.productUpdates}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          productUpdates: event.target.checked,
                        },
                      }))
                    }
                  />
                </label>
              </div>
            </div>

            <Button type="submit">Save preferences</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signed In User</CardTitle>
          <CardDescription>Current authenticated recruiter context.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--app-subtle)]">Name</p>
            <p className="mt-1 text-sm font-medium text-[var(--app-text)]">{fullName || 'Not available'}</p>
          </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--app-subtle)]">Email</p>
            <p className="mt-1 text-sm font-medium text-[var(--app-text)]">{email || 'Not available'}</p>
          </div>
        </div>
          <p className="text-sm text-[var(--app-muted)]">This app uses Google Sign-In only. Profile fields are managed by Google.</p>
          <Separator />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <a href="https://myaccount.google.com/" target="_blank" rel="noreferrer">
                Manage Google Account
              </a>
            </Button>
            <Button type="button" variant="destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[var(--app-danger-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--app-danger)]">Delete Local Chat History</CardTitle>
          <CardDescription>This clears all chat messages and upload metadata in this browser only.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" onClick={handleDeleteAllChats}>
            <Trash2 className="h-4 w-4" />
            Delete all chats
          </Button>
        </CardContent>
      </Card>

      {status ? (
        <p className="rounded-md border border-[var(--app-border)] bg-[var(--app-success-bg)] p-3 text-sm text-[var(--app-success-text)]">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
