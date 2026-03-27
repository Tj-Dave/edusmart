-- EduSmart PostgreSQL schema (users, profiles, auth sessions, chat sessions, chat messages, memory state)
-- Run as a single script in psql or your DB tool.
-- Requires: PostgreSQL 12+ (recommended 14+)

BEGIN;

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
-- pgcrypto provides gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('student', 'lecturer', 'admin');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_provider') THEN
        CREATE TYPE auth_provider AS ENUM ('local', 'google');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
        CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
    END IF;
END$$;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username        text NOT NULL UNIQUE,            -- student_id / lecturer_id / admin username
    password_hash   text,                            -- nullable for google-only accounts
    role            user_role NOT NULL,
    auth_provider   auth_provider NOT NULL DEFAULT 'local',
    google_sub      text UNIQUE,                     -- nullable; set when linked to Google OAuth
    email           text UNIQUE,                     -- optional but useful (esp for Google)
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_password_required_for_local
      CHECK (auth_provider <> 'local' OR password_hash IS NOT NULL)
);

-- ------------------------------------------------------------
-- user_profiles (1:1 with users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name       text,
    university_id   text,                            -- optional: institutional ID (if different from username)
    department      text,
    faculty         text,
    program         text,                            -- e.g., BSc CS (for students)
    year_of_study   integer,
    phone           text,
    avatar_url      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- auth_sessions (refresh/session tokens)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  text NOT NULL,               -- store hash, never plaintext token
    created_at          timestamptz NOT NULL DEFAULT now(),
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,

    -- Optional metadata for security & support
    user_agent          text,
    ip_address          inet
);

-- Helpful index for session lookup / cleanup
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- ------------------------------------------------------------
-- chat_sessions (one row per conversation thread)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           text,
    is_archived     boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- List chats quickly per user, newest first
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);

-- ------------------------------------------------------------
-- chat_messages (turn-by-turn messages inside a chat session)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id              bigserial PRIMARY KEY,
    session_id      uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            message_role NOT NULL,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),

    -- Ensures message user matches the session owner (basic integrity)
    -- Note: PostgreSQL cannot enforce this directly with a FK constraint.
    -- Enforce in application logic, or use a trigger (optional, below).
    CONSTRAINT chat_messages_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Fast “load messages for a session” queries:
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id_id ON chat_messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- ------------------------------------------------------------
-- memory_state (tracks how far summarization has progressed per chat session)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memory_state (
    session_id                  uuid PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
    last_summarized_message_id  bigint NOT NULL DEFAULT 0,
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Optional triggers to maintain updated_at automatically
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users.updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

-- user_profiles.updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_profiles_updated_at') THEN
        CREATE TRIGGER trg_user_profiles_updated_at
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

-- chat_sessions.updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_sessions_updated_at') THEN
        CREATE TRIGGER trg_chat_sessions_updated_at
        BEFORE UPDATE ON chat_sessions
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

-- memory_state.updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_memory_state_updated_at') THEN
        CREATE TRIGGER trg_memory_state_updated_at
        BEFORE UPDATE ON memory_state
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

-- ------------------------------------------------------------
-- Optional: enforce that chat_messages.user_id matches chat_sessions.user_id
-- (Helps prevent spoofing at DB level.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_message_user_matches_session_owner()
RETURNS trigger AS $$
DECLARE
    session_owner uuid;
BEGIN
    SELECT user_id INTO session_owner FROM chat_sessions WHERE id = NEW.session_id;
    IF session_owner IS NULL THEN
        RAISE EXCEPTION 'Invalid session_id %', NEW.session_id;
    END IF;

    IF NEW.user_id <> session_owner THEN
        RAISE EXCEPTION 'user_id % does not own session_id %', NEW.user_id, NEW.session_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_messages_enforce_owner') THEN
        CREATE TRIGGER trg_chat_messages_enforce_owner
        BEFORE INSERT OR UPDATE ON chat_messages
        FOR EACH ROW EXECUTE FUNCTION enforce_message_user_matches_session_owner();
    END IF;
END$$;

-- ------------------------------------------------------------
-- Practicals upgrade (kept here so maindb.sql is self-contained)
-- ------------------------------------------------------------
DO $$
BEGIN
        -- Extend enum only when the enum exists in this database.
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_task_type') THEN
                ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'case_study';
                ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'simulation';
                ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'field_task';
        END IF;
END$$;

ALTER TABLE IF EXISTS roadmap_assessment_tasks
    ADD COLUMN IF NOT EXISTS practical_brief TEXT,
    ADD COLUMN IF NOT EXISTS required_tools TEXT,
    ADD COLUMN IF NOT EXISTS expected_artifact TEXT,
    ADD COLUMN IF NOT EXISTS safety_notes TEXT,
    ADD COLUMN IF NOT EXISTS rubric_json JSONB;

ALTER TABLE IF EXISTS enrollment_task_results
    ADD COLUMN IF NOT EXISTS artifact_url TEXT,
    ADD COLUMN IF NOT EXISTS reflection_text TEXT,
    ADD COLUMN IF NOT EXISTS rubric_scores_json JSONB;

-- ------------------------------------------------------------
-- Versioned hybrid grading upgrade
-- ------------------------------------------------------------
DO $$
BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_score_source') THEN
                CREATE TYPE attempt_score_source AS ENUM ('manual', 'ai_accepted', 'hybrid', 'legacy');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'component_score_source') THEN
                CREATE TYPE component_score_source AS ENUM ('manual', 'ai_accepted', 'legacy');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_evaluation_status') THEN
                CREATE TYPE ai_evaluation_status AS ENUM ('pending', 'running', 'completed', 'failed');
        END IF;
END$$;

CREATE TABLE IF NOT EXISTS grading_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    description       TEXT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    latest_version_no INTEGER NOT NULL DEFAULT 1,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT grading_templates_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT grading_templates_latest_version_min_1 CHECK (latest_version_no >= 1)
);
CREATE INDEX IF NOT EXISTS idx_grading_templates_owner ON grading_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_grading_templates_active ON grading_templates(is_active);

