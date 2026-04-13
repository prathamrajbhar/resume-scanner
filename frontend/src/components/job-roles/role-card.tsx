import { Badge } from '@/components/ui/badge';

interface RoleCardProps {
  id: string;
  title: string;
  description: string;
  skillCount: number;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

export function RoleCard({ id, title, description, skillCount, onEdit, onDelete, deleting = false }: RoleCardProps) {
  return (
    <article className="group rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-5 shadow-[var(--app-shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[var(--app-shadow-md)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-[var(--app-text)]">{title}</h3>
        <Badge variant="secondary">{skillCount} Skills</Badge>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--app-muted)]">{description}</p>
      {onDelete || onEdit ? (
        <div className="mt-4 flex justify-end gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(id)}
              className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]"
            >
              Edit Skills
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(id)}
              disabled={deleting}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}