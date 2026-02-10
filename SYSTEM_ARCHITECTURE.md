# EduSmart: Complete System Architecture Guide

**Version**: 1.0  
**Date**: February 2026  
**Institution**: Mbarara University of Science and Technology (MUST)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Setup & Configuration Guide](#setup--configuration-guide)

---

## System Overview

EduSmart is an **AI-powered educational assistant** built on a modern **RAG (Retrieval-Augmented Generation)** architecture. It combines:

- **Frontend**: React 18 + TypeScript with modern UI
- **Backend**: FastAPI with Python
- **Databases**: PostgreSQL (relational) + ChromaDB (vector)
- **LLM**: Local Llama.cpp inference (privacy-first)
- **Embeddings**: E5Embedder for semantic search

### Key Features
✅ Multi-role authentication (Student, Lecturer, Admin)  
✅ Course-aware chat interface  
✅ Document ingestion & semantic search  
✅ Bloom's taxonomy level detection  
✅ Learning outcome mapping  
✅ Long-term conversation memory  
✅ Local LLM inference (no external API)  

---

# Frontend Architecture

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | React | 18.2.0 |
| **Language** | TypeScript | 5.3.3 |
| **Build Tool** | Vite | 5.0.12 |
| **HTTP Client** | Axios | 1.6.7 |
| **State Management** | Zustand | 4.4.7 |
| **Routing** | React Router | 6.22.0 |
| **Styling** | Tailwind CSS | 3.4.1 |
| **Auth Token Decoder** | jwt-decode | 4.0.0 |
| **UUID Generator** | uuid | 9.0.1 |

## Project Structure

```
frontend/react-app/
├── src/
│   ├── App.tsx                 # Main router & private route guards
│   ├── main.tsx               # Vite entry point
│   ├── index.css              # Global styles
│   ├── components/
│   │   ├── CourseSelector.tsx  # Campus/Year/Semester/Course selection
│   │   ├── MessageBubble.tsx   # Chat message display
│   │   └── Sidebar.tsx         # Navigation sidebar
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── ChatPage.tsx        # Main chat interface
│   │   ├── UploadPage.tsx      # Document upload for lecturers
│   │   ├── AdminDashboard.tsx
│   │   ├── SetPasswordPage.tsx # Initial password setup
│   │   ├── LecturerPendingPage.tsx
│   │   └── CourseSelectionPage.tsx
│   ├── layout/
│   │   └── MainLayout.tsx      # App wrapper with sidebar
│   ├── services/
│   │   ├── apiClient.ts        # Axios instance with interceptors
│   │   └── apiService.ts       # API endpoint functions
│   ├── state/
│   │   └── AuthContext.tsx     # Authentication state & JWT management
│   ├── hooks/
│   │   └── index.ts            # Custom React hooks
│   ├── stores/
│   │   └── institutionStore.ts # Institution config (campus, courses, etc.)
│   └── utils/
│       └── [utility functions]
├── package.json
├── vite.config.js
├── tsconfig.json
├── tailwind.config.js
└── index.html
```

## Authentication Flow

### JWT Token Management

```
1. User Login
   ├─ POST /api/auth/login (email, password)
   └─ Response: { access_token: "jwt_token", user: {...} }

2. Token Storage
   ├─ localStorage.setItem("auth_token", token)
   └─ AuthContext manages token state

3. Request Interceptor
   ├─ Every HTTP request automatically adds:
   │  Authorization: Bearer {token}
   └─ Token read from localStorage

4. Response Interceptor
   ├─ If 401 Unauthorized:
   │  ├─ Clear localStorage
   │  └─ Redirect to /login
   └─ If 403 Forbidden: Log permission error

5. Private Routes
   ├─ <PrivateRoute> wrapper checks:
   │  ├─ Auth status (checking | authenticated | unauthenticated)
   │  ├─ User role (student | lecturer | admin)
   │  ├─ Course selection (for students)
   │  └─ Loading spinner while checking
   └─ Redirect to /login if unauthorized
```

### Key Files

**[apiClient.ts](frontend/react-app/src/services/apiClient.ts)**
```typescript
const apiClient = axios.create({
  baseURL: "http://localhost:8001",
  timeout: 12000,
});

// Request: Add JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response: Handle 401 logout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

**[AuthContext.tsx](frontend/react-app/src/state/AuthContext.tsx)**
- Manages `status` (checking | authenticated | unauthenticated)
- Stores `user` object with role, email, profile
- Provides `useAuth()` hook for components

## Data Retrieval Strategy

### API Service Calls

**[apiService.ts](frontend/react-app/src/services/apiService.ts)** exports:

```typescript
// Auth
loginUser(email, password)
setPassword(password)

// Chat Operations
createChat(campus, year, semester, courseCode)
sendMessage(chatId, query, bloomLevel?, courseCode?, semester?, year?)
getChatHistory(chatId)

// File Upload
uploadFile(file, onProgress?)

// Institution Config
fetchInstitutionConfig()
  → Returns: { campuses, years, semesters, courses }

// Lecturer Status
checkLecturerUploadStatus(lecturerId)
```

### Message Flow Example

```
User enters chat query → ChatPage component
    ↓
Call: sendMessage(chatId, "What is calculus?")
    ↓
Axios POST /api/chats/{chatId}/messages
    {
      query: "What is calculus?",
      bloom_level: undefined,
      course_code: localStorage.selected_course
    }
    ↓
Backend processes (see AI Pipeline below)
    ↓
Response:
    {
      response: "Calculus is...",
      bloom_level: "understand",
      competency: "MATH101",
      source_documents: [...]
    }
    ↓
Frontend renders in MessageBubble
    └─ User sees assistant response + metadata
```

## Key Components

### ChatPage
- Displays chat history (fetched on mount)
- Input field for user queries
- Message bubbles (user/assistant)
- Sidebar with chat list
- Course selector dropdown

### CourseSelector
- Dropdown: Campus → Year → Semester → Course
- Stores selected course in localStorage
- Used for course-specific RAG retrieval

### LoginPage
- Email/password form
- Handles login state
- Redirects to course selection on success

### UploadPage (Lecturer-only)
- File upload for course materials
- Progress tracking
- Processes documents for ingestion

---

# Backend Architecture

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | FastAPI | 0.128.0 |
| **Server** | Uvicorn | (included) |
| **Language** | Python | 3.x |
| **ORM** | SQLAlchemy | 2.0+ |
| **PostgreSQL Driver** | psycopg2 | - |
| **Vector DB** | ChromaDB | 1.4.1 |
| **LLM** | llama-cpp-python | - |
| **Embeddings** | sentence-transformers (E5) | - |
| **Auth** | PyJWT, bcrypt | 2.8.1, 5.0.0 |
| **Async** | asyncio, httptools | - |

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app initialization & service instantiation
│   ├── core/
│   │   ├── config.py        # Settings & environment variables
│   │   ├── auth.py          # JWT creation/validation
│   │   └── logging.py       # Structured logging
│   ├── db/
│   │   ├── base.py          # SQLAlchemy Base class
│   │   ├── models.py        # ORM models (User, ChatSession, etc.)
│   │   ├── postgres.py      # Database connection & session manager
│   │   ├── vector_store.py  # ChromaDB wrapper class
│   │   ├── crud_chats.py    # Chat CRUD operations
│   │   ├── crud_users.py    # User CRUD operations
│   │   ├── metadata_store.py# Metadata storage for documents
│   │   ├── schema.sql       # SQL schema (reference)
│   │   └── setup_database.py# Database initialization script
│   ├── routes/
│   │   ├── ai_query.py      # POST /api/chats/{id}/messages - AI pipeline
│   │   ├── chats.py         # CRUD endpoints for chat sessions
│   │   ├── auth_demo.py     # Authentication endpoints
│   │   ├── admin.py         # Admin-only endpoints
│   │   ├── ingestion.py     # Document upload & processing
│   │   ├── health.py        # Health check endpoint
│   │   └── _dev_auth_dependency.py # Auth middleware (uses X-User-Id header for dev)
│   ├── models/
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── chat_schemas.py  # Chat-specific schemas
│   │   └── enums.py         # Enums (UserRole, MessageRole, etc.)
│   ├── services/
│   │   ├── bloom_detector.py      # Bloom's taxonomy detection
│   │   ├── competency_mapper.py   # Learning outcome mapping
│   │   ├── rag_engine.py          # RAG retrieval logic
│   │   ├── prompt_engine.py       # Prompt construction
│   │   ├── multiQuery.py          # Query variant generation
│   │   ├── auth/                  # Authentication services
│   │   ├── embedder/              # E5Embedder wrapper
│   │   │   └── e5_embedder.py
│   │   ├── ingestion/             # Document processing pipeline
│   │   ├── llm/                   # LLM clients
│   │   │   ├── llama_cpp_client.py      # Main LLM
│   │   │   └── llama_cpp_subclient.py   # Secondary LLM
│   │   └── memory/                # Memory management
│   │       └── memory_manager.py
│   ├── utils/
│   │   ├── file_utils.py
│   │   ├── text_processing.py
│   │   ├── bloom_cbc_map.csv      # Bloom ↔ CBC competency mapping
│   │   ├── CBC_embed.py
│   │   ├── cbc_embeddings.npy
│   │   └── cbc_metadata.csv
│   └── tests/
│       ├── test_bloom_detector.py
│       ├── test_competency_mapper.py
│       └── test_phi_cpp.py
├── requirements.txt
├── init_db.py              # Database initialization script
└── test_server.py          # Quick server test
```

## Service Architecture

### Main Application Bootstrap ([main.py](backend/app/main.py))

All services are initialized **once at startup** and stored in `app.state`:

```python
app = FastAPI(title="EduSmart Backend")

# Initialize singleton services
llm_client = LLMClient()                    # Main LLM (Llama.cpp)
llm_subclient = LLMSubclient()              # Secondary LLM for variants
multi_query_service = MultiQuery()          # Query decomposition

vector_store = VectorStore()                # ChromaDB wrapper
embedder = E5Embedder(device="cpu")        # Semantic embeddings
competency_mapper = CompetencyMapper()      # CBC mapping
bloom_detector = BloomDetector()            # Taxonomy detection
rag_engine = RAGEngine()                    # Retrieval logic
memory_manager = MemoryManagerPG()          # Long-term memory

# Store in app.state for access in routes
app.state.llm_client = llm_client
app.state.llm_subclient = llm_subclient
app.state.embedder = embedder
app.state.rag_engine = rag_engine
# ... etc

# Include routers
app.include_router(ai_query_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(chats_router)
```

### Core Services

**1. LLMClient (Llama.cpp)**
- Local inference using `llama-cpp-python`
- Generates AI responses
- CPU/GPU optimized
- Privacy-preserving (no external API calls)

**2. E5Embedder**
- Converts text → 768-dimensional vectors
- CPU-friendly inference
- Used for both query and document embedding
- Enables semantic search in ChromaDB

**3. VectorStore (ChromaDB)**
- Persistent vector database
- Collections: `documents`, `memories`
- Supports metadata filtering
- Efficient similarity search

**4. RAGEngine**
- Retrieves relevant documents from ChromaDB
- Performs similarity search
- Formats results for prompt

**5. BloomDetector**
- Classifies query by Bloom's level:
  - Remember
  - Understand
  - Apply
  - Analyze
  - Evaluate
  - Create

**6. CompetencyMapper**
- Maps queries to CBC (Competency-Based Curriculum) learning outcomes
- Uses embeddings + fuzzy matching
- Links to institutional learning objectives

**7. MemoryManagerPG**
- Stores conversation summaries in PostgreSQL
- Retrieves relevant past context
- Manages long-term student learning history

---

# Data Flow Diagrams

## 1. User Message to AI Response Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  User types: "Explain photosynthesis in detail"                  │
│  ↓                                                                │
│  ChatPage.tsx calls:                                             │
│  sendMessage(chatId, "Explain photosynthesis...", ...)          │
│  ↓                                                                │
│  Axios adds JWT token + sends POST request                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP
         POST /api/chats/{chatId}/messages
         Headers: Authorization: Bearer {jwt_token}
         Body: { query: "...", course_code: "BIO101" }
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI - ai_query.py)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ Step 1: STORE USER MESSAGE ─────────────────────┐           │
│  │ crud_chats.append_message(                        │           │
│  │   db, user_id, session_id,                        │           │
│  │   role="user", content="Explain photosynthesis"   │           │
│  │ )                                                  │           │
│  │ → INSERT into chat_messages table                 │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌─ Step 2: RETRIEVE MEMORY ────────────────────────┐           │
│  │ memory_manager.build_context_pack(                │           │
│  │   db, user_id, session_id, query                  │           │
│  │ )                                                  │           │
│  │ → Queries PostgreSQL for:                         │           │
│  │   - Recent chat messages                          │           │
│  │   - Relevant long-term memories (from ChromaDB)   │           │
│  │ → Returns: { recent_messages: [...],              │           │
│  │             relevant_memories: [...] }            │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌─ Step 3: DETECT BLOOM LEVEL ─────────────────────┐           │
│  │ bloom_detector.detect(                            │           │
│  │   "Explain photosynthesis in detail"              │           │
│  │ )                                                  │           │
│  │ → Returns: "understand" (or apply, analyze, etc.) │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌─ Step 4: MAP TO COMPETENCIES ────────────────────┐           │
│  │ competency_mapper.map(query)                      │           │
│  │ → Returns: "BIO_L2_01" (CBC competency code)      │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌─ Step 5: RAG RETRIEVE ───────────────────────────┐           │
│  │ 1. Embed query:                                   │           │
│  │    query_embedding = embedder.embed_query(        │           │
│  │      "Explain photosynthesis in detail"           │           │
│  │    )                                               │           │
│  │    → 768-dim vector                               │           │
│  │                                                    │           │
│  │ 2. Search ChromaDB:                               │           │
│  │    context_chunks = rag_engine.retrieve(query)   │           │
│  │    → ChromaDB similarity search (cosine distance) │           │
│  │    → Top 5-10 chunks from "documents" collection  │           │
│  │    → With metadata: source, page, course, etc.    │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌─ Step 6: BUILD PROMPT ───────────────────────────┐           │
│  │ final_prompt = PromptEngine.build_prompt(         │           │
│  │   query="Explain photosynthesis...",              │           │
│  │   bloom_level="understand",                       │           │
│  │   competency="BIO_L2_01",                         │           │
│  │   context=context_chunks,                         │           │
│  │   memory=memory_block                             │           │
│  │ )                                                  │           │
│  │                                                    │           │
│  │ Final prompt includes:                            │           │
│  │ - System instructions (CBC-aligned)               │           │
│  │ - Retrieved document context                      │           │
│  │ - Recent conversation history                     │           │
│  │ - Long-term memory summaries                      │           │
│  │ - User query                                      │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌─ Step 7: LLM INFERENCE ──────────────────────────┐           │
│  │ response_text = await llm_client.generate(        │           │
│  │   final_prompt                                    │           │
│  │ )                                                  │           │
│  │ → Llama.cpp processes prompt (local inference)    │           │
│  │ → Returns: "Photosynthesis is the process..."     │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌─ Step 8: STORE ASSISTANT MESSAGE ────────────────┐           │
│  │ crud_chats.append_message(                        │           │
│  │   db, user_id, session_id,                        │           │
│  │   role="assistant", content=response_text         │           │
│  │ )                                                  │           │
│  │ → INSERT into chat_messages table                 │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌─ Step 9: UPDATE MEMORY STATE ────────────────────┐           │
│  │ memory_manager.update_memory(                     │           │
│  │   db, user_id, session_id,                        │           │
│  │   recent_messages=[...],                          │           │
│  │   response=response_text                          │           │
│  │ )                                                  │           │
│  │ → Summarize conversation if needed                │           │
│  │ → Store in ChromaDB memories collection           │           │
│  │ → Update memory_state.last_summarized_message_id  │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
│  ┌─ Step 10: RETURN RESPONSE ───────────────────────┐           │
│  │ return {                                           │           │
│  │   "response": "Photosynthesis is...",             │           │
│  │   "bloom_level": "understand",                    │           │
│  │   "competency": "BIO_L2_01",                      │           │
│  │   "source_documents": [                           │           │
│  │     { "source": "Lecture 3", "content": "..." }   │           │
│  │   ]                                                │           │
│  │ }                                                  │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP
              Response: 200 OK + JSON payload
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  ChatPage.tsx receives response                                  │
│  ↓                                                                │
│  Updates state with assistant message                           │
│  ↓                                                                │
│  MessageBubble renders:                                         │
│  - Response text: "Photosynthesis is the process..."            │
│  - Metadata: Bloom level, competency, source docs              │
│  ↓                                                                │
│  User sees answer in chat interface                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Document Upload to RAG Pipeline