CREATE TABLE IF NOT EXISTS grading_template_versions (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id               UUID NOT NULL REFERENCES grading_templates(id) ON DELETE CASCADE,
    version_no                INTEGER NOT NULL,
    scheme_name               TEXT NULL,
    auto_grading_enabled      BOOLEAN NOT NULL DEFAULT false,
    auto_grading_instructions TEXT NULL,
    created_by_user_id        UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_grading_template_version UNIQUE (template_id, version_no),
    CONSTRAINT grading_template_versions_version_min_1 CHECK (version_no >= 1)
);

CREATE TABLE IF NOT EXISTS grading_template_components (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_version_id UUID NOT NULL REFERENCES grading_template_versions(id) ON DELETE CASCADE,
    component_key       TEXT NOT NULL,
    label               TEXT NOT NULL,
    description         TEXT NULL,
    max_points          NUMERIC(6,2) NOT NULL,
    display_order       INTEGER NOT NULL DEFAULT 0,
    is_auto_gradable    BOOLEAN NOT NULL DEFAULT false,
    manual_only         BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_grading_template_component_key UNIQUE (template_version_id, component_key),
    CONSTRAINT grading_template_components_key_not_empty CHECK (length(trim(component_key)) > 0),
    CONSTRAINT grading_template_components_label_not_empty CHECK (length(trim(label)) > 0),
    CONSTRAINT grading_template_components_points_positive CHECK (max_points > 0),
    CONSTRAINT grading_template_components_display_order_nonneg CHECK (display_order >= 0),
    CONSTRAINT grading_template_components_manual_only_rule CHECK ((manual_only = false) OR (is_auto_gradable = false))
);

CREATE TABLE IF NOT EXISTS grading_template_rubric_levels (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id   UUID NOT NULL REFERENCES grading_template_components(id) ON DELETE CASCADE,
    label         TEXT NOT NULL,
    min_points    NUMERIC(6,2) NOT NULL,
    max_points    NUMERIC(6,2) NOT NULL,
    descriptor    TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT grading_template_rubric_label_not_empty CHECK (length(trim(label)) > 0),
    CONSTRAINT grading_template_rubric_descriptor_not_empty CHECK (length(trim(descriptor)) > 0),
    CONSTRAINT grading_template_rubric_min_nonneg CHECK (min_points >= 0),
    CONSTRAINT grading_template_rubric_range_valid CHECK (max_points >= min_points),
    CONSTRAINT grading_template_rubric_display_order_nonneg CHECK (display_order >= 0)
);

