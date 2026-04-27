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

-- Extend existing user_role enum for new governance roles.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teaching_assistant';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'department_head';
    END IF;
END$$;

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
-- 1b) institution governance tables
-- ============================================================
CREATE TABLE IF NOT EXISTS institution_settings (
    id                       INTEGER PRIMARY KEY DEFAULT 1,
    university_name          VARCHAR(255) NOT NULL DEFAULT 'EduSmart Institution',
    logo_url                 TEXT NULL,
    academic_calendar_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
    email_policy_mode        VARCHAR(32) NOT NULL DEFAULT 'none',
    allowed_email_domains    JSONB NULL,
    email_whitelist_json     JSONB NULL,
    email_blacklist_json     JSONB NULL,
    rag_model_name           VARCHAR(128) NULL,
    rag_embedding_strategy   VARCHAR(128) NULL,
    rag_last_rebuild_at      TIMESTAMPTZ NULL,
    rag_rebuild_requested_at TIMESTAMPTZ NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT institution_settings_name_not_empty CHECK (length(trim(university_name)) > 0),
    CONSTRAINT institution_settings_email_policy_mode_valid CHECK (email_policy_mode IN ('none','allowlist','denylist')),
    CONSTRAINT institution_settings_calendar_object CHECK (jsonb_typeof(academic_calendar_json) = 'object'),
    CONSTRAINT institution_settings_policy_object CHECK (jsonb_typeof(policy_json) = 'object')
);

INSERT INTO institution_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS faculties (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL UNIQUE,
    code        VARCHAR(64) NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT faculties_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id  UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(64) NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_departments_faculty_name UNIQUE (faculty_id, name),
    CONSTRAINT departments_name_not_empty CHECK (length(trim(name)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_departments_faculty_id ON departments(faculty_id);


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
-- 12) versioned hybrid grading system
-- ============================================================
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
CREATE INDEX IF NOT EXISTS idx_grading_template_versions_template ON grading_template_versions(template_id);

CREATE TABLE IF NOT EXISTS grading_template_components (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_version_id UUID NOT NULL REFERENCES grading_template_versions(id) ON DELETE CASCADE,
    component_key     TEXT NOT NULL,
    label             TEXT NOT NULL,
    description       TEXT NULL,
    max_points        NUMERIC(6,2) NOT NULL,
    display_order     INTEGER NOT NULL DEFAULT 0,
    is_auto_gradable  BOOLEAN NOT NULL DEFAULT false,
    manual_only       BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_grading_template_component_key UNIQUE (template_version_id, component_key),
    CONSTRAINT grading_template_components_key_not_empty CHECK (length(trim(component_key)) > 0),
    CONSTRAINT grading_template_components_label_not_empty CHECK (length(trim(label)) > 0),
    CONSTRAINT grading_template_components_points_positive CHECK (max_points > 0),
    CONSTRAINT grading_template_components_display_order_nonneg CHECK (display_order >= 0),
    CONSTRAINT grading_template_components_manual_only_rule CHECK ((manual_only = false) OR (is_auto_gradable = false))
);
CREATE INDEX IF NOT EXISTS idx_grading_template_components_version ON grading_template_components(template_version_id);

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
CREATE INDEX IF NOT EXISTS idx_grading_template_rubric_component ON grading_template_rubric_levels(component_id);

CREATE TABLE IF NOT EXISTS task_grading_scheme_versions (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                   UUID NOT NULL REFERENCES roadmap_assessment_tasks(id) ON DELETE CASCADE,
    version_no                INTEGER NOT NULL,
    scheme_name               TEXT NULL,
    source_template_version_id UUID NULL REFERENCES grading_template_versions(id) ON DELETE SET NULL,
    auto_grading_enabled      BOOLEAN NOT NULL DEFAULT false,
    auto_grading_instructions TEXT NULL,
    created_by_user_id        UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_task_grading_scheme_version UNIQUE (task_id, version_no),
    CONSTRAINT task_grading_scheme_versions_version_min_1 CHECK (version_no >= 1)
);
CREATE INDEX IF NOT EXISTS idx_task_grading_scheme_versions_task ON task_grading_scheme_versions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_grading_scheme_versions_template ON task_grading_scheme_versions(source_template_version_id);

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
CREATE INDEX IF NOT EXISTS idx_task_grading_components_scheme ON task_grading_components(scheme_version_id);

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
CREATE INDEX IF NOT EXISTS idx_task_component_rubric_component ON task_component_rubric_levels(component_id);

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
CREATE INDEX IF NOT EXISTS idx_attempt_ai_evaluations_attempt ON attempt_ai_evaluations(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_ai_evaluations_status ON attempt_ai_evaluations(status);

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
CREATE INDEX IF NOT EXISTS idx_attempt_ai_component_suggestions_eval ON attempt_ai_component_suggestions(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_attempt_ai_component_suggestions_component ON attempt_ai_component_suggestions(component_id);

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
CREATE INDEX IF NOT EXISTS idx_attempt_component_scores_attempt ON attempt_component_scores(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_component_scores_component ON attempt_component_scores(component_id);

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
WHERE NOT EXISTS (
    SELECT 1 FROM task_grading_scheme_versions s WHERE s.task_id = t.id
);

INSERT INTO task_grading_components (
    id, scheme_version_id, component_key, label, description, max_points, display_order, is_auto_gradable, manual_only, created_at
)
SELECT
    gen_random_uuid(),
    s.id,
    'overall',
    'Overall',
    NULL,
    t.max_score,
    0,
    false,
    false,
    now()
FROM task_grading_scheme_versions s
JOIN roadmap_assessment_tasks t ON t.id = s.task_id
WHERE NOT EXISTS (
    SELECT 1 FROM task_grading_components c WHERE c.scheme_version_id = s.id
)
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
WHERE NOT EXISTS (
    SELECT 1 FROM task_grading_components c WHERE c.scheme_version_id = s.id
)
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

    -- grading_templates
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grading_templates_updated_at') THEN
        CREATE TRIGGER trg_grading_templates_updated_at
        BEFORE UPDATE ON grading_templates
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- attempt_ai_evaluations
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attempt_ai_evaluations_updated_at') THEN
        CREATE TRIGGER trg_attempt_ai_evaluations_updated_at
        BEFORE UPDATE ON attempt_ai_evaluations
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- attempt_component_scores
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attempt_component_scores_updated_at') THEN
        CREATE TRIGGER trg_attempt_component_scores_updated_at
        BEFORE UPDATE ON attempt_component_scores
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- ingested_documents
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ingested_documents_updated_at') THEN
        CREATE TRIGGER trg_ingested_documents_updated_at
        BEFORE UPDATE ON ingested_documents
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- institution_settings
    IF to_regclass('public.institution_settings') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_institution_settings_updated_at') THEN
        CREATE TRIGGER trg_institution_settings_updated_at
        BEFORE UPDATE ON institution_settings
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- faculties
    IF to_regclass('public.faculties') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_faculties_updated_at') THEN
        CREATE TRIGGER trg_faculties_updated_at
        BEFORE UPDATE ON faculties
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;

    -- departments
    IF to_regclass('public.departments') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_departments_updated_at') THEN
        CREATE TRIGGER trg_departments_updated_at
        BEFORE UPDATE ON departments
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END$$;

COMMIT;
