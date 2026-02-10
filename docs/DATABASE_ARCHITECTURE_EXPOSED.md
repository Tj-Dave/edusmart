# EduSmart Database Architecture - Complete Exposure

## Executive Summary

**Current State:** ❌ **DATABASE IS NOT CONNECTED**

The backend has a complete PostgreSQL schema defined but is **NOT ACTUALLY USING IT**. All authentication and admin operations are running on **hardcoded in-memory data** (TEST_ACCOUNTS dictionary). The database infrastructure exists but is dormant.

---

## 1. DATABASE INFRASTRUCTURE (Defined but Unused)

### 1.1 Connection Layer
**File:** `backend/app/db/postgres.py`

```python
engine = create_engine(
    settings.DATABASE_URL,      # ← EMPTY! No .env file exists
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """FastAPI dependency that yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Status:** 
- ✅ Connection code written and ready
- ❌ No DATABASE_URL configured
- ❌ No .env file created
- ❌ get_db() dependency never used in auth/admin routes

---

### 1.2 ORM Models (Complete Schema Defined)
**File:** `backend/app/db/models.py` (249 lines)

#### User Table
```python
class User(Base):
    __tablename__ = "users"
    
    # Primary Key
    id: UUID (auto-generated)
    
    # Authentication
    username: str (unique, required)
    password_hash: Optional[str]
    auth_provider: "local" | "google"
    google_sub: Optional[str] (for OAuth)
    
    # Profile
    email: Optional[str] (unique, required for local auth)
    role: "student" | "lecturer" | "admin"
    
    # Lecturer Workflow
    approved: bool (default=False) ← NEWLY ADDED
    is_active: bool (default=True)
    
    # Timestamps
    created_at: datetime (auto)
    updated_at: datetime (auto)
    
    # Check Constraint
    (auth_provider='local') REQUIRES (password_hash IS NOT NULL)
```

**Real Comparison vs In-Memory:**

| Field | Database Model | TEST_ACCOUNTS |
|-------|---|---|
| username | ✅ UUID primary key | ❌ Uses email as key |
| password_hash | ✅ Hashed (planned) | ❌ Plaintext "password123" |
| role | ✅ Enum (student/lecturer/admin) | ✅ Enum (student/lecturer/admin) |
| approved | ✅ Boolean field | ✅ Field in dict |
| is_active | ✅ Boolean field | ❌ Not in TEST_ACCOUNTS |
| google_sub | ✅ OAuth support | ❌ No OAuth in test data |

#### UserProfile Table (1:1 with User)
```python
class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    user_id: UUID (Foreign Key → users.id)
    full_name: Optional[str]
    university_id: Optional[str]
    department: Optional[str]
    faculty: Optional[str]
    program: Optional[str]
    year_of_study: Optional[int]
    courses: Optional[str] ← NEWLY ADDED (comma-separated)
    phone: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime
    updated_at: datetime
```

**Real Data:** TEST_ACCOUNTS has `full_name` and `courses` embedded, but not structured fields.

#### AuthSession Table (For Refresh Tokens)
```python
class AuthSession(Base):
    __tablename__ = "auth_sessions"
    
    id: UUID (primary key)
    user_id: UUID (Foreign Key)
    refresh_token_hash: str
    created_at: datetime
```

**Real Data:** No refresh token support in current implementation.

#### Chat Tables (For Message History)
**Defined but not examined closely:**
- `ChatSession` - user chat sessions
- `ChatMessage` - individual messages
- `MemoryState` - summarization tracking

**Real Data:** No chat persistence in auth routes yet.

---

## 2. DATABASE UTILITIES (Written But Unused)

### 2.1 CRUD Operations for Users
**File:** `backend/app/db/crud_users.py` (166 lines)

**Functions Defined:**
```python
def get_user_by_id(db, user_id) → Optional[User]
def get_user_by_username(db, username) → Optional[User]
def get_user_by_email(db, email) → Optional[User]

def create_user_local(
    db, username, password, role, email, full_name, 
    university_id, department, faculty, program, 
    year_of_study, phone
) → User