CREATE TABLE IF NOT EXISTS task_grading_scheme_versions (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                    UUID NOT NULL REFERENCES roadmap_assessment_tasks(id) ON DELETE CASCADE,
    version_no                 INTEGER NOT NULL,
    scheme_name                TEXT NULL,
    source_template_version_id UUID NULL REFERENCES grading_template_versions(id) ON DELETE SET NULL,
    auto_grading_enabled       BOOLEAN NOT NULL DEFAULT false,
    auto_grading_instructions  TEXT NULL,
    created_by_user_id         UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_task_grading_scheme_version UNIQUE (task_id, version_no),
    CONSTRAINT task_grading_scheme_versions_version_min_1 CHECK (version_no >= 1)
);

CREATE TABLE IF NOT EXISTS task_grading_components (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_version_id UUID NOT NULL REFERENCES task_grading_scheme_versions(id) ON DELETE CASCADE,
    component_key     TEXT NOT NULL,
    label             TEXT NOT NULL,
    description       TEXT NULL,
    max_points        NUMERIC(6,2) NOT NULL,
    display_order     INTEGER NOT NULL DEFAULT 0,
    is_auto_gradable  BOOLEAN NOT NULL DEFAULT false,
    manual_only       BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_task_grading_component_key UNIQUE (scheme_version_id, component_key),
    CONSTRAINT task_grading_components_key_not_empty CHECK (length(trim(component_key)) > 0),
    CONSTRAINT task_grading_components_label_not_empty CHECK (length(trim(label)) > 0),
    CONSTRAINT task_grading_components_points_positive CHECK (max_points > 0),
    CONSTRAINT task_grading_components_display_order_nonneg CHECK (display_order >= 0),
    CONSTRAINT task_grading_components_manual_only_rule CHECK ((manual_only = false) OR (is_auto_gradable = false))
);

CREATE TABLE IF NOT EXISTS task_component_rubric_levels (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id   UUID NOT NULL REFERENCES task_grading_components(id) ON DELETE CASCADE,
    label         TEXT NOT NULL,
    min_points    NUMERIC(6,2) NOT NULL,
    max_points    NUMERIC(6,2) NOT NULL,
    descriptor    TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT task_component_rubric_label_not_empty CHECK (length(trim(label)) > 0),
    CONSTRAINT task_component_rubric_descriptor_not_empty CHECK (length(trim(descriptor)) > 0),
    CONSTRAINT task_component_rubric_min_nonneg CHECK (min_points >= 0),
    CONSTRAINT task_component_rubric_range_valid CHECK (max_points >= min_points),
    CONSTRAINT task_component_rubric_display_order_nonneg CHECK (display_order >= 0)
);

CREATE TABLE IF NOT EXISTS attempt_ai_evaluations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id            UUID NOT NULL REFERENCES enrollment_task_results(id) ON DELETE CASCADE,
    status                ai_evaluation_status NOT NULL DEFAULT 'pending',
    trigger_source        TEXT NULL,
    provider              TEXT NULL,
    model_name            TEXT NULL,
    overall_confidence    NUMERIC(5,4) NULL,
    suggested_total_score NUMERIC(6,2) NULL,
    raw_response_json     JSONB NULL,
    error_text            TEXT NULL,
    started_at            TIMESTAMPTZ NULL,
    completed_at          TIMESTAMPTZ NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT attempt_ai_eval_confidence_range CHECK ((overall_confidence IS NULL) OR (overall_confidence >= 0 AND overall_confidence <= 1)),
    CONSTRAINT attempt_ai_eval_total_nonneg CHECK ((suggested_total_score IS NULL) OR (suggested_total_score >= 0))
);

