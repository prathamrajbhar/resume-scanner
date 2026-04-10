import { DragEvent } from 'react';
import { CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';

type FileUploadBoxProps = {
  onBrowse: () => void;
  onDropFiles: (files: File[]) => void;
  disabled?: boolean;
};

export function FileUploadBox({ onBrowse, onDropFiles, disabled = false }: FileUploadBoxProps) {
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
      className="surface-panel-soft rounded-2xl border-2 border-dashed border-[var(--app-border)] p-8 text-center"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-brand-soft)] text-[var(--app-brand)]">
        <CloudUpload className="h-6 w-6" />
      </div>
      <p className="text-base font-semibold text-[var(--app-text)]">Drag & drop resume files</p>
      <p className="mt-1 text-sm text-[var(--app-muted)]">PDF, DOCX, TXT supported</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={onBrowse} disabled={disabled}>
        Browse files
      </Button>
    </div>
  );
}