```
┌──────────────────────────────┐
│   Lecturer uploads PDF       │
│   "Biology Lecture 3.pdf"    │
└──────────────────────────────┘
          ↓
┌──────────────────────────────────────────────────────┐
│   Frontend UploadPage.tsx                            │
│   POST /api/ingest/upload                           │
│   Headers: Content-Type: multipart/form-data        │
│   Body: file=<binary>                                │
└──────────────────────────────────────────────────────┘
          ↓
┌──────────────────────────────────────────────────────┐
│   Backend ingestion.py                               │
│                                                      │
│   1. Parse PDF → Extract text chunks               │
│   2. For each chunk:                                │
│      - Embed: E5Embedder.embed_texts([chunk])       │
│      - Store metadata: source, page, course_code    │
│      - Add to ChromaDB "documents" collection       │
│                                                      │
│   3. Update metadata store in PostgreSQL            │
│      INSERT INTO document_metadata (...)             │
│                                                      │
│   4. Return: { success: true, chunks_stored: 50 }   │
└──────────────────────────────────────────────────────┘
          ↓
    ChromaDB "documents" collection now contains:
    
    id_50: {
      text: "Photosynthesis is the process...",
      embedding: [0.12, -0.45, 0.89, ...],  // 768-dim
      metadata: {
        source: "Biology Lecture 3.pdf",
        page: 5,
        course_code: "BIO101",
        uploaded_at: "2026-02-10T10:30:00Z"
      }
    }
    
          ↓
    (Later) When student queries "Explain photosynthesis":
    
    1. Embed query → [0.13, -0.44, 0.88, ...]
    2. ChromaDB cosine similarity search
    3. Return: id_50 (high similarity score 0.98)
    4. RAG retrieves: full text + metadata
    5. Include in prompt context
```

