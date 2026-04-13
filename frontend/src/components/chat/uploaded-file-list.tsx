import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type UploadedFileListProps = {
  files: File[];
  onRemove: (index: number) => void;
  onClearAll: () => void;
  isUploading?: boolean;
  isProcessing?: boolean;
  processedCount?: number;
  totalCount?: number;
  successCount?: number;
  failedCount?: number;
};

export function UploadedFileList({
  files,
  onRemove,
  onClearAll,
  isUploading = false,
  isProcessing = false,
  processedCount = 0,
  totalCount = 0,
  successCount = 0,
  failedCount = 0,
}: UploadedFileListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const previewFiles = files.slice(0, 5);
  const hiddenCount = Math.max(0, files.length - previewFiles.length);

  const resolvedTotal = totalCount > 0 ? totalCount : files.length;
  const progressMax = Math.max(1, resolvedTotal);
  const progressValue = Math.max(0, Math.min(progressMax, processedCount));

  const statusText = isUploading
    ? `Uploading... ${progressValue} / ${resolvedTotal} resumes processed`
    : isProcessing
      ? `Processing... ${progressValue} / ${resolvedTotal} resumes processed`
      : `Completed ${progressValue} / ${resolvedTotal} resumes`;

  const indexedFiles = files.map((file, index) => ({ file, index }));
  const filteredFiles = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return indexedFiles;
    }

    return indexedFiles.filter(({ file }) => file.name.toLowerCase().includes(term));
  }, [indexedFiles, searchQuery]);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--app-text)]">{files.length} resumes uploaded</p>
        <Button type="button" variant="outline" size="sm" onClick={onClearAll}>
          Clear all uploads
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {previewFiles.map((file, index) => (
          <span
            key={`${file.name}-${file.size}-${index}`}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-white px-3 py-1 text-xs font-medium text-[var(--app-text)]"
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

        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="rounded-full border border-[var(--app-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--app-brand)] hover:bg-[var(--app-surface)]"
          >
            +{hiddenCount} more
          </button>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--app-border)] bg-white p-3">
        <p className="text-xs font-medium text-[var(--app-muted)]">{statusText}</p>
        <progress className="mt-2 h-2 w-full" max={progressMax} value={progressValue} aria-label="Upload progress" />

        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[var(--app-muted)] sm:grid-cols-3">
          <p>Total uploaded: <span className="font-semibold text-[var(--app-text)]">{resolvedTotal}</span></p>
          <p>Successfully parsed: <span className="font-semibold text-emerald-700">{successCount}</span></p>
          <p>Failed files: <span className="font-semibold text-[var(--app-danger)]">{failedCount}</span></p>
        </div>
      </div>

      {isExpanded ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsExpanded(false);
            }
          }}
          role="presentation"
        >
          <section className="w-full max-w-2xl rounded-2xl border border-[var(--app-border)] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--app-text)]">Uploaded files ({files.length})</h3>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="rounded-md p-1 text-[var(--app-muted)] hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]"
                aria-label="Close uploaded files"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-subtle)]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search uploaded files"
                className="h-10 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] pl-9 pr-3 text-sm text-[var(--app-text)]"
              />
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {filteredFiles.map(({ file, index }) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center justify-between rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                >
                  <p className="truncate text-sm text-[var(--app-text)]" title={file.name}>{file.name}</p>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="ml-3 rounded-full p-1 text-[var(--app-subtle)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {filteredFiles.length === 0 ? (
                <p className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-muted)]">
                  No files match this search.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
