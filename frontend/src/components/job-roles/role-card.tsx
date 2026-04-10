import { Badge } from '@/components/ui/badge';

interface RoleCardProps {
  title: string;
  description: string;
  skillCount: number;
}

export function RoleCard({ title, description, skillCount }: RoleCardProps) {
  return (
    <article className="group rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-5 shadow-[var(--app-shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[var(--app-shadow-md)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-[var(--app-text)]">{title}</h3>
        <Badge variant="secondary">{skillCount} Skills</Badge>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--app-muted)]">{description}</p>
    </article>
  );
}