import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const skillLevelOptions = [
  { value: 0, label: 'Not Required' },
  { value: 1, label: '1 - Beginner' },
  { value: 2, label: '2 - Intermediate' },
  { value: 3, label: '3 - Advanced' },
  { value: 4, label: '4 - Expert' },
] as const;

interface SkillCardProps {
  name: string;
  level: number;
  onChangeLevel: (name: string, level: number) => void;
  onRemove: (name: string) => void;
}

export function SkillCard({ name, level, onChangeLevel, onRemove }: SkillCardProps) {
  const levelId = `skill-level-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--app-text)]">{name}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(name)}
          className="h-8 w-8 rounded-md text-[var(--app-subtle)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]"
          aria-label={`Remove ${name}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3">
        <label htmlFor={levelId} className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--app-subtle)]">
          Required level
        </label>
        <select
          id={levelId}
          value={level}
          onChange={(event) => onChangeLevel(name, Number(event.target.value))}
          className="h-10 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 text-sm text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
        >
          {skillLevelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}