## 3. Authentication Flow

```
┌──────────────────────────┐
│   User logs in           │
│   email: user@must.ac.ug │
│   password: ****         │
└──────────────────────────┘
          ↓
┌──────────────────────────────────────────┐
│  Frontend: LoginPage                     │
│  POST /api/auth/login                    │
│  { email, password }                     │
└──────────────────────────────────────────┘
          ↓
┌──────────────────────────────────────────────────────────┐
│  Backend: auth_demo.py                                   │
│                                                           │
│  1. Query PostgreSQL:                                    │
│     user = db.query(User).filter(email=...)              │
│                                                           │
│  2. Verify password:                                     │
│     bcrypt.verify(password, user.password_hash)          │
│     → Match: continue                                    │
│     → Mismatch: raise HTTPException(401)                 │
│                                                           │
│  3. Create JWT token:                                    │
│     token = jwt.encode({                                 │
│       "user_id": uuid,                                   │
│       "role": "student",                                 │
│       "email": email,                                    │
│       "exp": now + 24h                                   │
│     }, SECRET_KEY, algorithm="HS256")                    │
│                                                           │
│  4. Return response:                                     │
│     {                                                    │
│       "access_token": "eyJhbGciOiJI...",                 │
│       "token_type": "bearer",                            │
│       "user": {                                          │
│         "id": uuid,                                      │
│         "email": email,                                  │
│         "role": "student",                               │
│         "profile": {...}                                 │
│       }                                                  │
│     }                                                    │
└──────────────────────────────────────────────────────────┘
          ↓
┌──────────────────────────────────────────────────┐
│  Frontend: AuthContext                           │
│                                                  │
│  1. Receive response                             │
│  2. Store token: localStorage.setItem(           │
│       "auth_token", access_token                 │
│     )                                            │
│  3. Update auth state: { status: "authenticated",│
│       user: {...} }                              │
│  4. Redirect to /course-selection                │
│                                                  │
└──────────────────────────────────────────────────┘
          ↓
┌──────────────────────────────────────────────────┐
│  Future Requests:                                │
│                                                  │
│  1. Axios interceptor extracts token from        │
│     localStorage                                 │
│                                                  │
│  2. Adds to request:                             │
│     Authorization: Bearer eyJhbGciOiJI...        │
│                                                  │
│  3. Backend verifies JWT:                        │
│     payload = jwt.decode(token, SECRET_KEY)      │
│     → Valid: extract user_id, proceed            │
│     → Invalid: raise HTTPException(401)          │
│     → Expired: Frontend catches 401, logout      │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

# Database Schema

## Core Tables

### 1. `users` - User Accounts

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,  -- NULL for SSO/Google users
    
    role user_role NOT NULL,  -- student | lecturer | admin
    auth_provider auth_provider DEFAULT 'local',  -- local | google
    
    google_sub TEXT UNIQUE,  -- Google OAuth subject ID
    email TEXT UNIQUE,
    
    is_active BOOLEAN DEFAULT TRUE,
    approved BOOLEAN DEFAULT FALSE,  -- Lecturer approval workflow
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    CONSTRAINT users_password_required_for_local 
        CHECK ((auth_provider <> 'local') OR (password_hash IS NOT NULL))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_username ON users(username);
```

