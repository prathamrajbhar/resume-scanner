import { ChangeEvent, FormEvent, RefObject } from 'react';
import { Paperclip, SendHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ResumeUploadResponse } from '@/types/resume';

type ChatInputProps = {
  input: string;
  sending: boolean;
  uploading: boolean;
  uploadedResumes: ResumeUploadResponse[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onAttachClick: () => void;
  onFilesSelected: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function ChatInput({
  input,
  sending,
  uploading,
  uploadedResumes,
  fileInputRef,
  onInputChange,
  onSubmit,
  onAttachClick,
  onFilesSelected,
}: ChatInputProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 pb-4">
      <div className="mx-auto w-full max-w-3xl px-4">
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Attach resume files"
          title="Attach resume files"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={onFilesSelected}
        />

        <form onSubmit={onSubmit} className="pointer-events-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-3 shadow-[var(--app-shadow-md)]">
          <div className="mb-2 flex flex-wrap gap-2">
            {uploadedResumes.slice(0, 8).map((resume, idx) => (
              <Badge key={`${resume.id}-${idx}`} variant="secondary">
                {resume.name}
              </Badge>
            ))}
            {uploadedResumes.length > 8 ? <Badge variant="secondary">+{uploadedResumes.length - 8} more</Badge> : null}
          </div>

          <div className="flex items-end gap-2">
            <Button
              type="button"
              onClick={onAttachClick}
              disabled={uploading || sending}
              variant="secondary"
              size="icon"
              aria-label="Attach resumes"
              className="rounded-full"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Ask to rank candidates, shortlist top profiles, or identify skill gaps..."
              className="min-h-[52px] max-h-[190px] rounded-xl"
            />
            <Button type="submit" disabled={sending || uploading} className="rounded-full">
              {sending ? 'Thinking...' : 'Send'}
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
