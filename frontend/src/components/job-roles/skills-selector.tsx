'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SKILLS, SkillLevel, SkillLevels } from '@/data/skills';
import { Input } from '@/components/ui/input';
import { SkillLevelCard } from '@/components/job-roles/skill-level-card';

interface SkillsSelectorProps {
  skillLevels: SkillLevels;
  onSkillLevelChange: (skillName: string, level: SkillLevel) => void;
}

export function SkillsSelector({ skillLevels, onSkillLevelChange }: SkillsSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCount = useMemo(() => {
    return Object.values(skillLevels).filter((level) => level > 0).length;
  }, [skillLevels]);

  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return SKILLS;
    }

    return SKILLS.filter((skill) => skill.toLowerCase().includes(query));
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-[var(--app-text)]">Skills & Proficiency Levels</h2>
        <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
          {selectedCount} selected
        </span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--app-subtle)]" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search skills..."
          className="pl-9"
        />
      </div>

      <div className="max-h-[600px] overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        {filteredSkills.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSkills.map((skill) => (
              <SkillLevelCard
                key={skill}
                skillName={skill}
                value={(skillLevels[skill] || 0) as SkillLevel}
                onChange={onSkillLevelChange}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-8 text-center text-sm text-[var(--app-subtle)]">
            No skills match &quot;{searchQuery}&quot;. Try a different search term.
          </p>
        )}
      </div>
    </div>
  );
}
