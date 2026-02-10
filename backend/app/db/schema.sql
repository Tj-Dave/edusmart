-- ============================================================================
-- EDUSMART DATABASE SCHEMA
-- PostgreSQL schema for AI-powered learning assistant
-- Institution: Mbarara University of Science and Technology (MUST)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS TABLE (Authentication + Roles)
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255), -- nullable for LDAP/SSO users
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'lecturer', 'admin')),
    department VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- 2. CAMPUSES TABLE (Institution Branches)
-- ============================================================================
CREATE TABLE campuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255) DEFAULT 'MUST',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_campuses_name ON campuses(name);

-- ============================================================================
-- 3. ACADEMIC_YEARS TABLE (Program Years)
-- ============================================================================
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year_number INT NOT NULL CHECK (year_number BETWEEN 1 AND 4),
    institution VARCHAR(255) DEFAULT 'MUST',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_academic_years_number ON academic_years(year_number);

-- ============================================================================
-- 4. SEMESTERS TABLE (Semester Structure)
-- ============================================================================
CREATE TABLE semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    semester_number INT NOT NULL CHECK (semester_number IN (1, 2)),
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255) DEFAULT 'MUST',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_semesters_number ON semesters(semester_number);

-- ============================================================================
-- 5. COURSES TABLE (CBC-Aligned Courses)
-- Relationships: campus (1->many), year (1->many), semester (1->many)
-- ============================================================================
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    credits INT DEFAULT 3,
    campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
    year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_courses_code ON courses(code);
CREATE INDEX idx_courses_campus ON courses(campus_id);
CREATE INDEX idx_courses_year ON courses(year_id);
CREATE INDEX idx_courses_semester ON courses(semester_id);

-- ============================================================================
-- 6. CHAT_SESSIONS TABLE (Conversation Tracking)
-- Relationships: user (1->many), campus (many->1), year (many->1), 
--                semester (many->1), course (many->1)
-- ============================================================================
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
    year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    title VARCHAR(255),
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_course ON chat_sessions(course_id);
CREATE INDEX idx_chat_sessions_created ON chat_sessions(created_at DESC);

-- ============================================================================
-- 7. CHAT_MESSAGES TABLE (Conversation History)
-- Relationships: session (1->many), user (many->1)
-- ============================================================================
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB, -- Store bloom level, citations, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_role ON chat_messages(role);

-- ============================================================================
-- 8. UPLOADED_CONTENT TABLE (Lecturer Materials for Citations)
-- Relationships: user (many->1, lecturer), course (many->1)
-- ============================================================================
CREATE TABLE uploaded_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    chunk_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    upload_error TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX idx_uploaded_content_user ON uploaded_content(user_id);
CREATE INDEX idx_uploaded_content_course ON uploaded_content(course_id);
CREATE INDEX idx_uploaded_content_status ON uploaded_content(status);
CREATE INDEX idx_uploaded_content_uploaded ON uploaded_content(uploaded_at DESC);

-- ============================================================================
-- 9. LECTURER_PERMISSIONS TABLE (Admin Approval Tracking)
-- Relationships: user (many->1, lecturer), approved_by (many->1, admin)
-- ============================================================================
CREATE TABLE lecturer_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    courses JSONB, -- Array of course IDs this lecturer can upload to
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lecturer_permissions_user ON lecturer_permissions(user_id);
CREATE INDEX idx_lecturer_permissions_approved ON lecturer_permissions(approved);

-- ============================================================================
-- DUMMY DATA INSERTS
-- ============================================================================

-- ============================================================================
-- Insert Campuses
-- ============================================================================
INSERT INTO campuses (id, name, institution, is_active) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'Main Campus', 'MUST', TRUE),
    ('a2222222-2222-2222-2222-222222222222', 'Kabale Campus', 'MUST', TRUE),
    ('a3333333-3333-3333-3333-333333333333', 'Jinja Campus', 'MUST', TRUE);

