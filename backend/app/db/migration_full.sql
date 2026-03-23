-- ============================================================
-- EduSmart: Full Schema Migration
-- Covers: courses, course_offerings (with enrollment key),
--         enrollments, enrollment_events,
--         offering_course_specs, offering_roadmap_items,
--         roadmap_assessment_tasks, enrollment_roadmap_progress,
--         enrollment_task_results
-- FK fixes: chat_sessions.course_id, ingested_documents.course_id
-- Safe to re-run — all statements use IF NOT EXISTS / DO $$ guards
-- ============================================================

BEGIN;

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Enums (new — guarded)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_spec_status') THEN
        CREATE TYPE course_spec_status AS ENUM (
            'draft_extracted', 'lecturer_review', 'approved_active', 'archived'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roadmap_item_status') THEN
        CREATE TYPE roadmap_item_status AS ENUM ('draft', 'approved_active', 'archived');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_task_type') THEN
        CREATE TYPE assessment_task_type AS ENUM (
            'quiz', 'assignment', 'lab', 'project',
            'case_study', 'simulation', 'field_task',
            'reflection', 'presentation', 'peer_review', 'other'
        );
    ELSE
        -- Add values added in the practicals upgrade if missing
        ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'case_study';
        ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'simulation';
        ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'field_task';
        ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'reflection';
        ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'presentation';
        ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'peer_review';
        ALTER TYPE assessment_task_type ADD VALUE IF NOT EXISTS 'other';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_scoring_rule') THEN
        CREATE TYPE attempt_scoring_rule AS ENUM ('best', 'latest', 'average', 'first');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_roadmap_status') THEN
        CREATE TYPE enrollment_roadmap_status AS ENUM (
            'not_started', 'in_progress', 'submitted', 'completed', 'blocked', 'skipped'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_task_status') THEN
        CREATE TYPE enrollment_task_status AS ENUM (
            'not_started', 'in_progress', 'submitted', 'graded', 'completed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ingestion_status') THEN
        CREATE TYPE ingestion_status AS ENUM (
            'queued', 'ingesting', 'partial_success', 'success', 'failed'
        );
    END IF;
END$$;

COMMIT;  -- Commit enum changes before using them

BEGIN;

-- ============================================================
-- 1) courses (Text PK: e.g. SWE3101)
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
    course_code     TEXT PRIMARY KEY,
    course_name     TEXT NOT NULL,
    description     TEXT NULL,
    department      TEXT NULL,
    faculty         TEXT NULL,
    level           INTEGER NULL,
    credits         INTEGER NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT courses_code_not_empty CHECK (length(trim(course_code)) > 0),
    CONSTRAINT courses_name_not_empty CHECK (length(trim(course_name)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses(is_active);


-- ============================================================
-- 2) course_offerings
-- ============================================================
CREATE TABLE IF NOT EXISTS course_offerings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code          TEXT NOT NULL REFERENCES courses(course_code) ON DELETE CASCADE,
    term                 TEXT NOT NULL,
    year                 INTEGER NULL,
    cohort               TEXT NULL,
    section              TEXT NULL,
    lecturer_user_id     UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    enrollment_key       TEXT UNIQUE,
    enrollment_key_generated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT course_offerings_term_not_empty CHECK (length(trim(term)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_offerings_identity
    ON course_offerings (
        course_code, term,
        COALESCE(cohort, ''),
        COALESCE(section, '')
    );

CREATE INDEX IF NOT EXISTS idx_course_offerings_course_code ON course_offerings(course_code);
CREATE INDEX IF NOT EXISTS idx_course_offerings_term ON course_offerings(term);
CREATE INDEX IF NOT EXISTS idx_course_offerings_lecturer ON course_offerings(lecturer_user_id);

-- Add enrollment_key columns if table already existed without them
ALTER TABLE IF EXISTS course_offerings
    ADD COLUMN IF NOT EXISTS enrollment_key TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS enrollment_key_generated BOOLEAN NOT NULL DEFAULT FALSE;


-- ============================================================
-- 3) enrollments
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id  UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'active',
    enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at     TIMESTAMPTZ NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT enrollments_status_valid
        CHECK (status IN ('active','dropped','completed','blocked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_unique ON enrollments(offering_id, user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_offering ON enrollments(offering_id);


-- ============================================================
-- 4) enrollment_events (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollment_events (
    id              BIGSERIAL PRIMARY KEY,
    enrollment_id   UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    actor_user_id   UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    note            TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT enrollment_events_type_not_empty CHECK (length(trim(event_type)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_events_enrollment ON enrollment_events(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_events_actor ON enrollment_events(actor_user_id);


-- ============================================================
-- 5) chat_sessions — add course_id FK to courses (guarded)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='chat_sessions' AND column_name='course_id') THEN
        -- Ensure column is TEXT
        ALTER TABLE chat_sessions ALTER COLUMN course_id TYPE TEXT;

        -- Backfill missing course rows from existing chat sessions
        INSERT INTO courses (course_code, course_name)
        SELECT DISTINCT course_id, course_id
        FROM chat_sessions
        WHERE course_id IS NOT NULL
          AND course_id NOT IN (SELECT course_code FROM courses)
        ON CONFLICT (course_code) DO NOTHING;
    ELSE
        ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS course_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_sessions_course'
    ) THEN
        ALTER TABLE chat_sessions
            ADD CONSTRAINT fk_chat_sessions_course
            FOREIGN KEY (course_id) REFERENCES courses(course_code) ON DELETE SET NULL;
    END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_course_id ON chat_sessions(course_id);


-- ============================================================
-- 6) ingested_documents (with course FK)
-- ============================================================
CREATE TABLE IF NOT EXISTS ingested_documents (
    document_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id           TEXT NOT NULL REFERENCES courses(course_code) ON DELETE CASCADE,
    original_filename   TEXT NOT NULL,
    file_hash           VARCHAR(64) NOT NULL,
    size_bytes          BIGINT NULL,
    mime_type           TEXT NULL,
    storage_path        TEXT NULL,
    status              ingestion_status NOT NULL DEFAULT 'queued',
    error_message       TEXT NULL,
    total_chunks        INTEGER NOT NULL DEFAULT 0,
    stored_vectors      INTEGER NOT NULL DEFAULT 0,
    processed_images    INTEGER NOT NULL DEFAULT 0,
    ocr_pending         INTEGER NOT NULL DEFAULT 0,
    ocr_ingested_chunks INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_ingested_doc_course_uploader_hash
        UNIQUE (course_id, uploader_user_id, file_hash)
);
CREATE INDEX IF NOT EXISTS idx_ingested_documents_course_id ON ingested_documents(course_id);
CREATE INDEX IF NOT EXISTS idx_ingested_documents_uploader ON ingested_documents(uploader_user_id);
CREATE INDEX IF NOT EXISTS idx_ingested_documents_status ON ingested_documents(status);
CREATE INDEX IF NOT EXISTS idx_ingested_documents_hash ON ingested_documents(file_hash);

-- If ingested_documents already existed, add FK to courses (guarded)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_ingested_documents_course'
    ) THEN
        ALTER TABLE ingested_documents ALTER COLUMN course_id TYPE TEXT;

        INSERT INTO courses (course_code, course_name)
        SELECT DISTINCT course_id, course_id
        FROM ingested_documents
        WHERE course_id IS NOT NULL
          AND course_id NOT IN (SELECT course_code FROM courses)
        ON CONFLICT (course_code) DO NOTHING;

        ALTER TABLE ingested_documents
            ADD CONSTRAINT fk_ingested_documents_course
            FOREIGN KEY (course_id) REFERENCES courses(course_code) ON DELETE CASCADE;
    END IF;
END$$;


-- ============================================================
-- 7) offering_course_specs
-- ============================================================
CREATE TABLE IF NOT EXISTS offering_course_specs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id  UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    source_document_id  UUID NULL REFERENCES ingested_documents(document_id) ON DELETE SET NULL,
    status              course_spec_status NOT NULL DEFAULT 'draft_extracted',
    spec_json           JSONB NOT NULL DEFAULT '{}',
    created_by_user_id  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at         TIMESTAMPTZ NULL,

    CONSTRAINT offering_course_specs_spec_json_object
        CHECK (jsonb_typeof(spec_json) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_offering_course_specs_offering ON offering_course_specs(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_course_specs_status ON offering_course_specs(status);


-- ============================================================
-- 8) offering_roadmap_items
-- ============================================================
CREATE TABLE IF NOT EXISTS offering_roadmap_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id   UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    spec_id              UUID NULL REFERENCES offering_course_specs(id) ON DELETE SET NULL,
    sequence_no          INTEGER NOT NULL,
    week_no              INTEGER NULL,
    title                TEXT NOT NULL,
    key_content          TEXT NULL,
    teaching_activity    TEXT NULL,
    estimated_hours      NUMERIC(4,1) NULL,
    assessment_task_count INTEGER NOT NULL DEFAULT 0,
    status               roadmap_item_status NOT NULL DEFAULT 'draft',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_offering_roadmap_sequence UNIQUE (course_offering_id, sequence_no),
    CONSTRAINT offering_roadmap_sequence_positive CHECK (sequence_no > 0),
    CONSTRAINT offering_roadmap_week_positive CHECK (week_no IS NULL OR week_no > 0),
    CONSTRAINT offering_roadmap_title_not_empty CHECK (length(trim(title)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_offering_roadmap_offering ON offering_roadmap_items(course_offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_roadmap_status ON offering_roadmap_items(status);


-- ============================================================
-- 9) roadmap_assessment_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS roadmap_assessment_tasks (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roadmap_item_id      UUID NOT NULL REFERENCES offering_roadmap_items(id) ON DELETE CASCADE,
    title                TEXT NOT NULL,
    task_type            assessment_task_type NOT NULL DEFAULT 'assignment',
    description          TEXT NULL,
    instructions         TEXT NULL,
    max_score            NUMERIC(6,2) NOT NULL DEFAULT 100,
    weight               NUMERIC(5,4) NULL,
    attempt_scoring_rule attempt_scoring_rule NOT NULL DEFAULT 'best',
    max_attempts         INTEGER NULL,
    due_date             TIMESTAMPTZ NULL,
    is_required          BOOLEAN NOT NULL DEFAULT TRUE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    display_order        INTEGER NOT NULL DEFAULT 0,
    -- Practicals fields
    practical_brief      TEXT NULL,
    required_tools       TEXT NULL,
    expected_artifact    TEXT NULL,
    safety_notes         TEXT NULL,
    rubric_json          JSONB NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT roadmap_tasks_max_score_pos CHECK (max_score > 0),
    CONSTRAINT roadmap_tasks_title_not_empty CHECK (length(trim(title)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_item ON roadmap_assessment_tasks(roadmap_item_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_active ON roadmap_assessment_tasks(is_active);

-- Add practicals columns if table existed before
ALTER TABLE IF EXISTS roadmap_assessment_tasks
    ADD COLUMN IF NOT EXISTS practical_brief TEXT,
    ADD COLUMN IF NOT EXISTS required_tools TEXT,
    ADD COLUMN IF NOT EXISTS expected_artifact TEXT,
    ADD COLUMN IF NOT EXISTS safety_notes TEXT,
    ADD COLUMN IF NOT EXISTS rubric_json JSONB;


-- ============================================================
-- 10) enrollment_roadmap_progress
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollment_roadmap_progress (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id     UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    roadmap_item_id   UUID NOT NULL REFERENCES offering_roadmap_items(id) ON DELETE CASCADE,
    status            enrollment_roadmap_status NOT NULL DEFAULT 'not_started',
    completion_percent INTEGER NOT NULL DEFAULT 0,
    total_score       NUMERIC(10,4) NULL,
    max_total_score   NUMERIC(10,4) NULL,
    avg_score         NUMERIC(10,4) NULL,
    best_score        NUMERIC(10,4) NULL,
    started_at        TIMESTAMPTZ NULL,
    submitted_at      TIMESTAMPTZ NULL,
    completed_at      TIMESTAMPTZ NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_enrollment_roadmap_progress UNIQUE (enrollment_id, roadmap_item_id),
    CONSTRAINT enrollment_roadmap_completion_range
        CHECK (completion_percent >= 0 AND completion_percent <= 100)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_roadmap_progress_enrollment
    ON enrollment_roadmap_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_roadmap_progress_item
    ON enrollment_roadmap_progress(roadmap_item_id);


-- ============================================================
-- 11) enrollment_task_results (attempts)
-- ============================================================
CREATE TABLE IF NOT EXISTS enrollment_task_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id   UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES roadmap_assessment_tasks(id) ON DELETE CASCADE,
    attempt_no      INTEGER NOT NULL DEFAULT 1,
    status          enrollment_task_status NOT NULL DEFAULT 'not_started',
    score           NUMERIC(6,2) NULL,
    feedback        TEXT NULL,
    evidence_url    TEXT NULL,
    payload         JSONB NULL,
    -- Practicals fields
    artifact_url    TEXT NULL,
    reflection_text TEXT NULL,
    rubric_scores_json JSONB NULL,
    submitted_at    TIMESTAMPTZ NULL,
    graded_at       TIMESTAMPTZ NULL,
    graded_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_enrollment_task_attempt UNIQUE (enrollment_id, task_id, attempt_no),
    CONSTRAINT enrollment_task_attempt_positive CHECK (attempt_no > 0)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_task_results_enrollment
    ON enrollment_task_results(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_task_results_task
    ON enrollment_task_results(task_id);

-- Add practicals columns if table existed before
ALTER TABLE IF EXISTS enrollment_task_results
    ADD COLUMN IF NOT EXISTS artifact_url TEXT,
    ADD COLUMN IF NOT EXISTS reflection_text TEXT,
    ADD COLUMN IF NOT EXISTS rubric_scores_json JSONB;


-- ============================================================
-- Triggers for updated_at on new tables
-- ============================================================
DO $$
BEGIN
    -- courses
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_courses_updated_at') THEN
        CREATE TRIGGER trg_courses_updated_at
        BEFORE UPDATE ON courses
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- course_offerings
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_course_offerings_updated_at') THEN
        CREATE TRIGGER trg_course_offerings_updated_at
        BEFORE UPDATE ON course_offerings
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- enrollments
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enrollments_updated_at') THEN
        CREATE TRIGGER trg_enrollments_updated_at
        BEFORE UPDATE ON enrollments
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- offering_course_specs
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_offering_course_specs_updated_at') THEN
        CREATE TRIGGER trg_offering_course_specs_updated_at
        BEFORE UPDATE ON offering_course_specs
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- offering_roadmap_items
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_offering_roadmap_items_updated_at') THEN
        CREATE TRIGGER trg_offering_roadmap_items_updated_at
        BEFORE UPDATE ON offering_roadmap_items
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- roadmap_assessment_tasks
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_roadmap_assessment_tasks_updated_at') THEN
        CREATE TRIGGER trg_roadmap_assessment_tasks_updated_at
        BEFORE UPDATE ON roadmap_assessment_tasks
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- enrollment_roadmap_progress
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enrollment_roadmap_progress_updated_at') THEN
        CREATE TRIGGER trg_enrollment_roadmap_progress_updated_at
        BEFORE UPDATE ON enrollment_roadmap_progress
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- enrollment_task_results
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enrollment_task_results_updated_at') THEN
        CREATE TRIGGER trg_enrollment_task_results_updated_at
        BEFORE UPDATE ON enrollment_task_results
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- ingested_documents
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ingested_documents_updated_at') THEN
        CREATE TRIGGER trg_ingested_documents_updated_at
        BEFORE UPDATE ON ingested_documents
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

COMMIT;
