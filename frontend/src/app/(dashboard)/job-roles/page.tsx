'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCreateJob, useDeleteJob, useJobs, useUpdateJob } from '@/lib/hooks';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { JobRole, JobRoleForm } from '@/components/job-roles/job-role-form';
import { RoleCard } from '@/components/job-roles/role-card';
import { EditRoleSkillsModal } from '@/components/job-roles/edit-role-skills-modal';
import { useTopToast } from '@/components/ui/top-toast';

type RoleWithSkills = {
  id: string;
  title: string;
  description?: string;
  auto_select_enabled?: boolean;
  auto_select_threshold?: number;
  require_hr_confirmation?: boolean;
  skills: Array<{
    skill_id: string;
    skill_name?: string;
    level: string;
  }>;
};

export default function JobRolesPage() {
  const { data: roles = [], isLoading } = useJobs();
  const createJobMutation = useCreateJob();
  const updateJobMutation = useUpdateJob();
  const deleteJobMutation = useDeleteJob();
  const { showToast } = useTopToast();
  const [pendingDeleteJobId, setPendingDeleteJobId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const handleCreateRole = async (role: Omit<JobRole, 'id'>) => {
    try {
      const createdRole = await createJobMutation.mutateAsync({
        title: role.title,
        description: role.description,
        auto_select_enabled: role.auto_select_enabled,
        auto_select_threshold: role.auto_select_threshold,
        require_hr_confirmation: role.require_hr_confirmation,
        skills: role.skills.map((s) => ({
          skill_name: s.name,
          required_level: s.level,
        })),
      });

      const skillCount = Array.isArray(createdRole?.skills) ? createdRole.skills.length : role.skills.length;
      showToast({
        message: `Job role and ${skillCount} skill${skillCount === 1 ? '' : 's'} created successfully.`,
        tone: 'success',
      });
    } catch (error) {
      console.error('Failed to create job role', error);
      showToast({
        message: error instanceof Error ? error.message : 'Failed to create job role',
        tone: 'error',
        durationMs: 3200,
      });
      throw error;
    }
  };

  const handleDeleteRole = (jobId: string) => {
    setPendingDeleteJobId(jobId);
  };

  const handleOpenEdit = (jobId: string) => {
    setEditingRoleId(jobId);
  };

  const handleSaveEdit = ({ id, skills }: { id: string; skills: { skill_name: string; required_level: number }[] }) => {
    updateJobMutation.mutate(
      {
        id,
        payload: { skills },
      },
      {
        onSuccess: () => {
          setEditingRoleId(null);
          showToast({
            message: 'Changes saved successfully.',
            tone: 'success',
            durationMs: 3200,
          });
        },
        onError: (error) => {
          console.error('Failed to update job role skills', error);
          showToast({
            message: error instanceof Error ? error.message : 'Failed to update skills',
            tone: 'error',
            durationMs: 3200,
          });
        },
      }
    );
  };

  const editingRole = roles.find((role: RoleWithSkills) => role.id === editingRoleId) || null;

  const confirmDeleteRole = () => {
    if (!pendingDeleteJobId) {
      return;
    }

    const jobIdToDelete = pendingDeleteJobId;
    setPendingDeleteJobId(null);

    deleteJobMutation.mutate(jobIdToDelete, {
      onSuccess: () => {
        showToast({
          message: 'Job role deleted successfully.',
          tone: 'success',
        });
      },
      onError: (error) => {
        console.error('Failed to delete job role', error);
        showToast({
          message: error instanceof Error ? error.message : 'Failed to delete job role',
          tone: 'error',
          durationMs: 3200,
        });
      },
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--app-text)]">Job Role Management</h1>
        <p className="text-sm text-[var(--app-muted)]">Define new job roles and their required skill proficiencies.</p>
      </header>

      <JobRoleForm onCreateRole={handleCreateRole} isSubmitting={createJobMutation.isPending} />

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-[var(--app-text)]">Current System Roles</h2>
        {isLoading ? (
          <div className="text-[var(--app-muted)]">Loading roles...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((role: any) => (
              <RoleCard 
                key={role.id} 
                id={role.id}
                title={role.title} 
                description={role.description} 
                skillCount={role.skills?.length || 0}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteRole}
                deleting={deleteJobMutation.isPending && deleteJobMutation.variables === role.id}
              />
            ))}
            {roles.length === 0 && (
              <p className="text-[var(--app-muted)]">No job roles found. Create one above.</p>
            )}
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteJobId)}
        onClose={() => setPendingDeleteJobId(null)}
        onConfirm={confirmDeleteRole}
        title="Delete job role?"
        message="This will permanently remove the role, related candidate analysis results, and shortlist entries for this job."
        confirmLabel="Delete role"
        confirmIcon={<Trash2 className="h-4 w-4" />}
      />

      <EditRoleSkillsModal
        role={editingRole}
        isOpen={Boolean(editingRole)}
        onClose={() => setEditingRoleId(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}