-- ============================================================================
-- Insert Academic Years
-- ============================================================================
INSERT INTO academic_years (id, year_number, institution, is_active) VALUES
    ('b1111111-1111-1111-1111-111111111111', 1, 'MUST', TRUE),
    ('b2222222-2222-2222-2222-222222222222', 2, 'MUST', TRUE),
    ('b3333333-3333-3333-3333-333333333333', 3, 'MUST', TRUE),
    ('b4444444-4444-4444-4444-444444444444', 4, 'MUST', TRUE);

-- ============================================================================
-- Insert Semesters
-- ============================================================================
INSERT INTO semesters (id, semester_number, name, institution, is_active) VALUES
    ('c1111111-1111-1111-1111-111111111111', 1, 'Semester 1', 'MUST', TRUE),
    ('c2222222-2222-2222-2222-222222222222', 2, 'Semester 2', 'MUST', TRUE);

-- ============================================================================
-- Insert Users (Students, Lecturers, Admin)
-- ============================================================================
INSERT INTO users (id, email, name, password_hash, role, department, is_active) VALUES
    -- Students (MUST emails)
    ('d1111111-1111-1111-1111-111111111111', 'sarah@student.must.ac.ug', 'Sarah Nakabugo', 
     '$2b$12$dXJ3SW6G7P50eS3HHPhpaOlYQVsgbRm.KWNq3XjVfzmIVVeF3HaFm', 'student', 'School of Medicine', TRUE),
    ('d2222222-2222-2222-2222-222222222222', 'john@student.must.ac.ug', 'John Kiwanuka',
     '$2b$12$dXJ3SW6G7P50eS3HHPhpaOlYQVsgbRm.KWNq3XjVfzmIVVeF3HaFm', 'student', 'School of Science', TRUE),
    ('d3333333-3333-3333-3333-333333333333', 'alice@student.must.ac.ug', 'Alice Okoth',
     '$2b$12$dXJ3SW6G7P50eS3HHPhpaOlYQVsgbRm.KWNq3XjVfzmIVVeF3HaFm', 'student', 'School of Science', TRUE),
    
    -- Lecturers (MUST emails, no @student)
    ('e1111111-1111-1111-1111-111111111111', 'dr.akello@must.ac.ug', 'Dr. Akello Okello',
     '$2b$12$dXJ3SW6G7P50eS3HHPhpaOlYQVsgbRm.KWNq3XjVfzmIVVeF3HaFm', 'lecturer', 'School of Medicine', TRUE),
    ('e2222222-2222-2222-2222-222222222222', 'prof.odongo@must.ac.ug', 'Prof. Odongo Mutua',
     '$2b$12$dXJ3SW6G7P50eS3HHPhpaOlYQVsgbRm.KWNq3XjVfzmIVVeF3HaFm', 'lecturer', 'School of Science', TRUE),
    
    -- Admin
    ('f1111111-1111-1111-1111-111111111111', 'admin@must.ac.ug', 'Admin User',
     '$2b$12$dXJ3SW6G7P50eS3HHPhpaOlYQVsgbRm.KWNq3XjVfzmIVVeF3HaFm', 'admin', 'Administration', TRUE);