def authenticate_local(db, username, password) → Optional[User]
```

**Problem:** These functions are **NOT IMPORTED OR CALLED** anywhere in auth_demo.py or admin.py

### 2.2 CRUD Operations for Chats
**File:** `backend/app/db/crud_chats.py` (103 lines)

**Functions Defined:**
```python
def create_chat_session(db, user_id, title) → ChatSession
def list_chat_sessions(db, user_id, include_archived) → List[ChatSession]
def get_chat_session(db, user_id, session_id) → Optional[ChatSession]
def rename_chat_session(db, user_id, session_id, title) → ChatSession
def set_chat_archived(db, user_id, session_id, is_archived) → ChatSession
def delete_chat_session(db, user_id, session_id) → None
def list_messages(db, user_id, session_id, limit) → List[ChatMessage]
def create_message(db, user_id, session_id, role, content) → ChatMessage
```

**Problem:** These functions are **NOT IMPORTED OR CALLED** anywhere in the project yet.

---

## 3. VECTOR STORE (For RAG / Document Retrieval)

**File:** `backend/app/db/vector_store.py` (80+ lines)

**What It Does:**
- Uses ChromaDB (CPU-friendly embeddings database)
- Stores embeddings in `data/chroma_db/` directory
- Supports multiple collections (documents, memories, etc.)

**Core Methods:**
```python
def add_documents(texts, embeddings, metadatas) → None
def query(query_embedding, n_results=5) → Dict

# Generic methods:
def add_texts(collection, texts, embeddings, metadatas, ids) → None
def query_embeddings(collection, query_embeddings, n_results, where) → Dict
```

**Real Usage:** ✅ Used by ingestion pipeline (`services/ingestion/`)

**Status:** ✅ **WORKING** (for RAG pipeline)

---

## 4. METADATA STORE

**File:** `backend/app/db/metadata_store.py`

**Status:** ❌ **EMPTY FILE** - No implementation yet

---

## 5. CURRENT AUTHENTICATION FLOW (In-Memory)

**File:** `backend/app/routes/auth_demo.py`

### 5.1 TEST_ACCOUNTS Dictionary
```python
TEST_ACCOUNTS = {
    "sarah@student.must.ac.ug": {
        "password": "password123",
        "role": UserRole.student,
        "full_name": "Sarah Nakato",
        "approved": True,
    },
    "moses@student.must.ac.ug": {
        "password": "password123",
        "role": UserRole.student,
        "full_name": "Moses Mukama",
        "approved": True,
    },
    "dr.akello@must.ac.ug": {
        "password": "password123",
        "role": UserRole.lecturer,
        "full_name": "Dr. Akello",
        "approved": True,
        "courses": "CS101,CS201",
    },
    "dr.namukasa@must.ac.ug": {
        "password": "password123",
        "role": UserRole.lecturer,
        "full_name": "Dr. Namukasa",
        "approved": False,
        "courses": "CS102",
    },
    "prof.okello@must.ac.ug": {
        "password": "password123",
        "role": UserRole.lecturer,
        "full_name": "Prof. Okello",
        "approved": True,
        "courses": "CS301,CS401",
    },
    "admin@must.ac.ug": {
        "password": "password123",
        "role": UserRole.admin,
        "full_name": "Admin User",
        "approved": True,
    },
}
```

**Data Flow:** 
```
User Login → auth_demo.py:login() 
    ↓
checks TEST_ACCOUNTS dict (in RAM)
    ↓
returns JWT token with hardcoded user data
    ↓
Frontend stores token, uses for auth
```

**Problem:** Zero persistence. All data lost when server restarts.

### 5.2 JWT Generation
```python
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(email: str, role: str) -> str:
    """Generate JWT token with hardcoded 30-min expiration"""
    payload = {
        "sub": email,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=30)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
```

**Status:** ✅ **WORKING** (but SECRET_KEY hardcoded)

---

## 6. ADMIN OPERATIONS (All In-Memory)

**File:** `backend/app/routes/admin.py`

### 6.1 Get Lecturers
```python
@router.get("/admin/lecturers")
def get_lecturers(authorization: str = Header(None)):
    """Returns all lecturers from TEST_ACCOUNTS (filtered by role)"""
    # Extracts from TEST_ACCOUNTS, builds response
    # NO DATABASE QUERY
```

### 6.2 Approve/Revoke Lecturer
```python
@router.patch("/admin/lecturers/{email}")
def manage_lecturer(email: str, action: AdminAction):
    """Modifies TEST_ACCOUNTS dict directly"""
    # NO DATABASE UPDATE
    # Changes lost on server restart
