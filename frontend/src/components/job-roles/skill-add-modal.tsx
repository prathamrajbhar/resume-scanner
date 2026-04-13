'use client';

import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { SkillLevel } from '@/data/skills';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SkillAddModalSubmit = {
  name: string;
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
  const [name, setName] = useState('');
  const [level, setLevel] = useState<SkillLevel>(2);
  const [makeGlobal, setMakeGlobal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 20);

    const onKeyDown = (event: KeyboardEvent) => {
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
      setName('');
      setLevel(2);
      setMakeGlobal(true);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a skill name.');
      return;
    }

    const exists = existingSkills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setError('This skill already exists.');
      return;
    }

    await onSubmit({
      name: trimmed,
      level,
      makeGlobal,
    });
  };

  const handleEnterSubmit = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await handleSubmit();
    }
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
              Skill Name
            </label>
            <Input
              id="new-skill-name"
              ref={inputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={handleEnterSubmit}
              placeholder="e.g. Prompt Engineering"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            />
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
              Add Skill
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