-- ============================================================================
-- Insert Courses (CBC-Aligned)
-- ============================================================================
INSERT INTO courses (id, code, name, description, credits, campus_id, year_id, semester_id, is_active) VALUES
    -- Year 1, Semester 1
    ('c1111111-1111-1111-1111-111111111111', 'BIO101', 'Cell Biology',
     'Fundamentals of cell structure and function, cellular organelles, and biochemical processes',
     3, 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
     'c1111111-1111-1111-1111-111111111111', TRUE),
    
    ('c1111111-1111-1111-1111-111111111112', 'CHEM101', 'General Chemistry',
     'Basic principles of chemistry, atomic structure, bonding, and chemical reactions',
     3, 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
     'c1111111-1111-1111-1111-111111111111', TRUE),
    
    ('c1111111-1111-1111-1111-111111111113', 'MATH101', 'Calculus I',
     'Functions, limits, derivatives, and applications of derivatives',
     4, 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
     'c1111111-1111-1111-1111-111111111111', TRUE),
    
    -- Year 1, Semester 2
    ('c1111111-1111-1111-1111-111111111114', 'PHY101', 'Physics I - Mechanics',
     'Kinematics, dynamics, work, energy, and rotational motion',
     4, 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
     'c2222222-2222-2222-2222-222222222222', TRUE),
    
    ('c1111111-1111-1111-1111-111111111115', 'CS101', 'Introduction to Computing',
     'Fundamentals of computer science, programming basics, and algorithms',
     3, 'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
     'c2222222-2222-2222-2222-222222222222', TRUE),
    
    -- Year 2, Semester 1
    ('c1111111-1111-1111-1111-111111111116', 'BIO202', 'Microbiology',
     'Structure and function of microorganisms, microbial genetics, and pathogenesis',
     3, 'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222',
     'c1111111-1111-1111-1111-111111111111', TRUE),
    
    ('c1111111-1111-1111-1111-111111111117', 'CHEM202', 'Organic Chemistry',
     'Organic compounds, reaction mechanisms, and synthesis',
     3, 'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222',
     'c1111111-1111-1111-1111-111111111111', TRUE);

-- ============================================================================
-- Insert Chat Sessions (5 sessions across different students/courses)
-- ============================================================================
INSERT INTO chat_sessions (id, user_id, campus_id, year_id, semester_id, course_id, title, is_archived) VALUES
    ('s1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111',
     'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
     'c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
     'Cell Biology Q&A - Mitochondria', FALSE),
    
    ('s2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111',
     'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
     'c2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111115',
     'Introduction to Computing - Arrays', FALSE),
    
    ('s3333333-3333-3333-3333-333333333333', 'd2222222-2222-2222-2222-222222222222',
     'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
     'c2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111114',
     'Physics Mechanics - Newton\'s Laws', FALSE),
    
    ('s4444444-4444-4444-4444-444444444444', 'd2222222-2222-2222-2222-222222222222',
     'a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111',
     'c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111113',
     'Calculus I - Derivatives', TRUE),
    
    ('s5555555-5555-5555-5555-555555555555', 'd3333333-3333-3333-3333-333333333333',
     'a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222',
     'c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111116',
     'Microbiology - Bacterial Growth', FALSE);

