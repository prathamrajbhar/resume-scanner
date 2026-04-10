'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, MessageSquarePlus, PanelLeft, Settings, User as UserIcon } from 'lucide-react';
import { analyzeJobDescription, uploadResumes } from '@/lib/api';
import { AnalysisButton } from '@/components/chat/analysis-button';
import { ChatInput } from '@/components/chat/chat-input';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { FileUploadBox } from '@/components/chat/file-upload-box';
import { JobSelector } from '@/components/chat/job-selector';
import { Sidebar } from '@/components/chat/sidebar';
import { ChatWindow } from '@/components/chat/chat-window';
import { UploadedFileList } from '@/components/chat/uploaded-file-list';
import {
  CHAT_ID_STORAGE_KEY,
  CHAT_MESSAGES_STORAGE_KEY,
  CHAT_SESSIONS_STORAGE_KEY,
  CHAT_UPLOADS_STORAGE_KEY,
  clearStoredAuth,
  getStoredUser,
} from '@/lib/storage';
import { JOB_ROLE_TITLES } from '@/data/job-roles';
import { ChatLogMessage, ResumeUploadResponse, ScoringModel, User } from '@/types/resume';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { ProfileTabsModal } from '@/components/ui/profile-tabs-modal';
import { SettingsModalContent } from '@/components/ui/settings-modal-content';

type ChatSession = {
  id: string;
  title: string;
  messages: ChatLogMessage[];
  created_at: string;
  backend_chat_id?: string;
  uploads: ResumeUploadResponse[];
};

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const makeAssistantMessage = (content: string): ChatLogMessage => ({
  id: generateId(),
  role: 'assistant',
  content,
  timestamp: new Date().toISOString(),
});

const makeSystemMessage = (content: string): ChatLogMessage => ({
  id: generateId(),
  role: 'system',
  content,
  timestamp: new Date().toISOString(),
});

const makeUserMessage = (content: string): ChatLogMessage => ({
  id: generateId(),
  role: 'user',
  content,
  timestamp: new Date().toISOString(),
});

const createChatSession = (): ChatSession => ({
  id: generateId(),
  title: 'New chat',
  messages: [],
  created_at: new Date().toISOString(),
  uploads: [],
});

const deriveChatTitle = (message: string): string => {
  const normalized = message.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return 'New chat';
  }

  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
};

const normalizeIncomingFiles = (incoming: File[]) => {
  const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'txt']);
  return incoming.filter((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return allowedExtensions.has(ext);
  });
};

