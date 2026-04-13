interface JobSelectorProps {
  selectedJob: string;
  roles: Array<{ id: string; title: string }>;
  onChange: (value: string) => void;
}

export function JobSelector({ selectedJob, roles, onChange }: JobSelectorProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="target-role" className="text-sm font-medium text-[var(--app-text)]">
        Select Target Job Role
      </label>
      <select
        id="target-role"
        value={selectedJob}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
      >
        <option value="">Choose a role...</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.title}
          </option>
        ))}
      </select>
    </div>
  );
}
