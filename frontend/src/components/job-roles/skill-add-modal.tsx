'use client';

import { ClipboardEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { SkillLevel } from '@/data/skills';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SkillAddModalSubmit = {
  names: string[];
  level: SkillLevel;
  makeGlobal: boolean;
};

type SkillAddModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SkillAddModalSubmit) => Promise<void> | void;
  existingSkills: string[];
};

export function SkillAddModal({ isOpen, onClose, onSubmit, existingSkills }: SkillAddModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [level, setLevel] = useState<SkillLevel>(2);
  const [makeGlobal, setMakeGlobal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalizeSkillName = (raw: string): string => {
    return raw.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  const splitSkills = (raw: string): string[] => {
    return raw
      .split(/[\n,]+/)
      .map((item) => normalizeSkillName(item))
      .filter(Boolean);
  };

  const formatSkillDisplay = (name: string): string => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const pushSkills = (incoming: string[]) => {
    if (!incoming.length) {
      return;
    }

    const currentSet = new Set(skills.map((skill) => normalizeSkillName(skill)));
    const next = [...skills];

    let duplicateDetected = false;
    for (const skill of incoming) {
      const normalized = normalizeSkillName(skill);
      if (!normalized) {
        continue;
      }
      if (currentSet.has(normalized)) {
        duplicateDetected = true;
        continue;
      }

      next.push(normalized);
      currentSet.add(normalized);
    }

    setSkills(next);
    if (duplicateDetected) {
      setError('Skill already added');
    } else {
      setError(null);
    }
  };

  const suggestions = existingSkills
    .map((name) => normalizeSkillName(name))
    .filter(Boolean)
    .filter((name, index, arr) => arr.indexOf(name) === index)
    .filter((name) => !skills.includes(name))
    .filter((name) => normalizeSkillName(inputValue) && name.includes(normalizeSkillName(inputValue)))
    .slice(0, 6);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 20);

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setSkills([]);
      setLevel(2);
      setMakeGlobal(true);
      setError(null);
      setActiveSuggestionIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [inputValue]);

  const commitInput = () => {
    const parsed = splitSkills(inputValue);
    if (parsed.length > 0) {
      pushSkills(parsed);
    }
    setInputValue('');
  };

  const handleSubmit = async () => {
    const pending = splitSkills(inputValue);
    if (pending.length > 0) {
      pushSkills(pending);
      setInputValue('');
    }

    const finalSkills = [...skills, ...pending]
      .map((item) => normalizeSkillName(item))
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index);

    if (finalSkills.length === 0) {
      setError('Enter at least one new skill.');
      return;
    }

    setError(null);

    await onSubmit({
      names: finalSkills,
      level,
      makeGlobal,
    });
  };

  const handleEnterSubmit = async (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        event.preventDefault();
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      if (suggestions.length > 0) {
        event.preventDefault();
        setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (event.key === 'Enter' && suggestions.length > 0 && normalizeSkillName(inputValue)) {
        pushSkills([suggestions[activeSuggestionIndex]]);
        setInputValue('');
        return;
      }
      commitInput();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    const parsed = splitSkills(pasted);
    if (parsed.length > 1 || pasted.includes(',')) {
      event.preventDefault();
      pushSkills(parsed);
      setError(null);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills((prev) => prev.filter((skill) => skill !== skillToRemove));
    setError(null);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="dropdown-pop w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-semibold text-gray-900">Add New Skill</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="new-skill-name">
              Skill Name(s)
            </label>
            <div className="relative">
              <Input
                id="new-skill-name"
                ref={inputRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleEnterSubmit}
                onBlur={commitInput}
                onPaste={handlePaste}
                placeholder="e.g. python, react, sql"
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              />

              {suggestions.length > 0 && normalizeSkillName(inputValue) ? (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        pushSkills([suggestion]);
                        setInputValue('');
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm transition ${
                        index === activeSuggestionIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {formatSkillDisplay(suggestion)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-gray-500">Type skills separated by comma or press Enter.</p>

            {skills.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
                    {formatSkillDisplay(skill)}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="rounded-full p-0.5 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                      aria-label={`Remove ${formatSkillDisplay(skill)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="new-skill-level">
              Skill Level Default
            </label>
            <select
              id="new-skill-level"
              value={level}
              onChange={(event) => setLevel(Number(event.target.value) as SkillLevel)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value={0}>Not Required</option>
              <option value={1}>Beginner</option>
              <option value={2}>Intermediate</option>
              <option value={3}>Advanced</option>
              <option value={4}>Expert</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={makeGlobal}
              onChange={(event) => setMakeGlobal(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Make this skill available for all users
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} className="bg-blue-600 text-white hover:bg-blue-700">
              Add Skills
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
