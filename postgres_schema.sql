-- AI-Based Resume Screening System
-- PostgreSQL schema, production-oriented and ready to run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100),
  email VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Skills
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(100),
  created_by UUID NULL,
  is_global BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_skills_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

-- Optional alias map to merge common variants into a canonical skill.
CREATE TABLE IF NOT EXISTS skill_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alias VARCHAR(100) NOT NULL,
  skill_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_skill_aliases_skill
    FOREIGN KEY (skill_id)
    REFERENCES skills(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_skill_aliases_alias_lower ON skill_aliases (LOWER(alias));

-- -----------------------------------------------------------------------------
-- Job Roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  auto_select_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  auto_select_threshold INTEGER NOT NULL DEFAULT 70,
  require_hr_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_job_roles_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Job Skills (many-to-many)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  level VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_job_skills_job
    FOREIGN KEY (job_id)
    REFERENCES job_roles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_job_skills_skill
    FOREIGN KEY (skill_id)
    REFERENCES skills(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_job_skills_job_skill UNIQUE (job_id, skill_id),
  CONSTRAINT ck_job_skills_level
    CHECK (level IN ('Beginner', 'Intermediate', 'Expert'))
);

-- -----------------------------------------------------------------------------
-- Resumes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT,
  parsed_data JSONB,
  uploaded_by UUID NOT NULL,
  auto_selected BOOLEAN NOT NULL DEFAULT FALSE,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  selection_status VARCHAR(30) NOT NULL DEFAULT 'rejected',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resumes_uploaded_by
    FOREIGN KEY (uploaded_by)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Analysis Results
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL,
  resume_id UUID NOT NULL,
  score DOUBLE PRECISION NOT NULL CHECK (score >= 0),
  cgpa DOUBLE PRECISION,
  cgpa_or_percentage DOUBLE PRECISION,
  percentage DOUBLE PRECISION,
  education_degree VARCHAR(200),
  degree_relevance DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_experience_years DOUBLE PRECISION,
  relevant_experience_years DOUBLE PRECISION,
  required_experience_years DOUBLE PRECISION NOT NULL DEFAULT 1,
  matched_skill_count INTEGER NOT NULL DEFAULT 0,
  required_skill_count INTEGER NOT NULL DEFAULT 0,
  projects_count INTEGER NOT NULL DEFAULT 0,
  communication_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  leadership_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  teamwork_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  problem_solving_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  academic_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  experience_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  skill_match_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  project_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  soft_skill_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  final_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  soft_skills JSONB,
  normalized_skills JSONB,
  matched_skills JSONB,
  missing_skills JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_analysis_job
    FOREIGN KEY (job_id)
    REFERENCES job_roles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_analysis_resume
    FOREIGN KEY (resume_id)
    REFERENCES resumes(id)
    ON DELETE CASCADE,
  CONSTRAINT uq_analysis_job_resume UNIQUE (job_id, resume_id)
);

ALTER TABLE analysis ADD COLUMN IF NOT EXISTS cgpa_or_percentage DOUBLE PRECISION;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS education_degree VARCHAR(200);
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS projects_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS project_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS soft_skills JSONB;
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS normalized_skills JSONB;
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS auto_select_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS auto_select_threshold INTEGER NOT NULL DEFAULT 70;
ALTER TABLE job_roles ADD COLUMN IF NOT EXISTS require_hr_confirmation BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS auto_selected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS selected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS selection_status VARCHAR(30) NOT NULL DEFAULT 'rejected';

-- -----------------------------------------------------------------------------
-- Chat System
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chats_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_messages_chat
    FOREIGN KEY (chat_id)
    REFERENCES chats(id)
    ON DELETE CASCADE,
  CONSTRAINT ck_chat_messages_role
    CHECK (role IN ('user', 'bot'))
);

-- -----------------------------------------------------------------------------
-- Optional shortlisted candidates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shortlisted_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL,
  resume_id UUID NOT NULL,
  selected_by UUID NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shortlisted_candidates_job
    FOREIGN KEY (job_id)
    REFERENCES job_roles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_shortlisted_candidates_resume
    FOREIGN KEY (resume_id)
    REFERENCES resumes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_shortlisted_candidates_selected_by
    FOREIGN KEY (selected_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT uq_shortlisted_candidates_job_resume UNIQUE (job_id, resume_id)
);