**Relationships**:
- 1:1 → `user_profiles`
- 1:N → `chat_sessions`
- 1:N → `chat_messages`
- 1:N → `auth_sessions`

**Use Cases**:
- Store credentials (local auth)
- Store OAuth integration (Google)
- Track approval status (lecturer workflow)

---

### 2. `user_profiles` - Extended User Information

```sql
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    full_name TEXT,
    university_id TEXT,
    department TEXT,
    faculty TEXT,
    program TEXT,
    
    year_of_study INTEGER CHECK (year_of_study BETWEEN 1 AND 4),
    courses TEXT,  -- Comma-separated or JSON
    
    phone TEXT,
    avatar_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_user_profiles_university_id ON user_profiles(university_id);
```

**Use Cases**:
- Store student metadata (year, department)
- Store profile information (avatar, phone)
- Track enrolled courses

---

### 3. `chat_sessions` - Conversation Threads

```sql
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    title TEXT,  -- Custom session title
    is_archived BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at);
```

**Relationships**:
- N:1 → `users`
- 1:N → `chat_messages`
- 1:1 → `memory_state`

**Use Cases**:
- Group messages into conversations
- Track conversation metadata
- Support archiving of old chats

---

### 4. `chat_messages` - Individual Messages

```sql
CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    role message_role NOT NULL,  -- user | assistant | system
    content TEXT NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    CONSTRAINT chat_messages_content_not_empty 
        CHECK (length(trim(content)) > 0)
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_role ON chat_messages(role);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

**Relationships**:
- N:1 → `chat_sessions`
- N:1 → `users`

**Use Cases**:
- Store conversation turns (user query, assistant response)
- Preserve full history for context
- Track who said what and when

---

### 5. `memory_state` - Long-Term Memory Progress

```sql
CREATE TABLE memory_state (
    session_id UUID PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
    
    last_summarized_message_id BIGINT DEFAULT 0,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Use Cases**:
- Track which messages have been summarized
- Store progress for incremental memory updates
- Avoid re-summarizing old conversations

---

### 6. `auth_sessions` - Refresh Token Storage

```sql
CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    refresh_token_hash TEXT NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    user_agent TEXT,  -- Browser/client info
    ip_address INET,  -- Client IP
    
    CONSTRAINT refresh_token_not_revoked 
        CHECK ((revoked_at IS NULL) OR (revoked_at <= now()))
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);
```

**Use Cases**:
- Store hashed refresh tokens (for token rotation)
- Track active sessions (security audit)
- Support logout (revocation)
- Track client info (IP, user agent)

---

## Data Relationships

```
┌──────────────┐
│    users     │
└──────┬───────┘
       │
       ├─── 1:1 ──────→ user_profiles
       │
       ├─── 1:N ──────→ chat_sessions
       │                    │
       │                    ├─── 1:N ──────→ chat_messages
       │                    │
       │                    └─── 1:1 ──────→ memory_state
       │
       ├─── 1:N ──────→ chat_messages (as reference)
       │
       └─── 1:N ──────→ auth_sessions
```

---

## Vector Store Structure (ChromaDB)

### Collections

**Collection: `documents`**
- Purpose: Course material semantic search
- Documents inserted by: Ingestion pipeline
- Queried by: RAG engine

```python
{
  "id": "documents_1707558600000_0",
  "document": "Photosynthesis is the process by which plants...",
  "embedding": [0.12, -0.45, 0.89, ...],  # 768-dimensional
  "metadata": {
    "source": "Biology Lecture 3.pdf",
    "page": 5,
    "course_code": "BIO101",
    "semester": "1",
    "year": "2",
    "uploaded_at": "2026-02-10T10:30:00Z",
    "lecturer_id": "uuid-1234"
  }
}
```

**Collection: `memories`**
- Purpose: Long-term conversation summaries
- Documents inserted by: Memory manager
- Queried by: Memory manager during context building

```python
{
  "id": "memory_session_abc123_001",
  "document": "Student learned about photosynthesis mechanisms...",
  "embedding": [0.15, -0.42, 0.85, ...],
  "metadata": {
    "session_id": "session-abc123",
    "user_id": "user-xyz",
    "created_at": "2026-02-10T15:30:00Z",
    "summary_of_messages": "1-50"
  }
}
```

---

# API Reference

## Authentication Endpoints

### Login

**Request**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@must.ac.ug",
  "password": "securepassword123"
}
```

**Response (200 OK)**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "student@must.ac.ug",
    "username": "student_001",
    "role": "student",
    "approved": true,
    "profile": {
      "full_name": "John Doe",
      "university_id": "STU2024001",
      "department": "Science",
      "faculty": "Engineering",
      "year_of_study": 2
    }
  }
}
```

