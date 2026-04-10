import { X } from 'lucide-react';

type UploadedFileListProps = {
  files: File[];
  onRemove: (index: number) => void;
};

export function UploadedFileList({ files, onRemove }: UploadedFileListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file, index) => (
        <span
          key={`${file.name}-${file.size}-${index}`}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-1 text-xs font-medium text-[var(--app-text)]"
        >
          {file.name}
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-full p-0.5 text-[var(--app-subtle)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]"
            aria-label={`Remove ${file.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
