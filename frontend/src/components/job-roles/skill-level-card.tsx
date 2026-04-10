'use client';

import { skillLevelOptions, SkillLevel } from '@/data/skills';

interface SkillLevelCardProps {
  skillName: string;
  value: SkillLevel;
  onChange: (skillName: string, level: SkillLevel) => void;
}

export function SkillLevelCard({ skillName, value, onChange }: SkillLevelCardProps) {
  const isSelected = value > 0;

  return (
    <div
      className={`h-full flex flex-col justify-between rounded-xl border-2 p-3 transition duration-200 ${
        isSelected
          ? 'border-blue-500 bg-[var(--app-brand-soft)]'
          : 'border-[var(--app-border)] bg-[var(--app-surface-elevated)]'
      }`}
    >
      <p className="text-sm font-semibold text-[var(--app-text)]">{skillName}</p>
      <select
        aria-label={`Proficiency level for ${skillName}`}
        value={value}
        onChange={(event) => onChange(skillName, Number(event.target.value) as SkillLevel)}
        className="w-full mt-2 h-9 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
      >
        {skillLevelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
