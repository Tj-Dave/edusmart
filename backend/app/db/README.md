# EduSmart Database Schema

Complete PostgreSQL database schema for the EduSmart AI-powered learning assistant platform.

## 📋 Tables Overview

### 1. **users**
Authentication and user management for students, lecturers, and admins.

```sql
Columns:
- id (UUID, PK) - Unique identifier
- email (VARCHAR, UNIQUE) - User email (MUST domain)
- name (VARCHAR) - Full name
- password_hash (VARCHAR) - Bcrypt hashed password
- role (VARCHAR) - student | lecturer | admin
- department (VARCHAR) - Department/faculty affiliation
- is_active (BOOLEAN) - Account status
- created_at (TIMESTAMP) - Account creation date
- updated_at (TIMESTAMP) - Last update

Indices: email, role
```

**Test Users (all password: "password123")**
- Students: sarah@student.must.ac.ug, john@student.must.ac.ug, alice@student.must.ac.ug
- Lecturers: dr.akello@must.ac.ug, prof.odongo@must.ac.ug
- Admin: admin@must.ac.ug

---

### 2. **campuses**
Institution branches/locations.

```sql
Columns:
- id (UUID, PK)
- name (VARCHAR) - Campus name
- institution (VARCHAR) - Default: "MUST"
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

Dummy Data:
- Main Campus
- Kabale Campus
- Jinja Campus
```

---

### 3. **academic_years**
Program years (1-4).

```sql
Columns:
- id (UUID, PK)
- year_number (INT) - 1-4
- institution (VARCHAR) - Default: "MUST"
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

Dummy Data: Years 1, 2, 3, 4
```

---

### 4. **semesters**
Academic semesters.

```sql
Columns:
- id (UUID, PK)
- semester_number (INT) - 1 or 2
- name (VARCHAR) - e.g., "Semester 1"
- institution (VARCHAR) - Default: "MUST"
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

Dummy Data: Semester 1, Semester 2
```

---

### 5. **courses**
CBC-aligned courses.

```sql
Columns:
- id (UUID, PK)
- code (VARCHAR, UNIQUE) - Course code (e.g., BIO101)
- name (VARCHAR) - Course name
- description (TEXT) - Course description
- credits (INT) - Credit hours
- campus_id (FK → campuses)
- year_id (FK → academic_years)
- semester_id (FK → semesters)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

Indices: code, campus_id, year_id, semester_id

Dummy Courses:
- BIO101 (Cell Biology)
- CHEM101 (General Chemistry)
- MATH101 (Calculus I)
- PHY101 (Physics I - Mechanics)
- CS101 (Introduction to Computing)
- BIO202 (Microbiology)
- CHEM202 (Organic Chemistry)
```

---

### 6. **chat_sessions**
Conversation sessions between students and AI.

```sql
Columns:
- id (UUID, PK)
- user_id (FK → users) - Student
- campus_id (FK → campuses)
- year_id (FK → academic_years)
- semester_id (FK → semesters)
- course_id (FK → courses)
- title (VARCHAR) - Session title
- is_archived (BOOLEAN) - Archive status
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indices: user_id, course_id, created_at DESC

Relationships:
- 1 user → many sessions
- 1 course → many sessions
```

---

### 7. **chat_messages**
Message history within sessions.

```sql
Columns:
- id (UUID, PK)
- session_id (FK → chat_sessions) - Parent session
- user_id (FK → users) - Message author
- role (VARCHAR) - "user" | "assistant"
- content (TEXT) - Message content
- metadata (JSONB) - bloom_level, citations, etc.
- created_at (TIMESTAMP)

Indices: session_id, user_id, role

Sample Metadata:
{
  "bloom_level": "remember",
  "citations": ["Lecture_Notes_BIO101.pdf", "Week3_Slides.pdf"]
}
```

---

### 8. **uploaded_content**
Lecturer-uploaded learning materials for citation.

```sql
Columns:
- id (UUID, PK)
- user_id (FK → users) - Lecturer who uploaded
- course_id (FK → courses)
- filename (VARCHAR) - Original filename
- file_path (VARCHAR) - Storage path
- file_size (BIGINT) - Bytes
- mime_type (VARCHAR) - e.g., "application/pdf"
- chunk_count (INT) - Chunks for vector embeddings
- status (VARCHAR) - "processing" | "completed" | "failed"
- upload_error (TEXT) - Error message if failed
- uploaded_at (TIMESTAMP)
- processed_at (TIMESTAMP)

Indices: user_id, course_id, status, uploaded_at DESC

Dummy Files:
- Lecture_Notes_BIO101.pdf (2.0 MB, 45 chunks)
- Week3_Slides.pdf (5.0 MB, 120 chunks)
- CS101_Lecture1.pdf (3.0 MB, 67 chunks)
- CS101_Lecture2.pdf (4.0 MB, 85 chunks)
```

---

### 9. **lecturer_permissions**
Admin approval tracking for lecturer uploads.

```sql
Columns:
- id (UUID, PK)
- user_id (FK → users) - Lecturer
- approved (BOOLEAN) - Approval status
- approved_by (FK → users) - Admin who approved
- approved_at (TIMESTAMP)
- courses (JSONB) - Array of course IDs lecturer can upload to
- rejection_reason (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indices: user_id, approved

Dummy Permissions:
- Dr. Akello: Approved for BIO101, BIO202
- Prof. Odongo: Approved for CS101, CHEM202
```

---

## 🚀 Setup Instructions

### Option 1: Using Python Script (Recommended)