**Response (401 Unauthorized)**
```json
{
  "detail": "Invalid email or password"
}
```

---

### Set Password (First Login)

**Request**
```http
POST /api/auth/set-password
Content-Type: application/json
Authorization: Bearer {token}

{
  "password": "newSecurePassword123"
}
```

**Response (200 OK)**
```json
{
  "message": "Password set successfully"
}
```

---

## Chat Endpoints

### Create Chat Session

**Request**
```http
POST /api/chats
Content-Type: application/json
Authorization: Bearer {token}

{
  "title": "Calculus 101 - Intro to Limits"
}
```

**Response (200 OK)**
```json
{
  "id": "chat-550e8400-e29b-41d4-a716",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Calculus 101 - Intro to Limits",
  "is_archived": false,
  "created_at": "2026-02-10T10:30:00Z",
  "updated_at": "2026-02-10T10:30:00Z"
}
```

---

### Send Message (AI Query)

**Request**
```http
POST /api/chats/chat-550e8400-e29b-41d4-a716/messages
Content-Type: application/json
Authorization: Bearer {token}

{
  "query": "What is the limit of 1/x as x approaches 0?",
  "bloom_level": "understand",
  "course_code": "MATH101",
  "semester": "1",
  "year": "1"
}
```

**Response (200 OK)**
```json
{
  "user_message": {
    "id": 1,
    "session_id": "chat-550e8400-e29b-41d4-a716",
    "role": "user",
    "content": "What is the limit of 1/x as x approaches 0?",
    "created_at": "2026-02-10T10:35:00Z"
  },
  "assistant_message": {
    "id": 2,
    "session_id": "chat-550e8400-e29b-41d4-a716",
    "role": "assistant",
    "content": "The limit of 1/x as x approaches 0 does not exist (undefined). When approaching from the positive side, the function approaches positive infinity. When approaching from the negative side, it approaches negative infinity...",
    "created_at": "2026-02-10T10:35:05Z"
  },
  "metadata": {
    "bloom_level": "understand",
    "competency": "MATH_L1_02",
    "source_documents": [
      {
        "source": "Calculus Lecture 2.pdf",
        "page": 3,
        "content": "The concept of limits is fundamental to calculus..."
      }
    ]
  }
}
```