CREATE TABLE IF NOT EXISTS attempt_ai_component_suggestions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id   UUID NOT NULL REFERENCES attempt_ai_evaluations(id) ON DELETE CASCADE,
    component_id    UUID NOT NULL REFERENCES task_grading_components(id) ON DELETE CASCADE,
    suggested_score NUMERIC(6,2) NOT NULL,
    confidence      NUMERIC(5,4) NULL,
    rationale       TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_attempt_ai_component_suggestion UNIQUE (evaluation_id, component_id),
    CONSTRAINT attempt_ai_component_suggestion_score_nonneg CHECK (suggested_score >= 0),
    CONSTRAINT attempt_ai_component_suggestion_confidence_range CHECK ((confidence IS NULL) OR (confidence >= 0 AND confidence <= 1))
);

CREATE TABLE IF NOT EXISTS attempt_component_scores (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id         UUID NOT NULL REFERENCES enrollment_task_results(id) ON DELETE CASCADE,
    component_id       UUID NOT NULL REFERENCES task_grading_components(id) ON DELETE CASCADE,
    score              NUMERIC(6,2) NOT NULL,
    feedback           TEXT NULL,
    source             component_score_source NOT NULL DEFAULT 'manual',
    created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_attempt_component_score UNIQUE (attempt_id, component_id),
    CONSTRAINT attempt_component_score_nonneg CHECK (score >= 0)
);

ALTER TABLE IF EXISTS roadmap_assessment_tasks
    ADD COLUMN IF NOT EXISTS current_grading_scheme_version_id UUID;

ALTER TABLE IF EXISTS enrollment_task_results
    ADD COLUMN IF NOT EXISTS score_source attempt_score_source NULL,
    ADD COLUMN IF NOT EXISTS grading_scheme_version_id UUID NULL,
    ADD COLUMN IF NOT EXISTS latest_ai_evaluation_id UUID NULL,
    ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS submission_text TEXT NULL;