export default function ChatbasePage() {
  const router = useRouter();
  const composerFileInputRef = useRef<HTMLInputElement | null>(null);
  const setupFileInputRef = useRef<HTMLInputElement | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const modelType: ScoringModel = 'ensemble';
  const [sessions, setSessions] = useState<ChatSession[]>([createChatSession()]);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [hasAnalysisRun, setHasAnalysisRun] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());

    const onUserUpdated = () => setCurrentUser(getStoredUser());
    window.addEventListener('resume:user-updated', onUserUpdated);

    return () => {
      window.removeEventListener('resume:user-updated', onUserUpdated);
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const onClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Always reset to a fresh session when Chatbase opens.
    window.localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
    window.localStorage.removeItem(CHAT_UPLOADS_STORAGE_KEY);
    window.localStorage.removeItem(CHAT_ID_STORAGE_KEY);
    window.localStorage.removeItem(CHAT_SESSIONS_STORAGE_KEY);

    const fresh = createChatSession();
    setSessions([fresh]);
    setActiveChatId(fresh.id);
    setSelectedJob('');
    setSelectedFiles([]);
    setHasAnalysisRun(false);
    setInput('');
    setError(null);
    setEditingChatId(null);
  }, []);

  useEffect(() => {
    if (sessions.length === 0) {
      const seeded = [createChatSession()];
      setSessions(seeded);
      setActiveChatId(seeded[0].id);
      return;
    }

    if (!activeChatId || !sessions.some((session) => session.id === activeChatId)) {
      setActiveChatId(sessions[0].id);
    }
  }, [sessions, activeChatId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (activeChatId) {
      window.localStorage.setItem(CHAT_ID_STORAGE_KEY, activeChatId);
    } else {
      window.localStorage.removeItem(CHAT_ID_STORAGE_KEY);
    }
  }, [activeChatId]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeChatId) || sessions[0],
    [sessions, activeChatId]
  );

  const mutateActiveSession = (mutator: (session: ChatSession) => ChatSession) => {
    if (!activeSession) {
      return;
    }

    setSessions((prev) => prev.map((session) => (session.id === activeSession.id ? mutator(session) : session)));
  };

  const resetForFreshAnalysis = (newSession?: ChatSession) => {
    const next = newSession || createChatSession();
    setSessions((prev) => (newSession ? [next, ...prev] : [next]));
    setActiveChatId(next.id);
    setSelectedJob('');
    setSelectedFiles([]);
    setHasAnalysisRun(false);
    setInput('');
    setError(null);
    setEditingChatId(null);
  };

  const handleNewChat = () => {
    const next = createChatSession();
    resetForFreshAnalysis(next);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setEditingChatId(null);
    setError(null);
    setSidebarOpen(false);
    setHasAnalysisRun(true);
  };

  const handleDeleteChat = (id: string) => {
    setChatToDelete(id);
  };

  const confirmDeleteChat = () => {
    if (!chatToDelete) {
      return;
    }

    setSessions((prev) => {
      const filtered = prev.filter((session) => session.id !== chatToDelete);
      return filtered.length > 0 ? filtered : [createChatSession()];
    });

    if (activeChatId === chatToDelete) {
      setActiveChatId(undefined);
      setHasAnalysisRun(false);
      setSelectedJob('');
      setSelectedFiles([]);
    }

    setEditingChatId((prev) => (prev === chatToDelete ? null : prev));
    setChatToDelete(null);
  };

  const closeDeleteModal = () => {
    setChatToDelete(null);
  };

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingChatId(id);
    setEditTitleValue(currentTitle);
  };

  const handleCommitRename = () => {
    if (!editingChatId) {
      return;
    }

    const nextTitle = editTitleValue.trim() || 'New chat';
    setSessions((prev) =>
      prev.map((session) => (session.id === editingChatId ? { ...session, title: nextTitle } : session))
    );
    setEditingChatId(null);
  };

  const handleCancelRename = () => {
    setEditingChatId(null);
    setEditTitleValue('');
  };

  const addSetupFiles = (incoming: File[]) => {
    const normalized = normalizeIncomingFiles(incoming);
    if (normalized.length === 0) {
      return;
    }

    setSelectedFiles((prev) => {
      const known = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const unique = normalized.filter((file) => !known.has(`${file.name}-${file.size}-${file.lastModified}`));
      return [...prev, ...unique];
    });
  };

  const handleSetupFileBrowse = () => {
    setupFileInputRef.current?.click();
  };

  const handleSetupFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    addSetupFiles(files);

    if (setupFileInputRef.current) {
      setupFileInputRef.current.value = '';
    }
  };

  const handleRemoveSetupFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAttachClick = () => {
    composerFileInputRef.current?.click();
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !activeSession) {
      return;
    }

    const allowed = normalizeIncomingFiles(files);
    if (allowed.length === 0) {
      return;
    }

    setUploading(true);
    setError(null);
    mutateActiveSession((session) => ({
      ...session,
      messages: [...session.messages, makeSystemMessage(`Uploading ${allowed.length} file(s)...`)],
    }));

    try {
      const uploaded = await uploadResumes(allowed);
      const names = uploaded.map((item) => item.name).join(', ');

      mutateActiveSession((session) => ({
        ...session,
        uploads: [...uploaded, ...session.uploads],
        messages: [...session.messages, makeSystemMessage(`Uploaded ${uploaded.length} resume(s): ${names}`)],
      }));
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Upload failed.';
      setError(messageText);
      mutateActiveSession((session) => ({
        ...session,
        messages: [...session.messages, makeAssistantMessage(`Upload error: ${messageText}`)],
      }));
    } finally {
      setUploading(false);
      if (composerFileInputRef.current) {
        composerFileInputRef.current.value = '';
      }
    }
  };

  const runResumeAnalysis = async () => {
    if (!activeSession || !selectedJob || selectedFiles.length === 0) {
      return;
    }

    setHasAnalysisRun(true);
    setError(null);
    setSending(true);
    setUploading(true);

    mutateActiveSession((session) => ({
      ...session,
      title: selectedJob,
      messages: [
        ...session.messages,
        makeSystemMessage(`Analyzing resumes for role: ${selectedJob}...`),
      ],
    }));

    try {
      const uploaded = await uploadResumes(selectedFiles);
      const uploadedNames = uploaded.map((item) => item.name).join(', ');

      mutateActiveSession((session) => ({
        ...session,
        uploads: [...uploaded, ...session.uploads],
        messages: [
          ...session.messages,
          makeSystemMessage(`Uploaded ${uploaded.length} resume(s): ${uploadedNames}`),
        ],
      }));

      setUploading(false);

      const analysisPrompt = `Target job role: ${selectedJob}. Please analyze the uploaded resumes, rank candidates from best to least fit, summarize strengths and gaps for each candidate, and provide a recommended shortlist.`;

      mutateActiveSession((session) => ({
        ...session,
        messages: [...session.messages, makeUserMessage(analysisPrompt)],
      }));

      const response = await analyzeJobDescription({
        message: analysisPrompt,
        chat_id: activeSession.backend_chat_id,
        model_type: modelType,
      });

      mutateActiveSession((session) => {
        const nextMessages = [...session.messages, makeAssistantMessage(response.message)];

        if (response.candidates.length > 0) {
          const topList = response.candidates
            .slice(0, 5)
            .map((candidate, index) => `${index + 1}. ${candidate.full_name} (${Math.round(candidate.score)})`)
            .join('\n');
          nextMessages.push(makeAssistantMessage(`Top candidates:\n${topList}`));
        }

        return {
          ...session,
          backend_chat_id: response.chat_id,
          messages: nextMessages,
        };
      });

      setSelectedFiles([]);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Analysis failed.';
      setError(messageText);
      mutateActiveSession((session) => ({
        ...session,
        messages: [...session.messages, makeAssistantMessage(`Analysis error: ${messageText}`)],
      }));
    } finally {
      setUploading(false);
      setSending(false);
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();

    if (!message || !activeSession) {
      return;
    }

    setInput('');
    setError(null);

    const shouldRetitle = activeSession.title === 'New chat';
    mutateActiveSession((session) => ({
      ...session,
      title: shouldRetitle ? deriveChatTitle(message) : session.title,
      messages: [...session.messages, makeUserMessage(message)],
    }));

    setSending(true);
    try {
      const response = await analyzeJobDescription({
        message,
        chat_id: activeSession.backend_chat_id,
        model_type: modelType,
      });

      mutateActiveSession((session) => {
        const nextMessages = [...session.messages, makeAssistantMessage(response.message)];

        if (response.candidates.length > 0) {
          const topList = response.candidates
            .slice(0, 5)
            .map((candidate, index) => `${index + 1}. ${candidate.full_name} (${Math.round(candidate.score)})`)
            .join('\n');
          nextMessages.push(makeAssistantMessage(`Top candidates:\n${topList}`));
        }

        return {
          ...session,
          backend_chat_id: response.chat_id,
          messages: nextMessages,
        };
      });
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Analysis failed.';
      setError(messageText);
      mutateActiveSession((session) => ({
        ...session,
        messages: [...session.messages, makeAssistantMessage(`Analysis error: ${messageText}`)],
      }));
    } finally {
      setSending(false);
    }
  };

  const chatsForSidebar = useMemo(
    () => sessions.map((session) => ({ id: session.id, title: session.title })),
    [sessions]
  );

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

  const canRunAnalysis = selectedJob.trim().length > 0 && selectedFiles.length > 0 && !sending && !uploading;

  const handleLogout = () => {
    clearStoredAuth();
    setAccountMenuOpen(false);
    router.push('/login');
  };

  const handleSignOutRequest = () => {
    setAccountMenuOpen(false);
    setIsSignOutConfirmOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-[var(--app-bg)]">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col items-center border-r border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-3">
        <button type="button" onClick={() => router.push('/')} className="mb-3 rounded-xl p-1 transition hover:bg-[var(--app-surface-soft)]" aria-label="Go to dashboard">
          <Image src="/assets/logo-icon.png" width={28} height={28} alt="AI HR Copilot logo" className="h-7 w-7 rounded" priority />
        </button>
        <Button type="button" variant="ghost" size="icon" onClick={() => setSidebarOpen((prev) => !prev)} aria-label="Open sidebar" className="mb-2 rounded-xl">
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={handleNewChat} aria-label="New chat" className="mb-2 rounded-xl">
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => router.push('/')} aria-label="Back to dashboard" className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div ref={accountMenuRef} className="relative mt-auto">
          {accountMenuOpen ? (
            <div className="dropdown-pop absolute bottom-[calc(100%+10px)] left-0 w-[304px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4 shadow-[var(--app-shadow-md)] transition duration-200 hover:scale-[1.02]">
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

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
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
                    setAccountMenuOpen(false);
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
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setAccountMenuOpen((prev) => !prev)}
            className="rounded-full p-1 transition hover:bg-[var(--app-surface-soft)]"
            aria-label="Open account menu"
          >
            <Avatar className="h-10 w-10">
              {currentUser?.avatar_url ? <AvatarImage src={currentUser.avatar_url} alt={currentUser.full_name || 'User'} /> : null}
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
          </button>
        </div>
      </aside>

      <Sidebar
        open={sidebarOpen}
        chats={chatsForSidebar}
        activeChatId={activeSession?.id}
        editingChatId={editingChatId}
        editTitleValue={editTitleValue}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onStartRename={handleStartRename}
        onEditTitleChange={setEditTitleValue}
        onCommitRename={handleCommitRename}
        onCancelRename={handleCancelRename}
        onDeleteChat={handleDeleteChat}
      />

      <ConfirmModal
        isOpen={Boolean(chatToDelete)}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteChat}
        title="Delete chat?"
        message="This action cannot be undone."
      />

      <ConfirmModal
        isOpen={isSignOutConfirmOpen}
        onClose={() => setIsSignOutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Sign out?"
        message="You will be logged out from this workspace on this browser."
        confirmLabel="Sign out"
        confirmIcon={<LogOut className="h-4 w-4" />}
      />

      <ProfileTabsModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      <AppModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
        <SettingsModalContent onClose={() => setIsSettingsOpen(false)} />
      </AppModal>

      <div className={`flex min-h-screen flex-col pl-[72px] transition-all duration-300 ${sidebarOpen ? 'lg:pl-[332px]' : ''}`}>
        {error ? (
          <div className="mx-auto mt-3 w-full max-w-3xl px-4">
            <p className="rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">{error}</p>
          </div>
        ) : null}

        {!hasAnalysisRun ? (
          <div className="mx-auto mt-8 w-full max-w-3xl px-4 pb-10">
            <div className="surface-panel rounded-3xl p-6 sm:p-7">
              <div className="space-y-5">
                <JobSelector selectedJob={selectedJob} roles={[...JOB_ROLE_TITLES]} onChange={setSelectedJob} />

                <input
                  ref={setupFileInputRef}
                  type="file"
                  aria-label="Upload resumes"
                  title="Upload resumes"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={handleSetupFilesSelected}
                />

                <FileUploadBox
                  onBrowse={handleSetupFileBrowse}
                  onDropFiles={addSetupFiles}
                  disabled={sending || uploading}
                />

                <UploadedFileList files={selectedFiles} onRemove={handleRemoveSetupFile} />

                <AnalysisButton
                  disabled={!canRunAnalysis}
                  loading={sending || uploading}
                  onClick={runResumeAnalysis}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <ChatWindow messages={activeSession?.messages || []} />

            <ChatInput
              input={input}
              sending={sending}
              uploading={uploading}
              uploadedResumes={activeSession?.uploads || []}
              fileInputRef={composerFileInputRef}
              onInputChange={setInput}
              onSubmit={handleSend}
              onAttachClick={handleAttachClick}
              onFilesSelected={handleFilesSelected}
            />
          </>
        )}
      </div>
    </div>
  );
}
