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

-- -----------------------------------------------------------------------------
-- Job Roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(150) NOT NULL,
  description TEXT,
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
CREATE INDEX IF NOT EXISTS idx_job_roles_created_by ON job_roles(created_by);
CREATE INDEX IF NOT EXISTS idx_resumes_uploaded_by ON resumes(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_analysis_job_id ON analysis(job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_resume_id ON analysis(resume_id);
CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_job_id ON job_skills(job_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_skill_id ON job_skills(skill_id);
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