-- ============================================================================
-- Insert Chat Messages (User queries + AI responses)
-- ============================================================================
INSERT INTO chat_messages (id, session_id, user_id, role, content, metadata) VALUES
    -- Session 1: Cell Biology - Mitochondria
    ('m1111111-1111-1111-1111-111111111111', 's1111111-1111-1111-1111-111111111111',
     'd1111111-1111-1111-1111-111111111111', 'user',
     'What is the role of mitochondria in cellular respiration?',
     '{"bloom_level": "remember"}'),
    
    ('m1111111-1111-1111-1111-111111111112', 's1111111-1111-1111-1111-111111111111',
     'f1111111-1111-1111-1111-111111111111', 'assistant',
     'Mitochondria is the powerhouse of the cell. It carries out cellular respiration, converting glucose and oxygen into ATP (adenosine triphosphate), which is the energy currency of the cell. This occurs in the inner mitochondrial membrane through the electron transport chain.',
     '{"citations": ["Lecture_Notes_BIO101.pdf"]}'),
    
    ('m1111111-1111-1111-1111-111111111113', 's1111111-1111-1111-1111-111111111111',
     'd1111111-1111-1111-1111-111111111111', 'user',
     'What is the difference between aerobic and anaerobic respiration?',
     '{"bloom_level": "understand"}'),
    
    ('m1111111-1111-1111-1111-111111111114', 's1111111-1111-1111-1111-111111111111',
     'f1111111-1111-1111-1111-111111111111', 'assistant',
     'Aerobic respiration uses oxygen as the final electron acceptor and produces about 36-38 ATP molecules per glucose. Anaerobic respiration occurs without oxygen and produces only 2 ATP molecules per glucose through fermentation. Aerobic respiration is much more efficient.',
     '{"citations": ["Lecture_Notes_BIO101.pdf", "Week3_Slides.pdf"]}'),
    
    -- Session 2: CS101 - Arrays
    ('m2222222-2222-2222-2222-222222222222', 's2222222-2222-2222-2222-222222222222',
     'd1111111-1111-1111-1111-111111111111', 'user',
     'How do I access elements in a Python array?',
     '{"bloom_level": "remember"}'),
    
    ('m2222222-2222-2222-2222-222222222223', 's2222222-2222-2222-2222-222222222222',
     'f1111111-1111-1111-1111-111111111111', 'assistant',
     'In Python, arrays (lists) use zero-based indexing. You access elements using square brackets: arr[0] gets the first element, arr[1] gets the second, etc. You can also use negative indexing: arr[-1] gets the last element, arr[-2] gets the second-to-last.',
     '{"citations": ["CS101_Lecture1.pdf"]}'),
    
    ('m2222222-2222-2222-2222-222222222224', 's2222222-2222-2222-2222-222222222222',
     'd1111111-1111-1111-1111-111111111111', 'user',
     'Can you show me an example of iterating through an array?',
     '{"bloom_level": "understand"}'),
    
    ('m2222222-2222-2222-2222-222222222225', 's2222222-2222-2222-2222-222222222222',
     'f1111111-1111-1111-1111-111111111111', 'assistant',
     'Sure! Here are common ways to iterate:\n1. For loop: for i in range(len(arr)): print(arr[i])\n2. Direct iteration: for element in arr: print(element)\n3. Enumerate: for i, element in enumerate(arr): print(i, element)',
     '{"citations": ["CS101_Lecture2.pdf"]}'),
    
    -- Session 3: Physics - Newton's Laws
    ('m3333333-3333-3333-3333-333333333333', 's3333333-3333-3333-3333-333333333333',
     'd2222222-2222-2222-2222-222222222222', 'user',
     'Can you explain Newton\'s First Law of Motion?',
     '{"bloom_level": "remember"}'),
    
    ('m3333333-3333-3333-3333-333333333334', 's3333333-3333-3333-3333-333333333333',
     'f1111111-1111-1111-1111-111111111111', 'assistant',
     'Newton\'s First Law states that an object at rest stays at rest, and an object in motion stays in motion at constant velocity unless acted upon by an external force. This principle is called inertia.',
     '{"citations": ["Physics_Mechanics_Lecture1.pdf"]}'),
    
    ('m3333333-3333-3333-3333-333333333335', 's3333333-3333-3333-3333-333333333333',
     'd2222222-2222-2222-2222-222222222222', 'user',
     'What is an example of Newton\'s Third Law?',
     '{"bloom_level": "understand"}'),
    
    ('m3333333-3333-3333-3333-333333333336', 's3333333-3333-3333-3333-333333333333',
     'f1111111-1111-1111-1111-111111111111', 'assistant',
     'Newton\'s Third Law states: "For every action, there is an equal and opposite reaction." Examples include:\n- A person jumping: they push down on the ground, ground pushes up on them\n- Swimming: push water backward, water pushes you forward\n- A ball bouncing: ground pushes up on ball, ball pushes down on ground',
     '{"citations": ["Physics_Mechanics_Lecture3.pdf"]}'),
    
    -- Session 4: Calculus - Derivatives
    ('m4444444-4444-4444-4444-444444444444', 's4444444-4444-4444-4444-444444444444',
     'd2222222-2222-2222-2222-222222222222', 'user',
     'What is the derivative of x^3?',
     '{"bloom_level": "apply"}'),
    
    ('m4444444-4444-4444-4444-444444444445', 's4444444-4444-4444-4444-444444444444',
     'f1111111-1111-1111-1111-111111111111', 'assistant',
     'Using the power rule: d/dx(x^n) = n*x^(n-1). For x^3: d/dx(x^3) = 3x^2.',
     '{"citations": ["Calculus_Lecture4.pdf"]}'),
    
    -- Session 5: Microbiology - Bacterial Growth
    ('m5555555-5555-5555-5555-555555555555', 's5555555-5555-5555-5555-555555555555',
     'd3333333-3333-3333-3333-333333333333', 'user',
     'What are the phases of bacterial growth?',
     '{"bloom_level": "remember"}'),
    
    ('m5555555-5555-5555-5555-555555555556', 's5555555-5555-5555-5555-555555555555',
     'f1111111-1111-1111-1111-111111111111', 'assistant',
     'Bacterial growth has four phases:\n1. Lag phase: slow growth, cells adapt to environment\n2. Log/exponential phase: rapid growth, cells divide at maximum rate\n3. Stationary phase: growth plateaus due to nutrient depletion\n4. Death phase: cells die faster than they reproduce',
     '{"citations": ["Microbiology_Lecture5.pdf"]}');