```

### 6.3 View Analytics
```python
@router.get("/admin/analytics")
def get_analytics():
    """Counts users in TEST_ACCOUNTS"""
    return {
        "total_students": len([...]),
        "total_lecturers": len([...]),
        "approved_lecturers": len([...]),
        "pending_lecturers": len([...]),
        # chat_count, message_count = 0
    }
```

### 6.4 Import Users
```python
@router.post("/admin/import")
def import_users(payload: ImportPayload):
    """Adds to TEST_ACCOUNTS dict"""
    for user in payload.data:
        TEST_ACCOUNTS[user.email] = {
            "password": user.password,
            "role": user.role,
            "full_name": user.full_name,
        }
    # NO DATABASE INSERT
    # Data lost on server restart
```

---

## 7. DEPENDENCY INJECTION (Configured But Unused)

**How FastAPI get_db() Should Work:**
```python
# In routes
@router.get("/users/{email}")
def get_user(email: str, db: Session = Depends(get_db)):
    """db session automatically injected"""
    user = crud_users.get_user_by_email(db, email)
    return user
```

**Current Reality:**
```python
# In auth_demo.py
@router.post("/auth/login")
def login(request: LoginRequest):
    """NO db parameter! Uses TEST_ACCOUNTS directly"""
    if request.email in TEST_ACCOUNTS:
        # ...
    # get_db() is imported but NEVER CALLED
```

---

## 8. DATABASE FILES (Metadata)

**SQL Schema Files (For Reference):**

| File | Purpose | Status |
|------|---------|--------|
| `backend/app/db/schema.sql` | PostgreSQL DDL statements | ✅ Reference |
| `backend/app/db/maindb.sql` | Alternative schema | ✅ Reference |
| `backend/app/db/setup_database.py` | Migration/setup script | ⏳ Unused |

---

## 9. CONFIGURATION ISSUES

**File:** `backend/app/core/config.py`

```python
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
```

**Problems:**
1. ❌ No `.env` file exists
2. ❌ DATABASE_URL defaults to empty string
3. ❌ Would crash if postgres.py tried to create engine with empty URL
4. ❌ No error checking before using settings.DATABASE_URL

**Required Setup:**
```bash
# Create backend/.env file
DATABASE_URL="postgresql://user:password@localhost:5432/edusmart"
SECRET_KEY="your-production-secret-key-here"
```

---

## 10. SUMMARY TABLE

| Component | Type | Status | Used In | Problem |
|-----------|------|--------|---------|---------|
| **User Model** | ORM | ✅ Defined | Nowhere | Not instantiated |
| **UserProfile Model** | ORM | ✅ Defined | Nowhere | Not instantiated |
| **AuthSession Model** | ORM | ✅ Defined | Nowhere | Not instantiated |
| **Chat Models** | ORM | ✅ Defined | Partially (RAG) | Incomplete |
| **postgres.py** | Connection | ✅ Written | Never | DATABASE_URL empty |
| **get_db()** | Dependency | ✅ Written | Never | Never imported |
| **crud_users.py** | CRUD | ✅ Written | Never | Never imported |
| **crud_chats.py** | CRUD | ✅ Written | Partially | Not in auth |
| **VectorStore** | Embedding DB | ✅ Working | RAG Pipeline | Separate from User DB |
| **TEST_ACCOUNTS** | Dict | ✅ Working | auth_demo.py, admin.py | In-memory only |
| **JWT Auth** | Security | ✅ Working | auth_demo.py | No DB refresh tokens |
| **Admin Endpoints** | Routes | ✅ Working | Frontend | No persistence |

---

## 11. DATA FLOW ARCHITECTURE

### Current Flow (In-Memory)
```
┌─────────────┐
│  Frontend   │
│   (React)   │
└──────┬──────┘
       │ POST /auth/login (email, password)
       ↓
┌──────────────────┐
│  auth_demo.py    │
└──────┬───────────┘
       │ Check TEST_ACCOUNTS dict
       ↓
┌──────────────────┐
│   TEST_ACCOUNTS  │  ← In RAM Memory
│   (Dict)         │     Lost on restart
└──────┬───────────┘
       │ Create JWT token
       ↓
┌─────────────────┐
│  JWT Response   │
│ (token + user)  │
└────────────────┘
```

### Expected Flow (With Database)
```
┌─────────────┐
│  Frontend   │
│   (React)   │
└──────┬──────┘
       │ POST /auth/login (email, password)
       ↓
