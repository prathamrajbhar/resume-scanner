'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Mail, MessageSquarePlus, PanelLeft, Rocket, Settings, User as UserIcon } from 'lucide-react';
import { getCandidates, getJobById, runAnalysisForResumes, shortlistCandidate, uploadResumes } from '@/lib/api';
import { CandidateDetailData, CandidateDetailModal } from '@/components/analyze/CandidateDetailModal';
import { AnalysisButton } from '@/components/chat/analysis-button';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { FileUploadBox } from '@/components/chat/file-upload-box';
import { JobSelector } from '@/components/chat/job-selector';
import { Sidebar } from '@/components/chat/sidebar';
import { UploadedFileList } from '@/components/chat/uploaded-file-list';
import {
  CHAT_ID_STORAGE_KEY,
  CHAT_SESSIONS_STORAGE_KEY,
  clearStoredAuth,
  getStoredUser,
} from '@/lib/storage';
import { ResumeUploadResponse, ScoringModel, User } from '@/types/resume';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { ProfileTabsModal } from '@/components/ui/profile-tabs-modal';
import { SettingsModalContent } from '@/components/ui/settings-modal-content';
import { useJobs } from '@/lib/hooks';

type ResultCard = {
  rank: number;
  candidate_name: string;
  match_score: number;
  top_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  skills_with_percentage: { skill: string; percentage: number; is_na?: boolean }[];
  required_skills: { skill: string; level?: string }[];
  candidate_id?: string;
  candidate_email?: string;
  is_shortlisted?: boolean;
  shortlisted_type?: 'select' | 'final_select' | null;
};

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  backend_chat_id?: string;
  uploads: ResumeUploadResponse[];
  selected_job_id: string;
  selected_job: string;
  has_run: boolean;
  results: ResultCard[];
};

