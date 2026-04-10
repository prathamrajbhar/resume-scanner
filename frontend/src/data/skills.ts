// Comprehensive skill catalog for job role management
// Organized by category for future filtering/grouping
export const SKILLS = [
  // Backend Languages
  'Python',
  'Java',
  'C++',
  'C#',
  'Go',
  'Rust',
  'PHP',
  'Ruby',
  'Kotlin',
  'Scala',

  // Frontend Languages
  'JavaScript',
  'TypeScript',
  'HTML',
  'CSS',
  'SCSS',
  'Tailwind CSS',
  'Vue',
  'Angular',

  // Frontend Frameworks & Libraries
  'React',
  'Next.js',
  'Svelte',
  'Remix',
  'Nuxt',
  'Astro',
  'Solid.js',
  'Preact',

  // Databases
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Elasticsearch',
  'DynamoDB',
  'Cassandra',
  'CouchDB',
  'Neo4j',
  'InfluxDB',

  // Backend Frameworks
  'FastAPI',
  'Django',
  'Flask',
  'Spring Boot',
  'Express.js',
  'NestJS',
  'Laravel',
  'ASP.NET',
  'Ruby on Rails',

  // Cloud Platforms
  'AWS',
  'Azure',
  'Google Cloud',
  'Heroku',
  'DigitalOcean',
  'Vercel',
  'Netlify',
  'Render',
  'AWS Lambda',
  'Google Cloud Functions',

  // DevOps & Infrastructure
  'Docker',
  'Kubernetes',
  'Jenkins',
  'GitLab CI',
  'GitHub Actions',
  'Terraform',
  'Ansible',
  'Nginx',
  'Apache',
  'Istio',

  // Data & Analytics
  'Apache Spark',
  'Hadoop',
  'Apache Kafka',
  'Apache Airflow',
  'dbt',
  'Tableau',
  'Power BI',
  'Looker',
  'Metabase',
  'Snowflake',

  // Machine Learning & AI
  'Machine Learning',
  'Deep Learning',
  'NLP',
  'Computer Vision',
  'TensorFlow',
  'PyTorch',
  'Scikit-learn',
  'Pandas',
  'NumPy',
  'OpenCV',
  'LLM',
  'Prompt Engineering',
  'RAG',
  'Fine-tuning',

  // Version Control & Collaboration
  'Git',
  'GitHub',
  'GitLab',
  'Bitbucket',
  'Jira',
  'Confluence',
  'Slack API',

  // APIs & Integration
  'REST APIs',
  'GraphQL',
  'gRPC',
  'WebSockets',
  'OAuth',
  'JWT',
  'API Gateway',
  'Message Queues',

  // Software Architecture
  'System Design',
  'Microservices',
  'Monolithic Architecture',
  'Event-driven Architecture',
  'SOLID Principles',
  'Design Patterns',
  'Domain-driven Design',

  // Testing
  'Unit Testing',
  'Integration Testing',
  'E2E Testing',
  'Jest',
  'PyTest',
  'Mocha',
  'Cypress',
  'Selenium',

  // Other Tools & Skills
  'CI/CD',
  'Linux',
  'Windows Server',
  'Bash',
  'PowerShell',
  'SQL',
  'Regex',
  'Debugging',
  'Performance Optimization',
  'Security Hardening',
  'Distillation',
];

export const skillLevelOptions = [
  { value: 0, label: 'Not Required' },
  { value: 1, label: '1 - Beginner' },
  { value: 2, label: '2 - Intermediate' },
  { value: 3, label: '3 - Advanced' },
  { value: 4, label: '4 - Expert' },
] as const;

export type SkillLevel = 0 | 1 | 2 | 3 | 4;
export type SkillLevels = Record<string, SkillLevel>;