---

### List Chat Sessions

**Request**
```http
GET /api/chats?include_archived=false
Authorization: Bearer {token}
```

**Response (200 OK)**
```json
[
  {
    "id": "chat-550e8400-e29b-41d4-a716",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Calculus 101 - Intro to Limits",
    "is_archived": false,
    "created_at": "2026-02-10T10:30:00Z",
    "updated_at": "2026-02-10T10:45:30Z"
  },
  {
    "id": "chat-660e8400-e29b-41d4-a716",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Biology - Photosynthesis",
    "is_archived": false,
    "created_at": "2026-02-09T14:20:00Z",
    "updated_at": "2026-02-10T08:15:00Z"
  }
]
```

---

### Get Chat with Message History

**Request**
```http
GET /api/chats/chat-550e8400-e29b-41d4-a716?limit=50
Authorization: Bearer {token}
```

**Response (200 OK)**
```json
{
  "session": {
    "id": "chat-550e8400-e29b-41d4-a716",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Calculus 101 - Intro to Limits",
    "is_archived": false,
    "created_at": "2026-02-10T10:30:00Z",
    "updated_at": "2026-02-10T10:45:30Z"
  },
  "messages": [
    {
      "id": 1,
      "session_id": "chat-550e8400-e29b-41d4-a716",
      "role": "user",
      "content": "What is a limit in calculus?",
      "created_at": "2026-02-10T10:35:00Z"
    },
    {
      "id": 2,
      "session_id": "chat-550e8400-e29b-41d4-a716",
      "role": "assistant",
      "content": "A limit is a fundamental concept...",
      "created_at": "2026-02-10T10:35:05Z"
    }
  ]
}
```

---

### Rename Chat Session

**Request**
```http
PATCH /api/chats/chat-550e8400-e29b-41d4-a716/title
Content-Type: application/json
Authorization: Bearer {token}

{
  "title": "Advanced Calculus - Limits & Continuity"
}
```

**Response (200 OK)**
```json
{
  "id": "chat-550e8400-e29b-41d4-a716",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Advanced Calculus - Limits & Continuity",
  "is_archived": false,
  "created_at": "2026-02-10T10:30:00Z",
  "updated_at": "2026-02-10T10:50:00Z"
}
```

---

### Archive Chat Session

**Request**
```http
PATCH /api/chats/chat-550e8400-e29b-41d4-a716/archive
Content-Type: application/json
Authorization: Bearer {token}

{
  "is_archived": true
}
```

**Response (200 OK)**
```json
{
  "id": "chat-550e8400-e29b-41d4-a716",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Calculus 101 - Intro to Limits",
  "is_archived": true,
  "created_at": "2026-02-10T10:30:00Z",
  "updated_at": "2026-02-10T10:51:00Z"
}
```

---

### Delete Chat Session

