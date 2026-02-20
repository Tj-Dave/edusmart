-- ================================================================
--  EduSmart  ·  PostgreSQL Schema
--  Run: psql -U postgres -d edusmart -f schema.sql
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ── Users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    must_id      CITEXT       NOT NULL UNIQUE,
    full_name    VARCHAR(120) NOT NULL,
    email        CITEXT       NOT NULL UNIQUE,
    password     TEXT         NOT NULL,
    role         VARCHAR(20)  NOT NULL CHECK (role IN ('student','lecturer')),
    department   VARCHAR(120),
    year_of_study INT,                        -- students only
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Materials (uploaded by lecturers) ─────────────────────────
CREATE TABLE IF NOT EXISTS materials (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    file_url     TEXT         NOT NULL,
    file_type    VARCHAR(50),
    course_code  VARCHAR(30),
    uploaded_by  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Student–Material access ────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_materials (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    material_id UUID        NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    synced      BOOLEAN     NOT NULL DEFAULT FALSE,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, material_id)
);

-- ── AI Query log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_queries (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question    TEXT        NOT NULL,
    answer      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Refresh tokens ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_must_id       ON users(must_id);
CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role);
CREATE INDEX IF NOT EXISTS idx_materials_course    ON materials(course_code);
CREATE INDEX IF NOT EXISTS idx_ai_queries_student  ON ai_queries(student_id);
CREATE INDEX IF NOT EXISTS idx_refresh_user        ON refresh_tokens(user_id);

-- ── Auto-update updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON users;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Demo Seed (password = "Password123!") ─────────────────────
INSERT INTO users (must_id, full_name, email, password, role, department, year_of_study)
VALUES
  ('2023/BCS/001','Alice Nakamura','alice@must.ac.ug',
   crypt('Password123!', gen_salt('bf',12)),'student','Computer Science',2),
  ('2022/BCS/045','Bob Tumwine','bob@must.ac.ug',
   crypt('Password123!', gen_salt('bf',12)),'student','Computer Science',3),
  ('LEC/2019/004','Dr. James Okello','j.okello@must.ac.ug',
   crypt('Password123!', gen_salt('bf',12)),'lecturer','Computer Science',NULL)
ON CONFLICT DO NOTHING;