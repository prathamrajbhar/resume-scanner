 'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SkillSelectorProps {
  availableSkills: string[];
  selectedSkillNames: string[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelectSkill: (name: string) => void;
}

export function SkillSelector({
  availableSkills,
  selectedSkillNames,
  query,
  onQueryChange,
  onSelectSkill,
}: SkillSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSkills = availableSkills.filter((skill) => {
    if (selectedSkillNames.includes(skill)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return skill.toLowerCase().includes(normalizedQuery);
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="space-y-2">
      <label htmlFor="skill-search" className="text-sm font-medium text-[var(--app-text)]">
        Required Skills & Levels
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--app-subtle)]" />
        <Input
          id="skill-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder="Search and add a required skill"
          className="pl-9"
        />
        <div
          className={`absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] shadow-[var(--app-shadow-sm)] transition duration-150 ${open ? 'visible opacity-100' : 'invisible opacity-0'}`}
        >
          <div className="max-h-56 overflow-y-auto p-1.5">
            {filteredSkills.length > 0 ? (
              filteredSkills.map((skill) => (
                <button
                  type="button"
                  key={skill}
                  onClick={() => {
                    onSelectSkill(skill);
                    setOpen(true);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--app-muted)] hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]"
                >
                  {skill}
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-[var(--app-subtle)]">No matching skills left to add.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}