type PendingSelection = {
  candidate: ResultCard;
  selectionType: 'select' | 'final_select';
};

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createChatSession = (): ChatSession => ({
  id: generateId(),
  title: 'New chat',
  created_at: new Date().toISOString(),
  uploads: [],
  selected_job_id: '',
  selected_job: '',
  has_run: false,
  results: [],
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

const parseLegacyResultsFromMessages = (messages: unknown): ResultCard[] => {
  if (!Array.isArray(messages)) {
    return [];
  }

  const assistantWithList = [...messages]
    .reverse()
    .find(
      (msg: any) =>
        typeof msg?.content === 'string' &&
        msg.content.toLowerCase().includes('top candidates:')
    ) as { content?: string } | undefined;

  if (!assistantWithList?.content) {
    return [];
  }

  const lines = assistantWithList.content.split('\n');
  const parsed = lines
    .map((line) => {
      const match = line.match(/^\s*(\d+)\.\s+(.+?)\s+\((\d+)%\)\s*$/);
      if (!match) {
        return null;
      }

      const rank = Number(match[1]);
      const candidateName = match[2]?.trim() || 'Unknown candidate';
      const score = Number(match[3]);

      if (!Number.isFinite(rank) || !Number.isFinite(score)) {
        return null;
      }

      return {
        rank,
        candidate_name: candidateName,
        match_score: score,
        top_skills: [],
        matched_skills: [],
        missing_skills: [],
        skills_with_percentage: [],
        required_skills: [],
        is_shortlisted: false,
        shortlisted_type: null,
      } as ResultCard;
    })
    .filter((item): item is ResultCard => item !== null);

  return parsed;
};

const hydrateSessions = (raw: unknown): ChatSession[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item: any) => {
      const resultsFromNewShape = Array.isArray(item?.results)
        ? item.results
            .map((result: any, index: number) => ({
              rank: Number(result?.rank) || index + 1,
              candidate_name: String(result?.candidate_name || 'Unknown candidate'),
              match_score: Number(result?.match_score ?? 0),
              top_skills: Array.isArray(result?.top_skills)
                ? result.top_skills.filter((skill: unknown) => typeof skill === 'string')
                : [],
              matched_skills: Array.isArray(result?.matched_skills)
                ? result.matched_skills.filter((skill: unknown) => typeof skill === 'string')
                : [],
              missing_skills: Array.isArray(result?.missing_skills)
                ? result.missing_skills.filter((skill: unknown) => typeof skill === 'string')
                : [],
              skills_with_percentage: Array.isArray(result?.skills_with_percentage)
                ? result.skills_with_percentage
                    .map((entry: any) => ({
                      skill: String(entry?.skill || ''),
                      percentage: Number(entry?.percentage ?? 0),
                      is_na: Boolean(entry?.is_na),
                    }))
                    .filter((entry: { skill: string; percentage: number }) => Boolean(entry.skill))
                : [],
              required_skills: Array.isArray(result?.required_skills)
                ? result.required_skills
                    .map((entry: any) => ({
                      skill: String(entry?.skill || ''),
                      level: typeof entry?.level === 'string' ? entry.level : undefined,
                    }))
                    .filter((entry: { skill: string; level?: string }) => Boolean(entry.skill))
                : [],
              candidate_id: typeof result?.candidate_id === 'string' ? result.candidate_id : undefined,
              candidate_email: typeof result?.candidate_email === 'string' ? result.candidate_email : undefined,
              is_shortlisted: Boolean(result?.is_shortlisted),
              shortlisted_type:
                result?.shortlisted_type === 'final_select' || result?.shortlisted_type === 'select'
                  ? result.shortlisted_type
                  : null,
            }))
            .filter((result: ResultCard) => Number.isFinite(result.match_score))
        : [];

      const resultsFromLegacyMessages =
        resultsFromNewShape.length > 0 ? [] : parseLegacyResultsFromMessages(item?.messages);

      const mergedResults = resultsFromNewShape.length > 0 ? resultsFromNewShape : resultsFromLegacyMessages;

      return {
        id: typeof item?.id === 'string' ? item.id : generateId(),
        title: typeof item?.title === 'string' ? item.title : 'New chat',
        created_at:
          typeof item?.created_at === 'string' ? item.created_at : new Date().toISOString(),
        backend_chat_id:
          typeof item?.backend_chat_id === 'string' ? item.backend_chat_id : undefined,
        uploads: Array.isArray(item?.uploads)
          ? item.uploads
              .map((upload: any) => ({
                id: String(upload?.id || generateId()),
                name: String(upload?.name || upload?.filename || 'Resume'),
                filename: String(upload?.filename || upload?.name || 'resume.pdf'),
                drive_id: String(upload?.drive_id || ''),
              }))
              .filter((upload: ResumeUploadResponse) => Boolean(upload.id && upload.name))
          : [],
        selected_job_id: typeof item?.selected_job_id === 'string' ? item.selected_job_id : '',
        selected_job: typeof item?.selected_job === 'string' ? item.selected_job : '',
        has_run:
          typeof item?.has_run === 'boolean'
            ? item.has_run
            : mergedResults.length > 0,
        results: mergedResults,
      } satisfies ChatSession;
    })
    .filter((session: ChatSession) => Boolean(session.id));
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeSkillToken = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const aliasMap: Record<string, string> = {
    'excel': 'microsoft excel',
    'ms excel': 'microsoft excel',
    'word': 'microsoft word',
    'ms word': 'microsoft word',
    'powerpoint': 'microsoft powerpoint',
    'ms powerpoint': 'microsoft powerpoint',
    'communication skills': 'communication',
    'problem solving': 'problem solving',
    'problem-solving': 'problem solving',
    'cybersecurity protocols': 'cybersecurity',
  };

  return aliasMap[normalized] || normalized;
};