DO $$
BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_roadmap_tasks_current_grading_scheme_version') THEN
                ALTER TABLE roadmap_assessment_tasks
                    ADD CONSTRAINT fk_roadmap_tasks_current_grading_scheme_version
                    FOREIGN KEY (current_grading_scheme_version_id) REFERENCES task_grading_scheme_versions(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_enrollment_task_results_grading_scheme_version') THEN
                ALTER TABLE enrollment_task_results
                    ADD CONSTRAINT fk_enrollment_task_results_grading_scheme_version
                    FOREIGN KEY (grading_scheme_version_id) REFERENCES task_grading_scheme_versions(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_enrollment_task_results_latest_ai_evaluation') THEN
                ALTER TABLE enrollment_task_results
                    ADD CONSTRAINT fk_enrollment_task_results_latest_ai_evaluation
                    FOREIGN KEY (latest_ai_evaluation_id) REFERENCES attempt_ai_evaluations(id) ON DELETE SET NULL;
        END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_current_scheme ON roadmap_assessment_tasks(current_grading_scheme_version_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_task_scheme ON enrollment_task_results(grading_scheme_version_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_task_latest_ai_eval ON enrollment_task_results(latest_ai_evaluation_id);

INSERT INTO task_grading_scheme_versions (id, task_id, version_no, scheme_name, auto_grading_enabled, created_at)
SELECT gen_random_uuid(), t.id, 1, t.title, false, now()
FROM roadmap_assessment_tasks t
WHERE NOT EXISTS (SELECT 1 FROM task_grading_scheme_versions s WHERE s.task_id = t.id);

INSERT INTO task_grading_components (
    id, scheme_version_id, component_key, label, description, max_points, display_order, is_auto_gradable, manual_only, created_at
)
SELECT gen_random_uuid(), s.id, 'overall', 'Overall', NULL, t.max_score, 0, false, false, now()
FROM task_grading_scheme_versions s
JOIN roadmap_assessment_tasks t ON t.id = s.task_id
WHERE NOT EXISTS (SELECT 1 FROM task_grading_components c WHERE c.scheme_version_id = s.id)
  AND (t.rubric_json IS NULL OR t.rubric_json = '{}'::jsonb);

INSERT INTO task_grading_components (
    id, scheme_version_id, component_key, label, description, max_points, display_order, is_auto_gradable, manual_only, created_at
)
SELECT
    gen_random_uuid(),
    s.id,
    lower(regexp_replace(trim(kv.key), '[^a-zA-Z0-9]+', '_', 'g')),
    trim(kv.key),
    NULL,
    NULLIF(kv.value, '')::NUMERIC(6,2),
    ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY kv.key) - 1,
    false,
    false,
    now()
FROM task_grading_scheme_versions s
JOIN roadmap_assessment_tasks t ON t.id = s.task_id
CROSS JOIN LATERAL jsonb_each_text(t.rubric_json) kv
WHERE NOT EXISTS (SELECT 1 FROM task_grading_components c WHERE c.scheme_version_id = s.id)
  AND t.rubric_json IS NOT NULL
  AND t.rubric_json <> '{}'::jsonb;

UPDATE roadmap_assessment_tasks t
SET current_grading_scheme_version_id = s.id
FROM task_grading_scheme_versions s
WHERE s.task_id = t.id
  AND s.version_no = 1
  AND t.current_grading_scheme_version_id IS NULL;

UPDATE enrollment_task_results etr
SET grading_scheme_version_id = t.current_grading_scheme_version_id,
    finalized_at = COALESCE(etr.finalized_at, etr.graded_at),
    score_source = COALESCE(etr.score_source, CASE WHEN etr.score IS NOT NULL THEN 'legacy'::attempt_score_source ELSE NULL END)
FROM roadmap_assessment_tasks t
WHERE t.id = etr.task_id
  AND etr.grading_scheme_version_id IS NULL;

INSERT INTO attempt_component_scores (
    id, attempt_id, component_id, score, feedback, source, created_by_user_id, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    etr.id,
    c.id,
    NULLIF(kv.value, '')::NUMERIC(6,2),
    NULL,
    'legacy'::component_score_source,
    etr.graded_by_user_id,
    COALESCE(etr.graded_at, etr.created_at, now()),
    COALESCE(etr.updated_at, now())
FROM enrollment_task_results etr
JOIN task_grading_components c ON c.scheme_version_id = etr.grading_scheme_version_id
CROSS JOIN LATERAL jsonb_each_text(COALESCE(etr.rubric_scores_json, '{}'::jsonb)) kv
WHERE etr.rubric_scores_json IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM attempt_component_scores acs WHERE acs.attempt_id = etr.id)
  AND (
      lower(c.label) = lower(trim(kv.key))
      OR lower(c.component_key) = lower(regexp_replace(trim(kv.key), '[^a-zA-Z0-9]+', '_', 'g'))
  );

INSERT INTO attempt_component_scores (
    id, attempt_id, component_id, score, feedback, source, created_by_user_id, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    etr.id,
    c.id,
    etr.score,
    NULL,
    'legacy'::component_score_source,
    etr.graded_by_user_id,
    COALESCE(etr.graded_at, etr.created_at, now()),
    COALESCE(etr.updated_at, now())
FROM enrollment_task_results etr
JOIN task_grading_components c ON c.scheme_version_id = etr.grading_scheme_version_id
WHERE etr.score IS NOT NULL
  AND lower(c.component_key) = 'overall'
  AND NOT EXISTS (SELECT 1 FROM attempt_component_scores acs WHERE acs.attempt_id = etr.id);

DO $$
BEGIN
        IF to_regclass('public.grading_templates') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grading_templates_updated_at') THEN
                CREATE TRIGGER trg_grading_templates_updated_at
                BEFORE UPDATE ON grading_templates
                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
        IF to_regclass('public.attempt_ai_evaluations') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attempt_ai_evaluations_updated_at') THEN
                CREATE TRIGGER trg_attempt_ai_evaluations_updated_at
                BEFORE UPDATE ON attempt_ai_evaluations
                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
        IF to_regclass('public.attempt_component_scores') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attempt_component_scores_updated_at') THEN
                CREATE TRIGGER trg_attempt_component_scores_updated_at
                BEFORE UPDATE ON attempt_component_scores
                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
END$$;

-- ------------------------------------------------------------
-- Gamification upgrade (kept here so maindb.sql is self-contained)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_gamification_profiles (
    user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp_total             INTEGER NOT NULL DEFAULT 0,
    level                INTEGER NOT NULL DEFAULT 1,
    streak_days          INTEGER NOT NULL DEFAULT 0,
    last_activity_date   TIMESTAMPTZ NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT gamification_profile_xp_nonneg CHECK (xp_total >= 0),
    CONSTRAINT gamification_profile_level_min_1 CHECK (level >= 1),
    CONSTRAINT gamification_profile_streak_nonneg CHECK (streak_days >= 0)
);

CREATE TABLE IF NOT EXISTS student_badges (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_code           TEXT NOT NULL,
    title                TEXT NOT NULL,
    description          TEXT NULL,
    awarded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT student_badges_code_not_empty CHECK (length(trim(badge_code)) > 0),
    CONSTRAINT student_badges_title_not_empty CHECK (length(trim(title)) > 0),
    CONSTRAINT uq_student_badge_user_code UNIQUE (user_id, badge_code)
);

CREATE INDEX IF NOT EXISTS idx_student_badges_user ON student_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_code ON student_badges(badge_code);

DO $$
BEGIN
        IF to_regclass('public.xp_events') IS NULL THEN
                IF to_regclass('public.enrollments') IS NOT NULL THEN
                        EXECUTE '
                                CREATE TABLE xp_events (
                                    id                   BIGSERIAL PRIMARY KEY,
                                    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                    enrollment_id        UUID NULL REFERENCES enrollments(id) ON DELETE SET NULL,
                                    event_type           TEXT NOT NULL,
                                    xp_delta             INTEGER NOT NULL,
                                    reason               TEXT NULL,
                                    metadata_json        JSONB NULL,
                                    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

                                    CONSTRAINT xp_events_type_not_empty CHECK (length(trim(event_type)) > 0),
                                    CONSTRAINT xp_events_delta_nonzero CHECK (xp_delta <> 0)
                                )';
                ELSE
                        EXECUTE '
                                CREATE TABLE xp_events (
                                    id                   BIGSERIAL PRIMARY KEY,
                                    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                    enrollment_id        UUID NULL,
                                    event_type           TEXT NOT NULL,
                                    xp_delta             INTEGER NOT NULL,
                                    reason               TEXT NULL,
                                    metadata_json        JSONB NULL,
                                    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

                                    CONSTRAINT xp_events_type_not_empty CHECK (length(trim(event_type)) > 0),
                                    CONSTRAINT xp_events_delta_nonzero CHECK (xp_delta <> 0)
                                )';
                END IF;
        END IF;

        -- If enrollments exists now (or later rerun), ensure FK is present.
        IF to_regclass('public.enrollments') IS NOT NULL
             AND NOT EXISTS (
                 SELECT 1
                 FROM pg_constraint
                 WHERE conname = 'xp_events_enrollment_id_fkey'
             ) THEN
                ALTER TABLE xp_events
                    ADD CONSTRAINT xp_events_enrollment_id_fkey
                    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL;
        END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_enrollment ON xp_events(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_type ON xp_events(event_type);

DO $$
BEGIN
        IF to_regclass('public.student_gamification_profiles') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_student_gamification_profiles_updated_at') THEN
                CREATE TRIGGER trg_student_gamification_profiles_updated_at
                BEFORE UPDATE ON student_gamification_profiles
                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
END$$;

COMMIT;

-- ------------------------------------------------------------
-- Relationship summary (for your teammate)
-- ------------------------------------------------------------
-- Notification System Tables
-- ------------------------------------------------------------

-- Enum for notification channels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
        CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'push');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type varchar(64) NOT NULL,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    channel notification_channel NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_templates (
    id serial PRIMARY KEY,
    event_type varchar(64) NOT NULL UNIQUE,
    title_template varchar(255) NOT NULL,
    body_template text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    assignment_email boolean NOT NULL DEFAULT true,
    assignment_push boolean NOT NULL DEFAULT true,
    marketing_email boolean NOT NULL DEFAULT true,
    payment_email boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- ------------------------------------------------------------
-- users (1) ── (1) user_profiles
-- users (1) ── (many) auth_sessions
-- users (1) ── (many) chat_sessions
-- chat_sessions (1) ── (many) chat_messages
-- chat_sessions (1) ── (1) memory_state
-- users (1) ── (1) student_gamification_profiles
-- users (1) ── (many) student_badges
-- users (1) ── (many) xp_events
