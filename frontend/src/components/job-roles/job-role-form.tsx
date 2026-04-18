'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { SKILLS, SkillLevel, SkillLevels } from '@/data/skills';
import { createSkillsBulk, deleteSkill, getSkills } from '@/lib/api';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SkillLevelCard } from '@/components/job-roles/skill-level-card';
import { SkillAddModal } from '@/components/job-roles/skill-add-modal';
import { useTopToast } from '@/components/ui/top-toast';

export interface JobRoleSkill {
  name: string;
  level: number;
}

export interface JobRole {
  id: string;
  title: string;
  description: string;
  auto_select_enabled: boolean;
  auto_select_threshold: number;
  require_hr_confirmation: boolean;
  skills: JobRoleSkill[];
}

interface JobRoleFormProps {
  onCreateRole: (role: Omit<JobRole, 'id'>) => Promise<void> | void;
  isSubmitting?: boolean;
}

type SkillOption = {
  id: string;
  name: string;
};

export function JobRoleForm({ onCreateRole, isSubmitting = false }: JobRoleFormProps) {
  const { showToast } = useTopToast();
  const GLOBAL_SKILLS_KEY = 'resume_scanner_global_custom_skills';
  const normalizeSkill = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const applySkillAlias = (value: string) => {
    if (value === 'excel' || value === 'ms excel') {
      return 'microsoft excel';
    }
    return value;
  };
  const canonicalSkill = (value: string) => applySkillAlias(normalizeSkill(value));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [autoSelectEnabled, setAutoSelectEnabled] = useState(false);
  const [autoSelectThreshold, setAutoSelectThreshold] = useState(70);
  const [requireHrConfirmation, setRequireHrConfirmation] = useState(true);
  const [skillLevels, setSkillLevels] = useState<SkillLevels>({});
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [dbSkills, setDbSkills] = useState<SkillOption[]>([]);
  const [hiddenSkills, setHiddenSkills] = useState<string[]>([]);
  const [pendingDeleteSkill, setPendingDeleteSkill] = useState<string | null>(null);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const skillsContainerRef = useRef<HTMLDivElement | null>(null);
  const submitting = isSubmitting || isSubmittingLocal;

  const allSkills = useMemo(() => {
    const staticSkills = SKILLS.map((skill) => canonicalSkill(skill));
    const dbSkillNames = dbSkills.map((skill) => canonicalSkill(skill.name));
    const hidden = new Set(hiddenSkills.map((skill) => canonicalSkill(skill)));
    return Array.from(new Set([...staticSkills, ...dbSkillNames, ...customSkills.map((skill) => canonicalSkill(skill))]))
      .filter((skill) => !hidden.has(skill));
  }, [customSkills, dbSkills, hiddenSkills]);

  useEffect(() => {
    const loadSkills = async () => {
      try {
        const skills = await getSkills();
        const items = Array.isArray(skills)
          ? skills
              .map((skill: { id?: string; name?: string }) => {
                const id = String(skill?.id || '').trim();
                const name = canonicalSkill(skill?.name || '');
                if (!id || !name) {
                  return null;
                }
                return { id, name } as SkillOption;
              })
              .filter((skill): skill is SkillOption => Boolean(skill))
          : [];
        const uniqueByName = new Map<string, SkillOption>();
        for (const item of items) {
          if (!uniqueByName.has(item.name)) {
            uniqueByName.set(item.name, item);
          }
        }
        setDbSkills(Array.from(uniqueByName.values()));
      } catch {
        // Keep defaults/local skills if backend list is unavailable.
      }
    };

    void loadSkills();
  }, []);

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

      setCustomSkills(
        parsed
          .filter((item) => typeof item === 'string')
          .map((item) => canonicalSkill(item))
          .filter(Boolean)
      );
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
    if (submitting) {
      return;
    }

    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    if (!normalizedTitle || !normalizedDescription) {
      return;
    }

    const skills: JobRoleSkill[] = Object.entries(skillLevels)
      .filter(([, level]) => level > 0)
      .map(([name, level]) => ({ name: canonicalSkill(name), level }));

    if (skills.length === 0) {
      showToast({
        message: 'Please select at least one skill.',
        tone: 'error',
      });
      return;
    }

    setIsSubmittingLocal(true);

    Promise.resolve(
      onCreateRole({
        title: normalizedTitle,
        description: normalizedDescription,
        auto_select_enabled: autoSelectEnabled,
        auto_select_threshold: Math.max(0, Math.min(100, Number(autoSelectThreshold) || 70)),
        require_hr_confirmation: requireHrConfirmation,
        skills,
      })
    )
      .then(() => {
        setTitle('');
        setDescription('');
        setSkillSearch('');
        setAutoSelectEnabled(false);
        setAutoSelectThreshold(70);
        setRequireHrConfirmation(true);
        setSkillLevels({});
        setShowAddSkillModal(false);
      })
      .finally(() => {
        setIsSubmittingLocal(false);
      });
  };

  const handleAddSkillFromModal = async ({
    names,
    level,
    makeGlobal,
  }: {
    names: string[];
    level: SkillLevel;
    makeGlobal: boolean;
  }) => {
    const nextNames = names
      .map((skill) => canonicalSkill(skill))
      .filter(Boolean)
      .filter((skill, index, arr) => arr.indexOf(skill) === index);

    if (nextNames.length === 0) {
      return;
    }

    try {
      await createSkillsBulk({
        skills: nextNames,
        level: level === 0 ? 'not_required' : level === 1 ? 'beginner' : level === 2 ? 'intermediate' : level === 3 ? 'advanced' : 'expert',
        global: makeGlobal,
      });

      setDbSkills((prev) => {
        const byName = new Map(prev.map((skill) => [canonicalSkill(skill.name), skill] as const));
        for (const name of nextNames) {
          if (!byName.has(name)) {
            byName.set(name, { id: `custom-${name.replace(/\s+/g, '-')}`, name });
          }
        }
        return Array.from(byName.values());
      });
    } catch {
      // Fall back to local-only behavior if API save fails.
    }

    setCustomSkills((prev) => {
      const next = Array.from(new Set([...prev, ...nextNames]));

      if (makeGlobal && typeof window !== 'undefined') {
        window.localStorage.setItem(GLOBAL_SKILLS_KEY, JSON.stringify(next));
      }

      return next;
    });

    setSkillLevels((prev) => {
      const next = { ...prev };
      for (const name of nextNames) {
        next[name] = level;
      }
      return next;
    });
    setSkillSearch(nextNames[nextNames.length - 1]);
    setShowAddSkillModal(false);
    setShowAddedToast(true);
    showToast({
      message: `${nextNames.length} skill${nextNames.length > 1 ? 's' : ''} added`,
      tone: 'success',
      durationMs: 2000,
    });
  };

  const handleScrollToBottom = () => {
    if (skillsContainerRef.current) {
      skillsContainerRef.current.scrollTo({
        top: skillsContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const handleDeleteSkill = async () => {
    if (!pendingDeleteSkill) {
      return;
    }

    const deletingSkill = canonicalSkill(pendingDeleteSkill);
    const dbSkill = dbSkills.find((item) => canonicalSkill(item.name) === deletingSkill);

    try {
      if (dbSkill) {
        await deleteSkill(dbSkill.id);
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : 'Failed to delete skill from database',
        tone: 'error',
      });
      setPendingDeleteSkill(null);
      return;
    }

    setHiddenSkills((prev) => Array.from(new Set([...prev, deletingSkill])));
    setCustomSkills((prev) => prev.filter((skill) => canonicalSkill(skill) !== deletingSkill));
    setDbSkills((prev) => prev.filter((item) => canonicalSkill(item.name) !== deletingSkill));
    setSkillLevels((prev) => {
      const next = { ...prev };
      delete next[deletingSkill];
      return next;
    });
    setPendingDeleteSkill(null);
    showToast({ message: 'Skill deleted', tone: 'success' });
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
          <h3 className="font-display text-lg font-semibold text-[var(--app-text)]">Auto Selection Criteria</h3>

          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <div className="flex flex-col gap-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--app-text)]">Enable Auto Shortlisting</span>
                <button
                  type="button"
                  onClick={() => setAutoSelectEnabled((prev) => !prev)}
                  disabled={submitting}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    autoSelectEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      autoSelectEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>

              <div className="space-y-2">
                <label htmlFor="auto-threshold" className="text-sm font-medium text-[var(--app-text)]">
                  Minimum Match Score (%)
                </label>
                <Input
                  id="auto-threshold"
                  type="number"
                  min={0}
                  max={100}
                  value={autoSelectThreshold}
                  onChange={(event) => setAutoSelectThreshold(Number(event.target.value || 70))}
                  disabled={submitting || !autoSelectEnabled}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--app-text)]">
                <input
                  type="checkbox"
                  checked={requireHrConfirmation}
                  onChange={(event) => setRequireHrConfirmation(event.target.checked)}
                  disabled={submitting || !autoSelectEnabled}
                  className="h-4 w-4 rounded border-[var(--app-border)]"
                />
                Require HR confirmation before final selection
              </label>
            </div>
          </div>
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
                disabled={submitting}
                className="h-10 w-full rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] pl-12 pr-4 text-sm shadow-sm transition duration-200 focus-visible:ring-2 focus-visible:ring-[var(--app-brand)]"
              />
            </div>

            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <button
                type="button"
                onClick={() => {
                  setShowAddSkillModal(true);
                }}
                disabled={submitting}
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
                      onRequestDelete={setPendingDeleteSkill}
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
              disabled={submitting}
              className="absolute bottom-2 right-2 rounded-lg bg-[var(--app-brand)] p-2 text-white shadow-lg transition duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="h-11 w-full text-sm font-semibold disabled:bg-[var(--app-brand)] disabled:text-white disabled:opacity-90"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {submitting ? 'Processing...' : 'Create Job Role'}
        </Button>
      </div>

      <SkillAddModal
        isOpen={showAddSkillModal}
        onClose={() => setShowAddSkillModal(false)}
        onSubmit={handleAddSkillFromModal}
        existingSkills={allSkills}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteSkill)}
        onClose={() => setPendingDeleteSkill(null)}
        onConfirm={handleDeleteSkill}
        title="Delete skill?"
        message={`This will remove ${pendingDeleteSkill || 'this skill'} from the visible list.`}
        confirmLabel="Delete"
        confirmIcon={<Trash2 className="h-4 w-4" />}
      />
    </form>
  );
}