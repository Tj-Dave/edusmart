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