-- ============================================================================
-- Insert Uploaded Content (Lecturer materials)
-- ============================================================================
INSERT INTO uploaded_content (id, user_id, course_id, filename, file_path, file_size, mime_type, chunk_count, status, uploaded_at, processed_at) VALUES
    ('u1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
     'c1111111-1111-1111-1111-111111111111', 'Lecture_Notes_BIO101.pdf',
     '/uploads/lectures/BIO101_notes_2026.pdf', 2048576, 'application/pdf', 45,
     'completed', '2026-02-01 10:30:00', '2026-02-01 10:45:00'),
    
    ('u2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
     'c1111111-1111-1111-1111-111111111111', 'Week3_Slides.pdf',
     '/uploads/lectures/BIO101_week3_slides.pdf', 5242880, 'application/pdf', 120,
     'completed', '2026-02-03 14:15:00', '2026-02-03 14:32:00'),
    
    ('u3333333-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222',
     'c1111111-1111-1111-1111-111111111115', 'CS101_Lecture1.pdf',
     '/uploads/lectures/CS101_intro_lecture.pdf', 3145728, 'application/pdf', 67,
     'completed', '2026-02-02 09:00:00', '2026-02-02 09:18:00'),
    
    ('u4444444-4444-4444-4444-444444444444', 'e2222222-2222-2222-2222-222222222222',
     'c1111111-1111-1111-1111-111111111115', 'CS101_Lecture2.pdf',
     '/uploads/lectures/CS101_arrays_lecture.pdf', 4194304, 'application/pdf', 85,
     'completed', '2026-02-04 11:20:00', '2026-02-04 11:38:00');

-- ============================================================================
-- Insert Lecturer Permissions (Admin approval tracking)
-- ============================================================================
INSERT INTO lecturer_permissions (id, user_id, approved, approved_by, approved_at, courses) VALUES
    ('p1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
     TRUE, 'f1111111-1111-1111-1111-111111111111', '2026-01-15 10:00:00',
     '["c1111111-1111-1111-1111-111111111111", "c1111111-1111-1111-1111-111111111116"]'),
    
    ('p2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222',
     TRUE, 'f1111111-1111-1111-1111-111111111111', '2026-01-20 15:30:00',
     '["c1111111-1111-1111-1111-111111111115", "c1111111-1111-1111-1111-111111111117"]');

-- ============================================================================
-- SCHEMA SUMMARY
-- ============================================================================
-- 9 Tables created with proper relationships:
--   - users (6 dummy records: 3 students, 2 lecturers, 1 admin)
--   - campuses (3 MUST campuses)
--   - academic_years (4 years)
--   - semesters (2 semesters)
--   - courses (7 CBC-aligned courses)
--   - chat_sessions (5 sessions)
--   - chat_messages (14+ messages with citations)
--   - uploaded_content (4 lecturer PDFs)
--   - lecturer_permissions (2 approved lecturers)
--
-- All password hashes are: "password123" (bcrypt)
-- Ready for MVP testing with realistic institution data
-- ============================================================================