```bash
# Set environment variables (optional, defaults to localhost)
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=password
export DB_NAME=edusmart

# Run the setup script from db folder
cd backend/app/db
python setup_database.py
```

### Option 2: Manual SQL Setup

```bash
# Create database
createdb edusmart

# Load schema
psql -U postgres -d edusmart -f backend/app/db/schema.sql

# Verify setup
psql -d edusmart -c "\dt"  # List tables
psql -d edusmart -c "SELECT COUNT(*) FROM users;"  # Check users
```

### Option 3: Using pgAdmin or DBeaver

1. Create new database: `edusmart`
2. Open Query Tool
3. Copy-paste entire `schema.sql` file
4. Execute

---

## 📊 Test Data Summary

| Table | Records | Purpose |
|-------|---------|---------|
| users | 6 | 3 students, 2 lecturers, 1 admin |
| campuses | 3 | MUST locations |
| academic_years | 4 | Years 1-4 |
| semesters | 2 | Semester 1 & 2 |
| courses | 7 | CBC-aligned courses |
| chat_sessions | 5 | Active learning sessions |
| chat_messages | 14+ | Sample Q&A with AI |
| uploaded_content | 4 | Lecturer PDFs |
| lecturer_permissions | 2 | Approval records |

---

## 🔑 Key Features

### ✅ Relationships
- **Cascading deletes** for user data (sessions, messages, uploads)
- **Restrict deletes** for institutional data (campuses, courses) to maintain referential integrity
- **Foreign key constraints** ensure data consistency

### ✅ Indexing Strategy
- Primary keys on all tables
- Fast lookups on frequently queried fields (email, role, course_id, user_id)
- Reverse chronological ordering for chat/upload timestamps

### ✅ JSONB Support
- Flexible metadata storage for messages (Bloom level, citations)
- Course arrays in lecturer permissions
- Future extensibility without schema migrations

### ✅ Data Integrity
- UUID primary keys for distributed systems
- Timestamps with auto-defaults (created_at, updated_at)
- Boolean flags for status tracking (is_active, is_archived, approved)
- Check constraints on enum-like fields (role, status)

---

## 💾 Backend Integration

### Connection String Format
```
postgresql://[user]:[password]@[host]:[port]/[database]

Example:
postgresql://postgres:password@localhost:5432/edusmart
```

### Environment Variables
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/edusmart
DB_ECHO=False  # Set to True for SQL query logging in development
```

### SQLAlchemy Example
```python
from sqlalchemy import create_engine

DATABASE_URL = "postgresql://postgres:password@localhost:5432/edusmart"
engine = create_engine(DATABASE_URL)
```

---

## 🧪 Verification Queries

```sql
-- List all courses with their campus, year, semester
SELECT 
    c.code, c.name, ca.name as campus, ay.year_number, s.name as semester
FROM courses c
JOIN campuses ca ON c.campus_id = ca.id
JOIN academic_years ay ON c.year_id = ay.id
JOIN semesters s ON c.semester_id = s.id
ORDER BY ay.year_number, s.semester_number, c.code;

-- View chat history for a specific session
SELECT 
    u.name, cm.role, cm.content, cm.created_at
FROM chat_messages cm
JOIN users u ON cm.user_id = u.id
WHERE cm.session_id = 's1111111-1111-1111-1111-111111111111'
ORDER BY cm.created_at;

-- List lecturer materials with upload status
SELECT 
    u.name, uc.filename, uc.status, uc.chunk_count, uc.uploaded_at
FROM uploaded_content uc
JOIN users u ON uc.user_id = u.id
ORDER BY uc.uploaded_at DESC;

-- Check approved lecturers and their course access
SELECT 
    u.name, lp.approved, lp.courses
FROM lecturer_permissions lp
JOIN users u ON lp.user_id = u.id
WHERE lp.approved = TRUE;
```

---

## 🔐 Security Notes

⚠️ **Dummy Data Alert**: Password hashes in dummy data are `bcrypt("password123")`
- **DO NOT** use in production
- Always hash passwords with strong algorithms
- Implement password complexity requirements
- Use environment variables for database credentials

---

## 📝 Notes for Development

1. **User Roles**
   - `student`: Access to chat, course selection
   - `lecturer`: Upload content, view analytics
   - `admin`: User management, institution config

2. **Email Domains**
   - Students: `*@student.must.ac.ug`
   - Staff: `*@must.ac.ug`
   - Used for role determination

3. **Status Values**
   - `uploaded_content.status`: Must be "processing", "completed", or "failed"
   - `chat_sessions.is_archived`: For session cleanup
   - `lecturer_permissions.approved`: Two-step approval workflow

4. **Extensibility**
   - JSONB columns allow schema-less data storage
   - Add new metadata fields without migrations
   - Example: bloom_level, difficulty, tags in messages

---

## 🆘 Troubleshooting

**Error: "database already exists"**
```bash
psql -U postgres -d edusmart -f backend/app/db/schema.sql  # Reconnect to existing DB
```

**Error: "permission denied"**
```bash
psql -U postgres  # Run as postgres superuser
```

**Error: "column does not exist"**
```bash
psql -d edusmart -c "\d [table_name]"  # Inspect table structure
```

---

## 📚 Related Files

- **Backend Routes**: `/backend/app/routes/` - API endpoints
- **Metadata Store**: `/backend/app/db/metadata_store.py` - Database queries
- **Vector Store**: `/backend/app/db/vector_store.py` - Vector embeddings
- **Tests**: `/backend/tests/` - Unit & integration tests

---

**Last Updated**: February 2026
**Database Version**: PostgreSQL 14+
