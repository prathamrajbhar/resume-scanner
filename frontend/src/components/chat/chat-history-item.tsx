import { Check, Pencil, Trash2, X } from 'lucide-react';
import { KeyboardEvent } from 'react';

type ChatHistoryItemProps = {
  id: string;
  title: string;
  active: boolean;
  editing: boolean;
  draftTitle: string;
  onSelect: (id: string) => void;
  onStartEdit: (id: string, title: string) => void;
  onDraftChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
};

export function ChatHistoryItem({
  id,
  title,
  active,
  editing,
  draftTitle,
  onSelect,
  onStartEdit,
  onDraftChange,
  onCommitEdit,
  onCancelEdit,
  onDelete,
}: ChatHistoryItemProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onCommitEdit();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancelEdit();
    }
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-2">
        <input
          aria-label="Rename chat title"
          placeholder="Rename chat"
          value={draftTitle}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onCommitEdit}
          autoFocus
          className="h-8 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm outline-none"
        />
        <div className="mt-2 flex items-center justify-end gap-1">
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onCancelEdit} className="rounded-md p-1 hover:bg-[var(--app-surface-soft)]" aria-label="Cancel rename">
            <X className="h-3.5 w-3.5" />
          </button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onCommitEdit} className="rounded-md p-1 hover:bg-[var(--app-surface-soft)]" aria-label="Save title">
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`group flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
        active
          ? 'border-transparent bg-[var(--app-brand)] text-white shadow-sm'
          : 'border-[var(--app-border)] bg-[var(--app-surface-elevated)] text-[var(--app-text)] shadow-sm hover:border-[var(--app-border)] hover:bg-[var(--app-surface-soft)]'
      }`}
    >
      <span className="truncate pr-2">{title}</span>
      <span className={`flex items-center gap-1 ${active ? 'text-white/90' : 'text-[var(--app-subtle)] opacity-100'}`}>
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onStartEdit(id, title);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onStartEdit(id, title);
            }
          }}
          className={`rounded-md p-1 ${active ? 'hover:bg-white/15' : 'hover:bg-[var(--app-surface-soft)]'}`}
          aria-label="Rename chat"
        >
          <Pencil className="h-3.5 w-3.5" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onDelete(id);
            }
          }}
          className={`rounded-md p-1 ${active ? 'hover:bg-white/15' : 'hover:bg-[var(--app-surface-soft)]'}`}
          aria-label="Delete chat"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}
