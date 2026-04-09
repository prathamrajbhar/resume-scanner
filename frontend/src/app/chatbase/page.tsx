'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Paperclip, SendHorizontal, Sparkles } from 'lucide-react';
import { analyzeJobDescription, uploadResumes } from '@/lib/api';
import {
  CHAT_ID_STORAGE_KEY,
  CHAT_MESSAGES_STORAGE_KEY,
  CHAT_UPLOADS_STORAGE_KEY,
} from '@/lib/storage';
import { ChatLogMessage, ResumeUploadResponse, ScoringModel } from '@/types/resume';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const generateMessageId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getDefaultMessages = (): ChatLogMessage[] => [
  {
    id: generateMessageId(),
    role: 'assistant',
    content: 'Welcome. Attach resumes with + and then ask for ranking, filtering, or shortlist recommendations.',
    timestamp: new Date().toISOString(),
  },
];

const readJsonStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export default function ChatbasePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [chatId, setChatId] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    return window.localStorage.getItem(CHAT_ID_STORAGE_KEY) || undefined;
  });
  const [modelType, setModelType] = useState<ScoringModel>('ensemble');
  const [messages, setMessages] = useState<ChatLogMessage[]>(() => readJsonStorage(CHAT_MESSAGES_STORAGE_KEY, getDefaultMessages()));
  const [input, setInput] = useState('');
  const [uploadedResumes, setUploadedResumes] = useState<ResumeUploadResponse[]>(() =>
    readJsonStorage(CHAT_UPLOADS_STORAGE_KEY, [])
  );
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(CHAT_UPLOADS_STORAGE_KEY, JSON.stringify(uploadedResumes));
  }, [uploadedResumes]);

  useEffect(() => {
    if (chatId) {
      window.localStorage.setItem(CHAT_ID_STORAGE_KEY, chatId);
    } else {
      window.localStorage.removeItem(CHAT_ID_STORAGE_KEY);
    }
  }, [chatId]);

  useEffect(() => {
    const onChatsCleared = () => {
      setChatId(undefined);
      setUploadedResumes([]);
      setMessages(getDefaultMessages());
      setError(null);
    };

    window.addEventListener('resume:chats-cleared', onChatsCleared);
    return () => {
      window.removeEventListener('resume:chats-cleared', onChatsCleared);
    };
  }, []);

  const addMessage = (role: ChatLogMessage['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: generateMessageId(),
        role,
        content,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setUploading(true);
    setError(null);
    addMessage('system', `Uploading ${files.length} file(s)...`);

    try {
      const response = await uploadResumes(files);
      setUploadedResumes((prev) => [...response, ...prev]);

      const names = response.map((resume) => resume.name).join(', ');
      addMessage('system', `Uploaded ${response.length} resume(s): ${names}`);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Upload failed.';
      setError(messageText);
      addMessage('assistant', `Upload error: ${messageText}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();

    const message = input.trim();
    if (!message) {
      return;
    }

    setInput('');
    setError(null);
    addMessage('user', message);
    setSending(true);

    try {
      const response = await analyzeJobDescription({
        message,
        chat_id: chatId,
        model_type: modelType,
      });

      setChatId(response.chat_id);
      addMessage('assistant', response.message);

      if (response.candidates.length > 0) {
        const topList = response.candidates
          .slice(0, 5)
          .map((candidate, index) => `${index + 1}. ${candidate.full_name} (${Math.round(candidate.score)})`)
          .join('\n');

        addMessage('assistant', `Top candidates:\n${topList}`);
      } else {
        addMessage('assistant', 'No ranked candidates found yet. Attach resumes in this chat and try again.');
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Analysis failed.';
      setError(messageText);
      addMessage('assistant', `Analysis error: ${messageText}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-2xl">Hiring Assistant</CardTitle>
            <CardDescription>Ask for ranking, shortlisting, and skill gap analysis.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--app-subtle)]" />
            <select
              id="chat-model"
              value={modelType}
              onChange={(event) => setModelType(event.target.value as ScoringModel)}
              className="h-9 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm"
            >
              <option value="ensemble">ensemble</option>
              <option value="hybrid">hybrid</option>
              <option value="bert">bert</option>
              <option value="tf-idf">tf-idf</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[520px] space-y-3 overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[92%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-auto bg-[var(--app-brand)] text-white'
                    : message.role === 'system'
                      ? 'bg-[var(--app-brand-soft)] text-[var(--app-brand)]'
                      : 'bg-[var(--app-surface-elevated)]'
                }`}
              >
                {message.content}
              </article>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFilesSelected}
          />

          <form onSubmit={handleSend} className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {uploadedResumes.slice(0, 8).map((resume, idx) => (
                <Badge key={`${resume.id}-${idx}`} variant="secondary">{resume.name}</Badge>
              ))}
              {uploadedResumes.length > 8 ? <Badge variant="secondary">+{uploadedResumes.length - 8} more</Badge> : null}
            </div>

            <div className="flex items-end gap-2">
              <Button
                type="button"
                onClick={handleAttachClick}
                disabled={uploading || sending}
                variant="secondary"
                size="icon"
                aria-label="Attach resumes"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask to rank candidates, shortlist top profiles, or identify skill gaps..."
                className="min-h-[48px] max-h-[180px]"
              />
              <Button type="submit" disabled={sending || uploading}>
                {sending ? 'Thinking...' : 'Send'}
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <p className="mt-2 text-xs text-[var(--app-subtle)]">Attach resumes here for context-aware ranking responses.</p>
          </form>

          {error ? <p className="mt-3 rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">{error}</p> : null}

          <div className="mt-4 flex items-center justify-between text-sm text-[var(--app-muted)]">
            <p>{uploading ? 'Uploading files...' : `${uploadedResumes.length} resume(s) in this chat session`}</p>
            <Button asChild variant="ghost" size="sm">
              <Link href="/candidates">Open candidates</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