┌──────────────────┐
│  auth_demo.py    │
└──────┬───────────┘
       │ get_db() dependency injection
       ↓
┌──────────────────┐
│  postgres.py     │
│  (SQLAlchemy)    │
└──────┬───────────┘
       │ CREATE SESSION
       ↓
┌──────────────────┐
│  PostgreSQL      │  ← Persistent Database
│  User Table      │     Survives restarts
└──────┬───────────┘
       │ Query user by email
       ↓
┌──────────────────┐
│  crud_users.py   │
│  authenticate()  │
└──────┬───────────┘
       │ Verify password hash
       ↓
┌──────────────────┐
│  JWT + User      │
│  Response        │
└────────────────┘
```

---

## 12. WHAT NEEDS TO HAPPEN

### Step 1: Setup PostgreSQL
```bash
# Install PostgreSQL (if not installed)
sudo apt-get install postgresql postgresql-contrib

# Create database
createdb edusmart

# Create .env file
cat > backend/.env << EOF
DATABASE_URL="postgresql://postgres:password@localhost:5432/edusmart"
SECRET_KEY="$(openssl rand -hex 32)"
EOF
```

### Step 2: Run Migrations
```bash
# Create tables from models.py
python backend/app/db/setup_database.py

# Or manually run schema:
psql edusmart < backend/app/db/schema.sql
```

### Step 3: Update auth_demo.py
**Replace TEST_ACCOUNTS usage with database queries:**

```python
# BEFORE (current)
@router.post("/auth/login")
def login(request: LoginRequest):
    if request.email in TEST_ACCOUNTS:
        user_data = TEST_ACCOUNTS[request.email]
        # ...

# AFTER (with DB)
@router.post("/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = crud_users.get_user_by_email(db, request.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not crud_users.authenticate_local(db, user.username, request.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # ...
```

### Step 4: Update admin.py
**Replace TEST_ACCOUNTS modifications with database updates:**

```python
# BEFORE (current)
TEST_ACCOUNTS[email]["approved"] = True

# AFTER (with DB)
user = crud_users.get_user_by_email(db, email)
user.approved = True
db.commit()
```

### Step 5: Test Integration
```bash
# Start backend
cd backend && uvicorn app.main:app --reload --port 5000

# Try login
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

---

## 13. SECURITY IMPLICATIONS

**Current State (In-Memory):**
- ❌ Plaintext passwords in TEST_ACCOUNTS
- ❌ No password hashing
- ❌ JWT SECRET_KEY hardcoded ("your-secret-key-change-this-in-production")
- ❌ No refresh tokens
- ❌ No password history
- ✅ Token expiration works (30 min)

**With Database:**
- ✅ Password hashing (bcrypt)
- ✅ SECRET_KEY from environment
- ✅ Refresh token support
- ✅ Password change history
- ✅ Session invalidation
- ✅ Audit logging possible

---

## 14. PERSISTENCE GAPS

| Feature | Current | With DB |
|---------|---------|---------|
| User creation | ❌ Only TEST_ACCOUNTS | ✅ Persistent |
| Login | ✅ Works (in-memory) | ✅ Works (persisted) |
| Password change | ⏳ Endpoint exists, does nothing | ✅ Updates hash |
| Lecturer approval | ✅ Works (in-memory) | ✅ Persisted |
| User import | ✅ Adds to TEST_ACCOUNTS (lost on restart) | ✅ Persisted |
| Analytics | ✅ Counts TEST_ACCOUNTS | ✅ Real counts + history |
| Chat history | ❌ Not stored | ✅ Full persistence |
| Embeddings | ✅ ChromaDB (separate) | ✅ ChromaDB (separate) |

---

## Conclusion

**The database layer is like a built house with no one living in it.** All the infrastructure exists (models, CRUD functions, connection code), but the authentication and admin routes ignore it completely, preferring to manipulate an in-memory dictionary that disappears on every server restart.

**To make it production-ready in ~2 hours:**
1. Setup PostgreSQL + .env
2. Run migrations  
3. Replace TEST_ACCOUNTS lookups with DB queries in auth_demo.py
4. Replace TEST_ACCOUNTS mutations with DB updates in admin.py
5. Test end-to-end

