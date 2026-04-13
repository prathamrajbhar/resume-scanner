'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { useTopToast } from '@/components/ui/top-toast';
import { deleteAccount, updateProfile } from '@/lib/api';
import {
  applyStoredTheme,
  clearStoredAuth,
  clearStoredChats,
  setProfileSetupRequired,
  defaultSettings,
  getStoredUser,
  setStoredUser,
  setStoredSettings,
} from '@/lib/storage';

type ProfileTab = 'account' | 'memory';

type ProfileTabsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ProfileTabsModal({ isOpen, onClose }: ProfileTabsModalProps) {
  const router = useRouter();
  const { showToast } = useTopToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [isDeleteAccountConfirmOpen, setIsDeleteAccountConfirmOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const user = getStoredUser();
  const email = user?.email || 'Email unavailable';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(user?.full_name || '');
    setStatus(null);
  }, [isOpen, user?.full_name]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('account');
      setIsDeleteAccountConfirmOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSaveName = async () => {
    const nextName = name.trim();

    if (!nextName) {
      setStatus('Name is required.');
      return;
    }

    if (!user) {
      setStatus('Unable to update profile right now.');
      return;
    }

    try {
      setStatus(null);
      const isFirstTimeProfileSetup = !user.full_name || user.full_name.trim().length === 0;
      
      // Call API to save name to database
      const updatedUser = await updateProfile(nextName);
      
      // Update localStorage with the database response
      setStoredUser(updatedUser);
      setProfileSetupRequired(false);

      if (isFirstTimeProfileSetup) {
        showToast({
          message: `Welcome ${nextName} to HR Copilot`,
          tone: 'welcome',
          durationMs: 3600,
        });
        onClose();
        return;
      }

      setStatus('Name updated successfully.');
      showToast({
        message: `Profile updated for ${nextName}`,
        tone: 'success',
        durationMs: 2200,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to update profile.');
    }
  };

  const confirmDeleteAccount = async () => {
    if (isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);
    setStatus(null);

    try {
      await deleteAccount();
      clearStoredChats();
      clearStoredAuth();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('temp_dashboard_access');
      }

      setIsDeleteAccountConfirmOpen(false);
      onClose();
      router.replace('/login');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to delete account. Please try again.');
      setIsDeleteAccountConfirmOpen(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleClearChatHistory = () => {
    const confirmed = window.confirm('Delete all previous chats and analysis data?');
    if (!confirmed) {
      return;
    }

    clearStoredChats();
  };

  const handleResetAiMemory = () => {
    const confirmed = window.confirm('Clear saved preferences and interactions?');
    if (!confirmed) {
      return;
    }

    clearStoredChats();
    setStoredSettings(defaultSettings);
    applyStoredTheme();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-[700px] h-[500px] bg-white text-gray-900 rounded-2xl shadow-xl border border-gray-200 flex overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
          aria-label="Close profile"
        >
          <X className="h-6 w-6" />
        </button>

        <aside className="w-48 bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 shadow-inner p-4 pt-6">
          <h2 className="text-gray-800 font-semibold mb-4 px-2">Profile</h2>
          <div className="flex flex-col gap-2 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`w-full text-left cursor-pointer ${
                activeTab === 'account'
                  ? 'bg-blue-600 text-white shadow-sm rounded-lg px-4 py-2'
                  : 'text-gray-600 hover:bg-gray-200 transition rounded-lg px-4 py-2'
              }`}
            >
              Account
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={`w-full text-left cursor-pointer ${
                activeTab === 'memory'
                  ? 'bg-blue-600 text-white shadow-sm rounded-lg px-4 py-2'
                  : 'text-gray-600 hover:bg-gray-200 transition rounded-lg px-4 py-2'
              }`}
            >
              Memory
            </button>
          </div>
        </aside>

        <section className="flex-1 p-6 bg-white pt-16">
          <div className="relative h-full">
            <div
              className={`absolute inset-0 overflow-y-auto transition-opacity duration-200 ${
                activeTab === 'account' ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">Account</h3>

                <div className="grid grid-cols-[120px_1fr] items-center gap-x-6 gap-y-4">
                  <label htmlFor="profile-name" className="text-gray-600 text-sm">
                    Name
                  </label>
                  <input
                    id="profile-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500"
                    placeholder="Firstname lastname like vice"
                  />

                  <label className="text-gray-600 text-sm">Email</label>
                  <p className="text-gray-800 text-sm">{email}</p>

                  <div />
                  <div className="col-start-2">
                    <button
                      type="button"
                      onClick={handleSaveName}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Save name
                    </button>
                  </div>
                </div>

                {status ? <p className="text-sm text-gray-600">{status}</p> : null}

                <div>
                  <p className="text-lg font-medium text-gray-900">Delete account</p>
                  <p className="mt-1 text-sm text-gray-500">Permanently remove your account and local app data.</p>
                  <button
                    type="button"
                    onClick={() => setIsDeleteAccountConfirmOpen(true)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 mt-3"
                  >
                    Delete account
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`absolute inset-0 overflow-y-auto transition-opacity duration-200 ${
                activeTab === 'memory' ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">Memory</h3>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-base font-medium text-gray-900">Clear Chat History</p>
                  <p className="mt-1 text-sm text-gray-500">Delete all previous chats and analysis data</p>
                  <button
                    type="button"
                    onClick={handleClearChatHistory}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg mt-3"
                  >
                    Clear chat history
                  </button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-base font-medium text-gray-900">Reset AI Memory</p>
                  <p className="mt-1 text-sm text-gray-500">Clear saved preferences and interactions</p>
                  <button
                    type="button"
                    onClick={handleResetAiMemory}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg mt-3"
                  >
                    Reset AI memory
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={isDeleteAccountConfirmOpen}
        onClose={() => setIsDeleteAccountConfirmOpen(false)}
        onConfirm={confirmDeleteAccount}
        title="Delete account?"
        message="Delete account and all local data? This action cannot be undone."
        confirmLabel="Delete account"
        confirmIcon={<Trash2 className="h-4 w-4" />}
      />
    </div>
  );
}
