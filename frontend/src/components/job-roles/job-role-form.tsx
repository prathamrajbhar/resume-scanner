'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { SKILLS, SkillLevel, SkillLevels } from '@/data/skills';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SkillLevelCard } from '@/components/job-roles/skill-level-card';
import { SkillAddModal } from '@/components/job-roles/skill-add-modal';

export interface JobRoleSkill {
  name: string;
  level: number;
}

export interface JobRole {
  id: string;
  title: string;
  description: string;
  skills: JobRoleSkill[];
}

interface JobRoleFormProps {
  onCreateRole: (role: Omit<JobRole, 'id'>) => void;
}

export function JobRoleForm({ onCreateRole }: JobRoleFormProps) {
  const GLOBAL_SKILLS_KEY = 'resume_scanner_global_custom_skills';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [skillLevels, setSkillLevels] = useState<SkillLevels>({});
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const skillsContainerRef = useRef<HTMLDivElement | null>(null);

  const allSkills = useMemo(() => [...SKILLS, ...customSkills], [customSkills]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(GLOBAL_SKILLS_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) {
        return;
      }

      setCustomSkills(parsed.filter((item) => typeof item === 'string'));
    } catch {
      // Ignore malformed local storage values.
    }
  }, []);

  useEffect(() => {
    if (!showAddedToast) {
      return;
    }

    const timer = window.setTimeout(() => setShowAddedToast(false), 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [showAddedToast]);

  const selectedCount = useMemo(() => {
    return Object.values(skillLevels).filter((level) => level > 0).length;
  }, [skillLevels]);

  const filteredSkills = useMemo(() => {
    const query = skillSearch.trim().toLowerCase();
    if (!query) {
      return allSkills;
    }

    return allSkills.filter((skill) => skill.toLowerCase().includes(query));
  }, [allSkills, skillSearch]);

  const handleSkillLevelChange = (skillName: string, level: SkillLevel) => {
    setSkillLevels((prev) => {
      const nextLevels = { ...prev, [skillName]: level };
      if (level === 0) {
        delete nextLevels[skillName];
      }
      return nextLevels;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    if (!normalizedTitle || !normalizedDescription) {
      return;
    }

    const skills: JobRoleSkill[] = Object.entries(skillLevels)
      .filter(([, level]) => level > 0)
      .map(([name, level]) => ({ name, level }));

    onCreateRole({
      title: normalizedTitle,
      description: normalizedDescription,
      skills,
    });

    setTitle('');
    setDescription('');
    setSkillSearch('');
    setSkillLevels({});
    setShowAddSkillModal(false);
  };

  const handleAddSkillFromModal = ({
    name,
    level,
    makeGlobal,
  }: {
    name: string;
    level: SkillLevel;
    makeGlobal: boolean;
  }) => {
    setCustomSkills((prev) => {
      const next = [...prev, name];

      if (makeGlobal && typeof window !== 'undefined') {
        window.localStorage.setItem(GLOBAL_SKILLS_KEY, JSON.stringify(next));
      }

      return next;
    });

    setSkillLevels((prev) => ({
      ...prev,
      [name]: level,
    }));
    setSkillSearch(name);
    setShowAddSkillModal(false);
    setShowAddedToast(true);
  };

  const handleScrollToBottom = () => {
    if (skillsContainerRef.current) {
      skillsContainerRef.current.scrollTo({
        top: skillsContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-6 shadow-[var(--app-shadow-sm)]">
      <div className="grid gap-6">
        <div className="space-y-2">
          <label htmlFor="role-title" className="text-sm font-medium text-[var(--app-text)]">
            Role Title
          </label>
          <Input
            id="role-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Senior Backend Engineer"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="role-description" className="text-sm font-medium text-[var(--app-text)]">
            Role Description
          </label>
          <Textarea
            id="role-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Briefly describe the responsibilities of this role..."
            className="min-h-28"
            required
          />
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-[var(--app-text)]">Skills & Proficiency Levels</h3>

          <div className="mt-3 mb-4 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-subtle)]" />
              <Input
                value={skillSearch}
                onChange={(event) => setSkillSearch(event.target.value)}
                placeholder="Search skills..."
                className="h-10 w-full rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] pl-12 pr-4 text-sm shadow-sm transition duration-200 focus-visible:ring-2 focus-visible:ring-[var(--app-brand)]"
              />
            </div>

            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <button
                type="button"
                onClick={() => {
                  setShowAddSkillModal(true);
                }}
                className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-1 text-xs font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]"
              >
                + Add Skill
              </button>
              <span className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
                {selectedCount} selected
              </span>
            </div>
          </div>

          {showAddedToast ? (
            <p className="slide-down-in rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Skill added successfully
            </p>
          ) : null}

          <div className="relative">
            <div ref={skillsContainerRef} className="max-h-[600px] overflow-y-auto pr-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              {filteredSkills.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSkills.map((skill) => (
                    <SkillLevelCard
                      key={skill}
                      skillName={skill}
                      value={(skillLevels[skill] || 0) as SkillLevel}
                      onChange={handleSkillLevelChange}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-8 text-center text-sm text-[var(--app-subtle)]">
                  No skills match &quot;{skillSearch}&quot;. Try a different search term.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleScrollToBottom}
              className="absolute bottom-2 right-2 rounded-lg bg-[var(--app-brand)] p-2 text-white shadow-lg transition duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>

        <Button type="submit" className="h-11 w-full text-sm font-semibold">
          <Plus className="h-4 w-4" />
          Create Job Role
        </Button>
      </div>

      <SkillAddModal
        isOpen={showAddSkillModal}
        onClose={() => setShowAddSkillModal(false)}
        onSubmit={handleAddSkillFromModal}
        existingSkills={allSkills}
      />
    </form>
  );
}