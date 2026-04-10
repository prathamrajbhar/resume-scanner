'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import {
  applyStoredTheme,
  clearStoredAuth,
  clearStoredChats,
  defaultSettings,
  getStoredUser,
  setStoredSettings,
} from '@/lib/storage';

type ProfileTab = 'account' | 'memory';

type ProfileTabsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ProfileTabsModal({ isOpen, onClose }: ProfileTabsModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [isDeleteAccountConfirmOpen, setIsDeleteAccountConfirmOpen] = useState(false);

  const user = getStoredUser();
  const name = user?.full_name || 'Name unavailable';
  const email = user?.email || 'Email unavailable';

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

  const confirmDeleteAccount = () => {
    clearStoredChats();
    clearStoredAuth();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('temp_dashboard_access');
    }

    setIsDeleteAccountConfirmOpen(false);
    onClose();
    router.replace('/login');
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

                <div className="space-y-1">
                  <div className="flex justify-between items-center border-b border-gray-200 py-3">
                    <span className="text-sm text-gray-500">Name</span>
                    <span className="text-sm text-gray-800">{name}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 py-3">
                    <span className="text-sm text-gray-500">Email</span>
                    <span className="text-sm text-gray-800">{email}</span>
                  </div>
                </div>

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
