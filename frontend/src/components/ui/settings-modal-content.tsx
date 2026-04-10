'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  applyStoredTheme,
  clearStoredAuth,
  clearStoredChats,
  defaultSettings,
  getStoredSettings,
  setStoredSettings,
} from '@/lib/storage';
import { AppSettings, AppTheme } from '@/types/resume';
import { Button } from '@/components/ui/button';

const themes: AppTheme[] = ['light', 'dark', 'system'];

type SettingsModalContentProps = {
  onClose: () => void;
};

export function SettingsModalContent({ onClose }: SettingsModalContentProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setSettings(getStoredSettings());
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const confirmed = window.confirm('Save settings changes?');
    if (!confirmed) {
      return;
    }

    setStoredSettings(settings);
    applyStoredTheme();
    setStatus('Settings saved.');
  };

  const handleDeleteChats = () => {
    const confirmed = window.confirm('Delete all chat memory?');
    if (!confirmed) {
      return;
    }

    clearStoredChats();
    setStatus('Chat memory deleted.');
  };

  const handleDeleteData = () => {
    const confirmed = window.confirm('Delete all local data and sign out? This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    clearStoredChats();
    clearStoredAuth();
    setStoredSettings(defaultSettings);
    applyStoredTheme();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('temp_dashboard_access');
    }
    onClose();
    router.replace('/login');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="modal-theme" className="mb-2 block text-sm font-medium text-gray-700">
          Theme
        </label>
        <select
          id="modal-theme"
          value={settings.theme}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              theme: event.target.value as AppTheme,
            }))
          }
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"
        >
          {themes.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Notifications</p>
        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
            Candidate ranking alerts
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
          <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
            Chat summary updates
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
          <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
            Product update notices
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

      <div className="flex justify-end">
        <Button type="submit">Save</Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Memory</p>
        <p className="text-sm text-gray-600">Manage local chat and app data stored in this browser.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handleDeleteChats}>
            Delete chat memory
          </Button>
          <Button type="button" variant="destructive" onClick={handleDeleteData}>
            Delete all local data
          </Button>
        </div>
      </div>

      {status ? <p className="text-sm text-gray-600">{status}</p> : null}
    </form>
  );
}