**Request**
```http
DELETE /api/chats/chat-550e8400-e29b-41d4-a716
Authorization: Bearer {token}
```

**Response (200 OK)**
```json
{
  "deleted": true
}
```

---

## File Upload Endpoints

### Upload Course Material

**Request**
```http
POST /api/ingest/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

file: <binary PDF file>
```

**Response (200 OK)**
```json
{
  "success": true,
  "filename": "Biology_Lecture_3.pdf",
  "chunks_stored": 42,
  "metadata": {
    "source": "Biology_Lecture_3.pdf",
    "course_code": "BIO101",
    "uploaded_by": "lecturer-uuid",
    "uploaded_at": "2026-02-10T10:30:00Z"
  }
}
```

---

### Check Lecturer Upload Status

**Request**
```http
GET /api/ingest/lecturer/lecturer-uuid
Authorization: Bearer {token}
```

**Response (200 OK)**
```json
{
  "lecturer_id": "lecturer-uuid",
  "total_documents_uploaded": 15,
  "total_chunks_stored": 1243,
  "recent_uploads": [
    {
      "filename": "Biology_Lecture_3.pdf",
      "chunks": 42,
      "uploaded_at": "2026-02-10T10:30:00Z"
    }
  ]
}
```

---

## Institution Configuration Endpoints

### Get Institution Config

**Request**
```http
GET /api/config/institution
Authorization: Bearer {token}
```

**Response (200 OK)**
```json
{
  "campuses": [
    {
      "id": "campus-uuid-001",
      "name": "Main Campus",
      "institution": "MUST",
      "is_active": true
    }
  ],
  "years": [
    {
      "id": "year-uuid-001",
      "year_number": 1,
      "is_active": true
    },
    {
      "id": "year-uuid-002",
      "year_number": 2,
      "is_active": true
    }
  ],
  "semesters": [
    {
      "id": "semester-uuid-001",
      "semester_number": 1,
      "name": "Semester 1",
      "is_active": true
    },
    {
      "id": "semester-uuid-002",
      "semester_number": 2,
      "name": "Semester 2",
      "is_active": true
    }
  ],
  "courses": [
    {
      "id": "course-uuid-001",
      "code": "MATH101",
      "name": "Calculus I",
      "description": "Introduction to differential calculus",
      "credits": 3,
      "campus_id": "campus-uuid-001",
      "year_id": "year-uuid-001",
      "semester_id": "semester-uuid-001",
      "is_active": true
    },
    {
      "id": "course-uuid-002",
      "code": "BIO101",
      "name": "Introduction to Biology",
      "description": "Fundamentals of biological sciences",
      "credits": 4,
      "campus_id": "campus-uuid-001",
      "year_id": "year-uuid-001",
      "semester_id": "semester-uuid-001",
      "is_active": true
    }
  ]
}
```

---

## Health Check Endpoints

### Server Health

**Request**
```http
GET /health
```

**Response (200 OK)**
```json
{
  "status": "ok"
}
```

---

### Database Health

**Request**
```http
GET /db-health
```

**Response (200 OK)**
```json
{
  "db": "ok"
}
```

---

## Error Handling

