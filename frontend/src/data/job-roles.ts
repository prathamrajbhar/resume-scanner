export const DEFAULT_JOB_ROLES = [
  {
    id: 'role-1',
    title: 'Senior Backend Engineer',
    description:
      'Build and scale secure backend APIs, data pipelines, and cloud workloads for hiring intelligence features.',
    skills: [
      { name: 'Python', level: 4 },
      { name: 'FastAPI', level: 3 },
      { name: 'PostgreSQL', level: 3 },
    ],
  },
  {
    id: 'role-2',
    title: 'Talent Analytics Specialist',
    description:
      'Translate candidate and job data into scorecards, insights, and reports to improve hiring quality and speed.',
    skills: [
      { name: 'NLP', level: 3 },
      { name: 'Machine Learning', level: 2 },
      { name: 'Prompt Engineering', level: 3 },
    ],
  },
  {
    id: 'role-3',
    title: 'Full Stack Product Engineer',
    description:
      'Deliver end-to-end product features with modern frontend and backend architecture practices.',
    skills: [
      { name: 'TypeScript', level: 3 },
      { name: 'React', level: 3 },
      { name: 'System Design', level: 2 },
    ],
  },
] as const;

export const JOB_ROLE_TITLES = DEFAULT_JOB_ROLES.map((role) => role.title);
