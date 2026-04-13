'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { SkillLevel, SkillLevels } from '@/data/skills';
import { createSkill, getSkills } from '@/lib/api';
import { SkillLevelCard } from '@/components/job-roles/skill-level-card';
import { SkillAddModal } from '@/components/job-roles/skill-add-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTopToast } from '@/components/ui/top-toast';

type SkillOption = {
  id: string;
  name: string;
};

type RoleSkill = {
  skill_id: string;
  skill_name?: string;
  level: string | number;
};

type EditableRole = {
  id: string;
  title: string;
  description?: string;
  skills: RoleSkill[];
};

type EditRoleSkillsModalProps = {
  role: EditableRole | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: { id: string; skills: { skill_name: string; required_level: number }[] }) => void;
};

const levelToNumeric = (level: string | number): SkillLevel => {
  if (typeof level === 'number') {
    if (level <= 0) {
      return 0;
    }
    if (level <= 1) {
      return 1;
    }
    if (level === 2) {
      return 2;
    }
    return 4;
  }

  const normalized = String(level || '').trim().toLowerCase();
  if (normalized === '0' || normalized === 'not required') {
    return 0;
  }
  if (normalized === '1') {
    return 1;
  }
  if (normalized === '2') {
    return 2;
  }
  if (normalized === '3' || normalized === '4') {
    return 4;
  }
  if (normalized === 'beginner') {
    return 1;
  }
  if (normalized === 'intermediate') {
    return 2;
  }
  if (normalized === 'advanced' || normalized === 'expert') {
    return 4;
  }
  return 0;
};

export function EditRoleSkillsModal({ role, isOpen, onClose, onSave }: EditRoleSkillsModalProps) {
  const { showToast } = useTopToast();
  const [dbSkills, setDbSkills] = useState<SkillOption[]>([]);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [skillLevels, setSkillLevels] = useState<SkillLevels>({});
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const skillsContainerRef = useRef<HTMLDivElement | null>(null);

  const skillNameById = useMemo(() => {
    const entries = dbSkills
      .filter((skill) => skill.id && skill.name)
      .map((skill) => [skill.id, skill.name] as const);
    return Object.fromEntries(entries);
  }, [dbSkills]);

  const preselectedSkillNames = useMemo(() => {
    if (!role) {
      return [] as string[];
    }

    return role.skills
      .map((skill) => skill.skill_name?.trim() || skillNameById[skill.skill_id])
      .filter((name): name is string => Boolean(name));
  }, [role, skillNameById]);

  const allSkills = useMemo(() => {
    const dbSkillNames = dbSkills.map((skill) => skill.name);
    return Array.from(new Set([...dbSkillNames, ...customSkills, ...preselectedSkillNames]));
  }, [dbSkills, customSkills, preselectedSkillNames]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadSkills = async () => {
      try {
        const skills = await getSkills();
        const items = Array.isArray(skills)
          ? skills
              .map((skill: { id?: string; name?: string }) => {
                const name = skill?.name?.trim();
                const id = skill?.id?.trim();
                if (!name || !id) {
                  return null;
                }

                return { id, name } as SkillOption;
              })
              .filter((item): item is SkillOption => Boolean(item))
          : [];
        setDbSkills(items);
      } catch {
        setDbSkills([]);
      }
    };

    void loadSkills();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !role) {
      return;
    }

    const nextLevels: SkillLevels = {};
    role.skills.forEach((skill) => {
      const skillName = skill.skill_name?.trim() || skillNameById[skill.skill_id];
      if (!skillName) {
        return;
      }
      nextLevels[skillName] = levelToNumeric(skill.level);
    });

    setSkillLevels(nextLevels);
    setSkillSearch('');
    setCustomSkills([]);
  }, [isOpen, role, skillNameById]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const filteredSkills = useMemo(() => {
    const query = skillSearch.trim().toLowerCase();
    if (!query) {
      return allSkills;
    }

    return allSkills.filter((skill) => skill.toLowerCase().includes(query));
  }, [allSkills, skillSearch]);

  const selectedCount = useMemo(() => {
    return Object.values(skillLevels).filter((level) => level > 0).length;
  }, [skillLevels]);

  const handleSkillLevelChange = (skillName: string, level: SkillLevel) => {
    setSkillLevels((prev) => {
      const nextLevels = { ...prev, [skillName]: level };
      if (level === 0) {
        delete nextLevels[skillName];
      }
      return nextLevels;
    });
  };

  const handleAddSkillFromModal = async ({
    name,
    level,
    makeGlobal,
  }: {
    name: string;
    level: SkillLevel;
    makeGlobal: boolean;
  }) => {
    try {
      await createSkill({
        name,
        is_global: makeGlobal,
      });
    } catch {
      // Keep local skill support if backend create fails.
    }

    setCustomSkills((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setDbSkills((prev) => {
      if (prev.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        return prev;
      }

      return [...prev, { id: `custom-${name.toLowerCase().replace(/\s+/g, '-')}`, name }];
    });
    setSkillLevels((prev) => ({
      ...prev,
      [name]: level,
    }));
    setShowAddSkillModal(false);
  };

  const handleSave = () => {
    if (!role) {
      return;
    }

    const skills = Object.entries(skillLevels)
      .filter(([, level]) => level > 0)
      .map(([name, required_level]) => ({ name, required_level }))
      .map((skill) => ({ skill_name: skill.name, required_level: skill.required_level }));

    if (skills.length === 0) {
      showToast({
        message: 'Please keep at least one required skill.',
        tone: 'error',
      });
      return;
    }

    onSave({ id: role.id, skills });
  };

  const handleScrollToBottom = () => {
    if (skillsContainerRef.current) {
      skillsContainerRef.current.scrollTo({
        top: skillsContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  if (!isOpen || !role) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div className="my-auto flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[var(--app-text)]">Edit Role Skills</h2>
            <p className="text-sm text-[var(--app-muted)]">{role.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-muted)] transition hover:bg-[var(--app-surface-soft)]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-hidden">
          <div className="mt-1 mb-3 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
                onClick={() => setShowAddSkillModal(true)}
                className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-1 text-xs font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]"
              >
                + Add Skill
              </button>
              <span className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
                {selectedCount} selected
              </span>
            </div>
          </div>

          <div className="relative h-full">
            <div ref={skillsContainerRef} className="max-h-[62vh] overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 pb-14 pr-2">
              {filteredSkills.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  No skills match &quot;{skillSearch}&quot;.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleScrollToBottom}
              className="absolute bottom-4 right-4 z-20 rounded-lg bg-[var(--app-brand)] p-2 text-white shadow-lg transition duration-200 hover:opacity-90"
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            <Plus className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <SkillAddModal
        isOpen={showAddSkillModal}
        onClose={() => setShowAddSkillModal(false)}
        onSubmit={handleAddSkillFromModal}
        existingSkills={allSkills}
      />
    </div>
  );
}