All endpoints return standard HTTP status codes:

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found (resource doesn't exist) |
| 500 | Server error |

**Error Response Format**
```json
{
  "detail": "Error message describing what went wrong"
}
```

---

# Setup & Configuration Guide

## Prerequisites

- **Python**: 3.8+
- **Node.js**: 18+
- **PostgreSQL**: 12+
- **Docker** (optional, for containerized deployment)

## Backend Setup

### 1. Environment Configuration

Create `.env` file in `backend/`:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/edusmart

# JWT Secret
SECRET_KEY=your-super-secret-key-change-this-in-production

# Logging
LOG_LEVEL=INFO

# LLM Configuration
LLM_MODEL_PATH=/path/to/model.gguf
LLM_CONTEXT_SIZE=2048
LLM_THREADS=4

# ChromaDB
CHROMA_DB_PATH=./data/chroma_db

# API
API_HOST=0.0.0.0
API_PORT=8001
API_CORS_ORIGINS=["http://localhost:5173", "http://localhost:3000"]
```

### 2. Install Dependencies

```bash
cd backend/

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Initialize Database

```bash
# Create schema
python init_db.py

# Verify connection
python test_server.py
```

### 4. Start Backend Server

```bash
# Development (with auto-reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Production
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
```

Server runs on `http://localhost:8001`

---

## Frontend Setup

### 1. Environment Configuration

Create `.env.local` in `frontend/react-app/`:

```bash
# API Base URL
VITE_API_URL=http://localhost:8001

# App Environment
VITE_ENV=development
```

### 2. Install Dependencies

```bash
cd frontend/react-app/

npm install
```

### 3. Start Development Server

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

### 4. Build for Production

```bash
npm run build

# Output: dist/ folder with optimized bundle
```

---

## Database Setup

### 1. Create PostgreSQL Database

```sql
-- Connect as superuser
psql -U postgres

-- Create database
CREATE DATABASE edusmart;

-- Create user
CREATE USER edusmart_user WITH PASSWORD 'secure_password';

-- Grant privileges
ALTER ROLE edusmart_user SET client_encoding TO 'utf8';
ALTER ROLE edusmart_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE edusmart_user SET default_transaction_deferrable TO on;
ALTER ROLE edusmart_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE edusmart TO edusmart_user;
```

### 2. Initialize Schema

```bash
# From backend directory
python init_db.py
```

This script:
- Enables required extensions (UUID)
- Creates all tables
- Sets up indexes
- Applies constraints

### 3. Verify Tables

```bash
psql -U edusmart_user -d edusmart

-- List all tables
\dt

-- Verify users table
\d users
```

---

## Vector Store Setup (ChromaDB)

### 1. Create Data Directory

```bash
mkdir -p backend/data/chroma_db
chmod 755 backend/data/chroma_db
```

### 2. Initialize Collections

Collections are created automatically on first use:
- `documents` - Course materials
- `memories` - Conversation summaries

---

## LLM Model Setup

### 1. Download Llama Model

```bash
# Create models directory
mkdir -p models/

# Download model (example: Llama 2 7B GGUF)
cd models/
wget https://huggingface.co/.../llama-2-7b.Q4_K_M.gguf

# Verify download
ls -lh llama-2-7b.Q4_K_M.gguf
```

### 2. Update Configuration

```bash
# In .env
LLM_MODEL_PATH=/absolute/path/to/llama-2-7b.Q4_K_M.gguf
```

### 3. Test LLM

```bash
curl http://localhost:8001/test-llm?q="Say%20hello"
```

---

## Running the Full Stack

### Option 1: Manual (Recommended for Development)

**Terminal 1 - Backend**
```bash
cd backend/
source venv/bin/activate
uvicorn app.main:app --reload --port 8001
```

**Terminal 2 - Frontend**
```bash
cd frontend/react-app/
npm run dev
```

**Terminal 3 - Database** (if not running as service)
```bash
pg_ctl -D /path/to/postgresql/data start
```

### Option 2: Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: edusmart
      POSTGRES_USER: edusmart_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://edusmart_user:secure_password@postgres:5432/edusmart
    depends_on:
      - postgres
    ports:
      - "8001:8001"
    volumes:
      - ./backend/data:/app/data

  frontend:
    build:
      context: ./frontend/react-app
      dockerfile: Dockerfile
    environment:
      VITE_API_URL: http://localhost:8001
    ports:
      - "5173:5173"

volumes:
  postgres_data:
```

Run:
```bash
docker-compose up -d
```

---

## Testing

### Backend Tests

```bash
cd backend/

# Run all tests
pytest

# Run specific test
pytest app/tests/test_bloom_detector.py -v

# With coverage
pytest --cov=app --cov-report=html
```

### Frontend Tests (if configured)

```bash
cd frontend/react-app/

npm test
```

---

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Verify connection
psql -U edusmart_user -d edusmart -c "SELECT version();"

# Check connection string
echo $DATABASE_URL
```

### LLM Not Loading

```bash
# Test LLM endpoint
curl http://localhost:8001/test-llm

# Check model path exists
ls -lh /path/to/model.gguf

# Check permissions
chmod 644 /path/to/model.gguf
```

### Frontend Can't Connect to Backend

```bash
# Verify backend is running
curl http://localhost:8001/health

# Check CORS settings
# In backend main.py

# Check API URL in frontend .env
cat frontend/react-app/.env.local | grep VITE_API_URL
```

### Token Expiration Issues

```bash
# Increase token expiration (in auth.py)
token_expiry = datetime.utcnow() + timedelta(hours=24)

# Clear localStorage and login again
localStorage.clear()
```

---

## Security Checklist

- [ ] Change `SECRET_KEY` in production
- [ ] Use HTTPS in production
- [ ] Enable CORS only for trusted origins
- [ ] Hash passwords with bcrypt (minimum 10 rounds)
- [ ] Validate all user inputs
- [ ] Use environment variables for secrets
- [ ] Implement rate limiting on auth endpoints
- [ ] Enable PostgreSQL SSL connections
- [ ] Regularly update dependencies
- [ ] Monitor LLM inference for jailbreak attempts

---

## Performance Optimization

### Backend
- Use connection pooling (SQLAlchemy)
- Enable caching for embeddings
- Batch document ingestion
- Use appropriate ChromaDB fetch limit (n_results=5-10)

### Frontend
- Code splitting with Vite
- Lazy load components
- Implement message virtualization for long chats
- Cache API responses (React Query recommended)

### Database
- Create indexes on frequently queried columns
- Partition large tables by user_id
- Archive old chat sessions periodically
- Analyze query plans (EXPLAIN ANALYZE)

---

## Deployment

### Heroku

```bash
# Create Procfile
echo "web: gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app" > backend/Procfile

# Deploy
git push heroku main
```

### AWS (EC2 + RDS)

1. Launch EC2 instance (Ubuntu 22.04)
2. Create RDS PostgreSQL instance
3. Set environment variables
4. Install dependencies
5. Use systemd for auto-start

### DigitalOcean / Linode

Similar to AWS with App Platform for simpler deployment.

---

## Monitoring & Logging

### Backend Logs
```python
# In app/core/logging.py
import logging

logger = logging.getLogger(__name__)
logger.info(f"Processing query: {user_query}")
```

### Database Monitoring
```sql
-- Slow queries
SELECT query, calls, mean_time FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables ORDER BY pg_total_relation_size DESC;
```

---

**Document Version**: 1.0  
**Last Updated**: February 10, 2026  
**Author**: EduSmart Development Team
