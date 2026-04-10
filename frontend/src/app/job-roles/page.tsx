'use client';

import { useState } from 'react';
import { DEFAULT_JOB_ROLES } from '@/data/job-roles';
import { JobRole, JobRoleForm } from '@/components/job-roles/job-role-form';
import { RoleCard } from '@/components/job-roles/role-card';

const initialRoles: JobRole[] = DEFAULT_JOB_ROLES.map((role) => ({
  id: role.id,
  title: role.title,
  description: role.description,
  skills: role.skills.map((skill) => ({
    name: skill.name,
    level: skill.level,
  })),
}));

export default function JobRolesPage() {
  const [roles, setRoles] = useState<JobRole[]>(initialRoles);

  const handleCreateRole = (role: Omit<JobRole, 'id'>) => {
    const nextRole: JobRole = {
      id: `role-${Date.now()}`,
      ...role,
    };
    setRoles((prev) => [nextRole, ...prev]);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--app-text)]">Job Role Management</h1>
        <p className="text-sm text-[var(--app-muted)]">Define new job roles and their required skill proficiencies.</p>
      </header>

      <JobRoleForm onCreateRole={handleCreateRole} />

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-[var(--app-text)]">Current System Roles</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((role) => (
            <RoleCard key={role.id} title={role.title} description={role.description} skillCount={role.skills.length} />
          ))}
        </div>
      </section>
    </div>
  );
}