import { DragEvent } from 'react';
import { CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';

type FileUploadBoxProps = {
  onBrowse: () => void;
  onDropFiles: (files: File[]) => void;
  disabled?: boolean;
  selectedCount?: number;
};

export function FileUploadBox({ onBrowse, onDropFiles, disabled = false, selectedCount = 0 }: FileUploadBoxProps) {
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) {
      return;
    }

    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) {
      onDropFiles(files);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="surface-panel-soft rounded-xl border-2 border-dashed border-[var(--app-border)] p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
        <CloudUpload className="h-6 w-6 text-blue-600" />
      </div>
      <p className="text-base font-semibold text-[var(--app-text)]">Upload candidate resumes</p>
      <p className="mt-1 text-sm text-[var(--app-muted)]">Supported formats: PDF, DOCX, TXT • Max size: 200MB</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={onBrowse} disabled={disabled}>
        Browse files
      </Button>
      <p className="text-xs text-gray-500 text-center mt-2">
        Upload multiple resumes to get AI-powered ranking and top candidate selection.
      </p>
      {selectedCount > 0 ? <p className="text-sm text-blue-600 mt-2">{selectedCount} files selected</p> : null}
    </div>
  );
}