-- -----------------------------------------------------------------------------
-- Performance indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_name_lower ON skills ((LOWER(name)));
CREATE INDEX IF NOT EXISTS idx_job_roles_created_by ON job_roles(created_by);
CREATE INDEX IF NOT EXISTS idx_resumes_uploaded_by ON resumes(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_resumes_is_deleted ON resumes(is_deleted);
CREATE INDEX IF NOT EXISTS idx_analysis_job_id ON analysis(job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_resume_id ON analysis(resume_id);
CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_job_id ON job_skills(job_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_skill_id ON job_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_aliases_skill_id ON skill_aliases(skill_id);
CREATE INDEX IF NOT EXISTS idx_shortlisted_candidates_job_id ON shortlisted_candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_shortlisted_candidates_resume_id ON shortlisted_candidates(resume_id);

-- -----------------------------------------------------------------------------
-- Updated-at maintenance helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION clamp01(value DOUBLE PRECISION)
RETURNS DOUBLE PRECISION AS $$
BEGIN
  RETURN GREATEST(0, LEAST(COALESCE(value, 0), 1));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_analysis_component_scores()
RETURNS TRIGGER AS $$
DECLARE
  normalized_cgpa DOUBLE PRECISION := NULL;
  normalized_percentage DOUBLE PRECISION := NULL;
  education_base DOUBLE PRECISION := 0.5;
BEGIN
  IF NEW.cgpa IS NOT NULL THEN
    normalized_cgpa := clamp01(NEW.cgpa / 10.0);
  END IF;

  IF NEW.percentage IS NOT NULL THEN
    normalized_percentage := clamp01(NEW.percentage / 100.0);
  END IF;

  IF NEW.cgpa_or_percentage IS NULL THEN
    IF NEW.cgpa IS NOT NULL THEN
      NEW.cgpa_or_percentage := NEW.cgpa;
    ELSIF NEW.percentage IS NOT NULL THEN
      NEW.cgpa_or_percentage := NEW.percentage;
    END IF;
  END IF;

  NEW.degree_relevance := clamp01(NEW.degree_relevance);
  IF NEW.degree_relevance >= 0.75 THEN
    education_base := 1.0;
  END IF;

  IF normalized_cgpa IS NOT NULL AND normalized_percentage IS NOT NULL THEN
    NEW.academic_score := clamp01((0.7 * education_base) + (0.3 * ((normalized_cgpa + normalized_percentage) / 2.0)));
  ELSIF normalized_cgpa IS NOT NULL THEN
    NEW.academic_score := clamp01((0.7 * education_base) + (0.3 * normalized_cgpa));
  ELSIF normalized_percentage IS NOT NULL THEN
    NEW.academic_score := clamp01((0.7 * education_base) + (0.3 * normalized_percentage));
  ELSE
    NEW.academic_score := clamp01(education_base);
  END IF;

  IF COALESCE(NEW.total_experience_years, 0) <= 1 THEN
    NEW.experience_score := 0.2;
  ELSIF COALESCE(NEW.total_experience_years, 0) <= 3 THEN
    NEW.experience_score := 0.6;
  ELSE
    NEW.experience_score := 1.0;
  END IF;

  NEW.required_skill_count := GREATEST(COALESCE(NEW.required_skill_count, 0), 0);
  NEW.matched_skill_count := GREATEST(COALESCE(NEW.matched_skill_count, 0), 0);
  NEW.skill_match_score := CASE
    WHEN NEW.required_skill_count = 0 THEN 0
    ELSE clamp01(NEW.matched_skill_count::DOUBLE PRECISION / NEW.required_skill_count::DOUBLE PRECISION)
  END;

  NEW.projects_count := GREATEST(COALESCE(NEW.projects_count, 0), 0);
  NEW.project_score := CASE
    WHEN NEW.projects_count >= 4 THEN 1.0
    WHEN NEW.projects_count >= 2 THEN 0.75
    WHEN NEW.projects_count = 1 THEN 0.5
    ELSE 0.2
  END;

  NEW.communication_score := clamp01(NEW.communication_score);
  NEW.leadership_score := clamp01(NEW.leadership_score);
  NEW.teamwork_score := clamp01(NEW.teamwork_score);
  NEW.problem_solving_score := clamp01(NEW.problem_solving_score);
  NEW.soft_skill_score := clamp01(
    (NEW.communication_score + NEW.leadership_score + NEW.teamwork_score + NEW.problem_solving_score) / 4.0
  );

  NEW.final_score := clamp01(
    (0.40 * NEW.skill_match_score) +
    (0.20 * NEW.experience_score) +
    (0.15 * NEW.academic_score) +
    (0.15 * NEW.project_score) +
    (0.10 * NEW.soft_skill_score)
  );

  NEW.score := ROUND((NEW.final_score * 100.0)::NUMERIC, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_skills_updated_at ON skills;
CREATE TRIGGER trg_skills_updated_at
BEFORE UPDATE ON skills
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_skill_aliases_updated_at ON skill_aliases;
CREATE TRIGGER trg_skill_aliases_updated_at
BEFORE UPDATE ON skill_aliases
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_job_roles_updated_at ON job_roles;
CREATE TRIGGER trg_job_roles_updated_at
BEFORE UPDATE ON job_roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_job_skills_updated_at ON job_skills;
CREATE TRIGGER trg_job_skills_updated_at
BEFORE UPDATE ON job_skills
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_resumes_updated_at ON resumes;
CREATE TRIGGER trg_resumes_updated_at
BEFORE UPDATE ON resumes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_analysis_updated_at ON analysis;
CREATE TRIGGER trg_analysis_updated_at
BEFORE UPDATE ON analysis
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_analysis_component_scores ON analysis;
CREATE TRIGGER trg_analysis_component_scores
BEFORE INSERT OR UPDATE ON analysis
FOR EACH ROW
EXECUTE FUNCTION set_analysis_component_scores();

DROP TRIGGER IF EXISTS trg_chats_updated_at ON chats;
CREATE TRIGGER trg_chats_updated_at
BEFORE UPDATE ON chats
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_messages_updated_at ON chat_messages;
CREATE TRIGGER trg_chat_messages_updated_at
BEFORE UPDATE ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_shortlisted_candidates_updated_at ON shortlisted_candidates;
CREATE TRIGGER trg_shortlisted_candidates_updated_at
BEFORE UPDATE ON shortlisted_candidates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