export default function ChatbasePage() {
  const router = useRouter();
  const setupFileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: jobs = [] } = useJobs();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const modelType: ScoringModel = 'ensemble';
  const [sessions, setSessions] = useState<ChatSession[]>([createChatSession()]);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadMetrics, setUploadMetrics] = useState({
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    phase: 'idle' as 'idle' | 'uploading' | 'processing' | 'completed' | 'failed',
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetailData | null>(null);
  const [liveCandidateIds, setLiveCandidateIds] = useState<string[]>([]);
  const [liveCandidateIdByName, setLiveCandidateIdByName] = useState<Record<string, string>>({});
  const [liveCandidateEmailById, setLiveCandidateEmailById] = useState<Record<string, string>>({});
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [sendSelectionEmail, setSendSelectionEmail] = useState(true);
  const [selectionSubmitting, setSelectionSubmitting] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const liveJobs = useMemo(
    () => jobs.map((job: any) => ({ id: String(job.id), title: String(job.title) })),
    [jobs]
  );
  const selectedJobConfig = useMemo(
    () => jobs.find((job: any) => String(job.id) === selectedJobId),
    [jobs, selectedJobId]
  );
  const selectedJobTitle = selectedJobConfig?.title || '';

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

    try {
      const rawSessions = window.localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
      const rawActiveId = window.localStorage.getItem(CHAT_ID_STORAGE_KEY);

      if (rawSessions) {
        const parsedSessions = hydrateSessions(JSON.parse(rawSessions));

        if (Array.isArray(parsedSessions) && parsedSessions.length > 0) {
          const existingFresh = parsedSessions.find(
            (session) =>
              session.title === 'New chat' &&
              !session.has_run &&
              (!session.uploads || session.uploads.length === 0)
          );

          if (existingFresh) {
            setSessions(parsedSessions);
            setActiveChatId(existingFresh.id);
            setSelectedJobId(existingFresh.selected_job_id || '');
          } else {
            const fresh = createChatSession();
            setSessions([fresh, ...parsedSessions]);
            setActiveChatId(fresh.id);
            setSelectedJobId('');
          }

          if (rawActiveId && parsedSessions.some((session) => session.id === rawActiveId)) {
            const previouslyActive = parsedSessions.find((session) => session.id === rawActiveId);
            if (previouslyActive && existingFresh) {
              setSelectedJobId(previouslyActive.selected_job_id || '');
            }
          }

          setError(null);
          setEditingChatId(null);
          setStorageReady(true);
          return;
        }
      }
    } catch {
      // Fall back to fresh state if stored chat data is malformed.
    }

    const fresh = createChatSession();
    setSessions([fresh]);
    setActiveChatId(fresh.id);
    setSelectedJobId('');
    setSelectedFiles([]);
    setUploadMetrics({ total: 0, processed: 0, success: 0, failed: 0, phase: 'idle' });
    setStatusMessage(null);
    setError(null);
    setEditingChatId(null);
    setStorageReady(true);
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
    if (typeof window === 'undefined' || !storageReady) {
      return;
    }

    window.localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions, storageReady]);

  useEffect(() => {
    if (typeof window === 'undefined' || !storageReady) {
      return;
    }

    if (activeChatId) {
      window.localStorage.setItem(CHAT_ID_STORAGE_KEY, activeChatId);
    } else {
      window.localStorage.removeItem(CHAT_ID_STORAGE_KEY);
    }
  }, [activeChatId, storageReady]);

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
    setSelectedJobId('');
    setSelectedFiles([]);
    setUploadMetrics({ total: 0, processed: 0, success: 0, failed: 0, phase: 'idle' });
    setShowAllCandidates(false);
    setIsDetailModalOpen(false);
    setSelectedCandidate(null);
    setStatusMessage(null);
    setError(null);
    setEditingChatId(null);
  };

  const handleNewChat = () => {
    const next = createChatSession();
    resetForFreshAnalysis(next);
  };

  const handleSelectChat = (id: string) => {
    const selected = sessions.find((session) => session.id === id);
    setActiveChatId(id);
    setEditingChatId(null);
    setError(null);
    setSidebarOpen(false);
    setSelectedJobId(selected?.selected_job_id || '');
    setSelectedFiles([]);
    setUploadMetrics({ total: 0, processed: 0, success: 0, failed: 0, phase: 'idle' });
    setShowAllCandidates(false);
    setIsDetailModalOpen(false);
    setSelectedCandidate(null);
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
      setSelectedJobId('');
      setSelectedFiles([]);
      setUploadMetrics({ total: 0, processed: 0, success: 0, failed: 0, phase: 'idle' });
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

  const handleClearAllSetupFiles = () => {
    setSelectedFiles([]);
    setUploadMetrics({ total: 0, processed: 0, success: 0, failed: 0, phase: 'idle' });
  };

  const runResumeAnalysis = async () => {
    if (!activeSession || !selectedJobId || selectedFiles.length === 0) {
      return;
    }

    setShowAllCandidates(false);
    setError(null);
    setSending(true);
    setUploading(true);
    setUploadMetrics({
      total: selectedFiles.length,
      processed: 0,
      success: 0,
      failed: 0,
      phase: 'uploading',
    });
    setStatusMessage('Analyzing resumes...');

    const optimisticTitle = selectedJobTitle || selectedJobConfig?.title || 'Selected role';

    mutateActiveSession((session) => ({
      ...session,
      title: optimisticTitle,
      selected_job_id: selectedJobId,
      selected_job: optimisticTitle,
      has_run: true,
      results: [],
    }));

    try {
      const uploaded = await uploadResumes(selectedFiles, {
        onProgress: (completed, total) => {
          setUploadMetrics({
            total,
            processed: completed,
            success: completed,
            failed: Math.max(0, total - completed),
            phase: 'uploading',
          });
        },
      });

      mutateActiveSession((session) => ({
        ...session,
        uploads: [...uploaded, ...session.uploads],
      }));

      setUploading(false);
      setUploadMetrics((prev) => ({ ...prev, phase: 'processing', failed: 0 }));

      const latestJob = await getJobById(selectedJobId).catch(() => selectedJobConfig);

      if (!latestJob?.id) {
        throw new Error('Selected job role is not available for analysis. Please reselect and try again.');
      }

      const latestTitle = String(latestJob.title || optimisticTitle);

      mutateActiveSession((session) => ({
        ...session,
        title: latestTitle,
        selected_job: latestTitle,
      }));

      const requiredSkills = Array.isArray(latestJob.skills)
        ? latestJob.skills
            .map((entry: any) => ({
              skill: normalizeSkillToken(String(entry?.skill_name || '')),
              level: typeof entry?.level === 'string' ? entry.level : undefined,
            }))
            .filter((entry: { skill: string; level?: string }) => Boolean(entry.skill))
        : [];

      const uploadedIds = uploaded.map((item) => item.id).filter((id) => Boolean(id));
      if (uploadedIds.length === 0) {
        throw new Error('Uploaded resumes could not be identified for analysis. Please try uploading again.');
      }

      const analysisResults = await runAnalysisForResumes(String(latestJob.id), uploadedIds);
      const allCandidates = await getCandidates().catch(() => [] as any[]);
      const candidatesByNormalizedName = new Map<string, string>();
      const candidateMetaByNormalizedName = new Map<string, any>();

      for (const candidate of allCandidates) {
        const key = normalizeName(String(candidate?.full_name || ''));
        if (key && !candidatesByNormalizedName.has(key) && candidate?.id) {
          candidatesByNormalizedName.set(key, String(candidate.id));
        }
        if (key && !candidateMetaByNormalizedName.has(key)) {
          candidateMetaByNormalizedName.set(key, candidate);
        }
      }

      const rankedResults: ResultCard[] = analysisResults.map((candidate: any, index: number) => {
        const candidateName = String(candidate?.candidate_name || 'Unknown candidate');
        const normalizedCandidateName = normalizeName(candidateName);
        const candidateMeta = candidateMetaByNormalizedName.get(normalizedCandidateName);
        const shortlistEntries = Array.isArray(candidateMeta?.shortlist_entries) ? candidateMeta.shortlist_entries : [];
        const shortlistForRole = shortlistEntries.find((entry: any) => entry?.role_id === String(latestJob.id));
        const matchedSkills = Array.isArray(candidate?.matched_skills)
          ? candidate.matched_skills
              .filter((skill: unknown) => typeof skill === 'string')
              .map((skill: string) => normalizeSkillToken(skill))
          : [];
        const missingSkills = Array.isArray(candidate?.missing_skills)
          ? candidate.missing_skills
              .filter((skill: unknown) => typeof skill === 'string')
              .map((skill: string) => normalizeSkillToken(skill))
          : [];

        const requiredSkillNames = requiredSkills.map((entry: { skill: string }) => entry.skill);
        const normalizedMatched = matchedSkills.map((skill: string) => normalizeSkillToken(skill));
        const mergedMissing = Array.from(
          new Set([
            ...missingSkills,
            ...requiredSkillNames.filter((skill: string) => !normalizedMatched.includes(skill)),
          ])
        );

        const topSkills = matchedSkills.slice(0, 3);

        const competencyRows = requiredSkills.length > 0
          ? requiredSkills.map((entry: { skill: string; level?: string }) => {
              const isMatched = normalizedMatched.includes(entry.skill.toLowerCase().trim());
              if (!isMatched) {
                return { skill: entry.skill, percentage: 0, is_na: true };
              }

              const normalizedLevel = String(entry.level || '').toLowerCase();
              const percentage =
                normalizedLevel === 'expert' ? 90 : normalizedLevel === 'intermediate' ? 75 : 60;
              return { skill: entry.skill, percentage };
            })
          : [
              ...matchedSkills.map((skill: string) => ({ skill, percentage: 75 })),
              ...mergedMissing.map((skill: string) => ({ skill, percentage: 0, is_na: true })),
            ];

        return {
          rank: index + 1,
          candidate_name: candidateName,
          match_score: Number(candidate?.score ?? 0),
          top_skills: topSkills,
          matched_skills: matchedSkills,
          missing_skills: mergedMissing,
          skills_with_percentage: competencyRows,
          required_skills: requiredSkills,
          candidate_id: candidatesByNormalizedName.get(normalizedCandidateName),
          candidate_email:
            typeof candidateMeta?.email === 'string' && candidateMeta.email.trim()
              ? candidateMeta.email.trim()
              : undefined,
          is_shortlisted: Boolean(shortlistForRole),
          shortlisted_type:
            shortlistForRole?.selection_type === 'final_select' || shortlistForRole?.selection_type === 'select'
              ? shortlistForRole.selection_type
              : null,
        };
      });

      mutateActiveSession((session) => {
        return {
          ...session,
          has_run: true,
          results: rankedResults,
        };
      });

      setSelectedFiles([]);
      setUploadMetrics((prev) => ({
        ...prev,
        phase: 'completed',
        processed: prev.total,
        success: prev.total,
        failed: 0,
      }));
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Analysis failed.';
      setError(messageText);
      setUploadMetrics((prev) => ({
        ...prev,
        phase: 'failed',
        failed: Math.max(prev.failed, prev.total - prev.success),
      }));
      mutateActiveSession((session) => ({
        ...session,
        has_run: false,
        results: [],
      }));
    } finally {
      setUploading(false);
      setSending(false);
      setStatusMessage(null);
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

  const canRunAnalysis = selectedJobId.trim().length > 0 && selectedFiles.length > 0 && !sending && !uploading;
  const hasAnalysisRun = Boolean(activeSession?.has_run);
  const topCandidates = useMemo(() => {
    const results = activeSession?.results || [];
    if (results.length === 0) {
      return [] as ResultCard[];
    }

    const idSet = new Set(liveCandidateIds);
    if (idSet.size === 0) {
      return [] as ResultCard[];
    }

    return results
      .map((result) => {
        const directId = typeof result.candidate_id === 'string' ? result.candidate_id : undefined;
        const resolvedId =
          directId && idSet.has(directId)
            ? directId
            : liveCandidateIdByName[normalizeName(result.candidate_name)] || undefined;

        if (!resolvedId || !idSet.has(resolvedId)) {
          return null;
        }

        const hydratedEmail =
          result.candidate_email ||
          (resolvedId ? liveCandidateEmailById[resolvedId] : undefined);

        if (result.candidate_id !== resolvedId || result.candidate_email !== hydratedEmail) {
          return {
            ...result,
            candidate_id: resolvedId,
            candidate_email: hydratedEmail,
          };
        }

        return result;
      })
      .filter((result): result is ResultCard => Boolean(result));
  }, [activeSession?.results, liveCandidateIds, liveCandidateIdByName, liveCandidateEmailById]);
  const visibleCandidates = showAllCandidates ? topCandidates : topCandidates.slice(0, 5);

  useEffect(() => {
    if (!hasAnalysisRun) {
      setLiveCandidateIds([]);
      setLiveCandidateIdByName({});
      setLiveCandidateEmailById({});
      return;
    }

    let isActive = true;

    (async () => {
      try {
        const allCandidates = await getCandidates();
        if (!isActive) {
          return;
        }

        const ids: string[] = [];
        const byName: Record<string, string> = {};
        const emailById: Record<string, string> = {};

        for (const candidate of allCandidates) {
          const id = String(candidate?.id || '');
          if (!id) {
            continue;
          }

          ids.push(id);
          const key = normalizeName(String(candidate?.full_name || ''));
          if (key && !byName[key]) {
            byName[key] = id;
          }
          const email = typeof candidate?.email === 'string' ? candidate.email.trim() : '';
          if (email) {
            emailById[id] = email;
          }
        }

        setLiveCandidateIds(ids);
        setLiveCandidateIdByName(byName);
        setLiveCandidateEmailById(emailById);
      } catch {
        if (!isActive) {
          return;
        }

        setLiveCandidateIds([]);
        setLiveCandidateIdByName({});
        setLiveCandidateEmailById({});
      }
    })();

    return () => {
      isActive = false;
    };
  }, [hasAnalysisRun, activeSession?.id]);

  const pendingSelectionEmail = useMemo(() => {
    if (!pendingSelection) {
      return null;
    }

    const directEmail =
      typeof pendingSelection.candidate.candidate_email === 'string'
        ? pendingSelection.candidate.candidate_email.trim()
        : '';
    if (directEmail) {
      return directEmail;
    }

    const candidateId = pendingSelection.candidate.candidate_id;
    if (candidateId && liveCandidateEmailById[candidateId]) {
      return liveCandidateEmailById[candidateId];
    }

    return null;
  }, [pendingSelection, liveCandidateEmailById]);

  useEffect(() => {
    if (!activeSession || activeSession.results.length === 0 || topCandidates.length === 0) {
      return;
    }

    const hasDifferentLength = topCandidates.length !== activeSession.results.length;
    const hasCandidateIdChanges = topCandidates.some(
      (candidate, index) => candidate.candidate_id !== activeSession.results[index]?.candidate_id
    );

    if (!hasDifferentLength && !hasCandidateIdChanges) {
      return;
    }

    mutateActiveSession((session) => ({
      ...session,
      results: topCandidates,
    }));
  }, [topCandidates, activeSession]);

  const getCardHighlightClass = (rank: number) => {
    if (rank === 1) {
      return 'bg-green-50 border-green-200';
    }
    if (rank === 2) {
      return 'bg-blue-50 border-blue-200';
    }
    if (rank === 3) {
      return 'bg-yellow-50 border-yellow-200';
    }
    return 'bg-white border-[var(--app-border)]';
  };

  const handleViewCandidateDetails = (candidate: ResultCard) => {
    setSelectedCandidate(candidate);
    setIsDetailModalOpen(true);
  };

  const handleShortlistCandidate = async (
    candidate: ResultCard,
    selectionType: 'select' | 'final_select'
  ) => {
    setPendingSelection({ candidate, selectionType });
    setSendSelectionEmail(true);
  };

  const confirmShortlistCandidate = async () => {
    if (!pendingSelection) {
      return;
    }

    const { candidate, selectionType } = pendingSelection;
    if (!candidate.candidate_id || !activeSession?.selected_job_id) {
      setError('Candidate cannot be shortlisted because role or candidate id is missing.');
      setPendingSelection(null);
      return;
    }

    setSelectionSubmitting(true);
    try {
      const response = await shortlistCandidate(candidate.candidate_id, {
        role_id: activeSession.selected_job_id,
        selection_type: selectionType,
        send_selection_email: sendSelectionEmail,
      });

      mutateActiveSession((session) => ({
        ...session,
        results: session.results.map((item) =>
          item.candidate_id === candidate.candidate_id
            ? {
                ...item,
                is_shortlisted: true,
                shortlisted_type: selectionType,
              }
            : item
        ),
      }));

      if (sendSelectionEmail) {
        const sent = Boolean(response?.email_sent);
        setStatusMessage(sent ? 'Candidate selected and email sent.' : 'Candidate selected. Email was not sent.');
      } else {
        setStatusMessage('Candidate selected without email notification.');
      }

      setPendingSelection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to shortlist candidate.');
    } finally {
      setSelectionSubmitting(false);
    }
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedCandidate(null);
  };

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
              <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">Account</p>

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
              {currentUser?.avatar_url ? (
                <AvatarImage src={currentUser.avatar_url} alt={currentUser.full_name || 'User'} />
              ) : (
                <AvatarFallback>{userInitials}</AvatarFallback>
              )}
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

      <ConfirmModal
        isOpen={Boolean(pendingSelection)}
        onClose={() => {
          if (selectionSubmitting) {
            return;
          }
          setPendingSelection(null);
        }}
        onConfirm={confirmShortlistCandidate}
        title={pendingSelection?.selectionType === 'final_select' ? 'Final select candidate?' : 'Select candidate?'}
        message={pendingSelection ? `${pendingSelection.candidate.candidate_name} will be marked for this role.` : ''}
        confirmLabel={selectionSubmitting ? 'Saving...' : 'Confirm'}
        confirmIcon={null}
        confirmDisabled={selectionSubmitting}
        cancelDisabled={selectionSubmitting}
      >
        {sendSelectionEmail ? (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <p className="flex items-center gap-1.5 font-medium">
              <Mail className="h-3.5 w-3.5" />
              Mail will be sent to:
            </p>
            <p className="mt-1 break-all">{pendingSelectionEmail || 'Candidate email is not available'}</p>
          </div>
        ) : null}
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--app-text)]">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={sendSelectionEmail}
            onChange={(event) => setSendSelectionEmail(event.target.checked)}
            disabled={selectionSubmitting}
          />
          Send selection email to candidate
        </label>
      </ConfirmModal>

      <ProfileTabsModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      <AppModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
        <SettingsModalContent onClose={() => setIsSettingsOpen(false)} />
      </AppModal>

      <CandidateDetailModal
        candidate={selectedCandidate}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        role={activeSession?.selected_job || selectedJobTitle}
      />

      <div
        className={`flex min-h-screen flex-col pl-[72px] transition-all duration-300 ${sidebarOpen ? 'lg:pl-[332px]' : ''}`}
        onMouseDown={() => {
          if (sidebarOpen) {
            setSidebarOpen(false);
          }
        }}
      >
        {statusMessage ? (
          <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 shadow-md">
            {statusMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mx-auto mt-3 w-full max-w-3xl px-4">
            <p className="rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">{error}</p>
          </div>
        ) : null}

        {!hasAnalysisRun ? (
          <div className="mx-auto mt-8 w-full max-w-3xl px-4 pb-10">
            <div className="surface-panel rounded-3xl p-6 sm:p-7">
              <div className="space-y-5">
                <JobSelector selectedJob={selectedJobId} roles={liveJobs} onChange={setSelectedJobId} />

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
                  selectedCount={selectedFiles.length}
                />

                <UploadedFileList
                  files={selectedFiles}
                  onRemove={handleRemoveSetupFile}
                  onClearAll={handleClearAllSetupFiles}
                  isUploading={uploadMetrics.phase === 'uploading' && (sending || uploading)}
                  isProcessing={uploadMetrics.phase === 'processing' || (sending && !uploading)}
                  processedCount={uploadMetrics.processed}
                  totalCount={uploadMetrics.total || selectedFiles.length}
                  successCount={uploadMetrics.success}
                  failedCount={uploadMetrics.failed}
                />

                <AnalysisButton
                  disabled={!canRunAnalysis}
                  loading={sending || uploading}
                  onClick={runResumeAnalysis}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-8 w-full max-w-[1500px] px-4 pb-10">
            <section className="surface-panel rounded-3xl p-6 sm:p-7">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-[var(--app-text)]">Top Candidates</h2>
                <p className="mt-1 text-sm text-[var(--app-muted)]">Top candidates ranked based on AI score</p>
              </div>

              {visibleCandidates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] p-6 text-sm text-[var(--app-muted)]">
                  Analysis completed, but no ranked candidates were returned.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {visibleCandidates.map((candidate) => (
                      <article
                        key={`${activeSession?.id || 'session'}-${candidate.rank}-${candidate.candidate_name}`}
                        className={`rounded-xl border p-4 shadow-sm transition hover:shadow-md ${getCardHighlightClass(candidate.rank)}`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--app-text)]">
                            Top {candidate.rank}
                          </span>
                          <span className="text-sm font-bold text-[var(--app-text)]">{Math.round(candidate.match_score)}%</span>
                        </div>

                        <h3 className="truncate text-base font-semibold text-[var(--app-text)]" title={candidate.candidate_name}>
                          {candidate.candidate_name}
                        </h3>

                        <p className="mt-2 min-h-[40px] text-xs text-[var(--app-muted)]">
                          {candidate.top_skills.length > 0
                            ? `Top skills: ${candidate.top_skills.join(', ')}`
                            : 'No top skills found'}
                        </p>

                        <Button
                          type="button"
                          variant="ghost"
                          className="mt-4 w-full border-2 border-slate-300 bg-white font-semibold text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-50"
                          onClick={() => handleViewCandidateDetails(candidate)}
                        >
                          View Details
                        </Button>

                        {candidate.is_shortlisted ? (
                          <p className="mt-2 text-center text-xs font-semibold text-emerald-700">
                            Selected ✓ {candidate.shortlisted_type === 'final_select' ? '(Final Select)' : ''}
                          </p>
                        ) : (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => handleShortlistCandidate(candidate, 'select')}
                            >
                              Select
                            </Button>
                            <Button
                              type="button"
                              className="h-8 text-xs"
                              onClick={() => handleShortlistCandidate(candidate, 'final_select')}
                            >
                              Final Select
                            </Button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>

                  {topCandidates.length > 5 ? (
                    <div className="mt-5 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowAllCandidates((prev) => !prev)}
                      >
                        {showAllCandidates ? 'Show Top 5' : `View More (${topCandidates.length - 5})`}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {sending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md transition-all duration-300">
          <div className="flex flex-col items-center gap-6 text-center max-w-md p-8 bg-white rounded-3xl shadow-2xl border border-slate-100">
            <div className="relative">
              <div className="h-20 w-20 animate-spin rounded-full border-b-4 border-indigo-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Rocket className="h-8 w-8 text-indigo-600 animate-bounce" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-800">Deep AI Analysis</h3>
              <p className="text-indigo-600 font-medium animate-pulse">Ollama is evaluating candidate fit...</p>
              <p className="text-slate-500 text-sm italic">This may take 1-2 minutes for large datasets</p>
            </div>
            
            <div className="w-full space-y-3">
              <div className="flex justify-between text-xs font-bold text-slate-600 uppercase tracking-widest">
                <span>Progress</span>
                <span>{Math.round((uploadMetrics.processed / (uploadMetrics.total || 1)) * 100)}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-500 rounded-full"
                  style={{ width: `${(uploadMetrics.processed / (uploadMetrics.total || 1)) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Processed {uploadMetrics.processed} of {uploadMetrics.total || selectedFiles.length} resumes
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
