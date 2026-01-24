# EduSmart: Curriculum-Aware AI Learning Assistant

EduSmart is a curriculum-aware, AI-powered learning support system designed to bridge the gap between Uganda’s Competency-Based Curriculum (CBC) and university-level teaching and learning.  
The system integrates Retrieval-Augmented Generation (RAG), Bloom’s taxonomy analysis, and competency mapping to deliver structured, pedagogy-aligned academic assistance for both students and lecturers.

The architecture is designed to support:

- Web-based access  
- Desktop (Electron) offline deployment  
- Future mobile application integration  
- CPU-based local inference using llama.cpp  
- Dynamic knowledge updates through lecturer content ingestion  

---
### Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

## 1. High-Level Architecture Overview

EduSmart adopts a **unified API-centered architecture** built on FastAPI.

All clients communicate through a single backend API:

- Electron Desktop Application (Windows, offline-capable)  
- Web Frontend (students & lecturers)  
- Future Mobile Application  

The backend exposes two core functional domains:

- **Query & Intelligence Domain** → `/api/ai/*`  
- **Content Ingestion Domain** → `/api/ingest/*`  

Internally, the system is organized into modular services that implement:

- Bloom’s level detection  
- Competency mapping  
- Retrieval-Augmented Generation (RAG)  
- Prompt engineering  
- Local LLM inference via llama.cpp  
- Vector database management (ChromaDB)  

---

## 2. Main Functional Pipelines

### 2.1 Query Pipeline (Students & Lecturers)

Triggered via:

POST /api/ai/query

Processing flow:

1. Receive query and user role (student / lecturer)  
2. Detect Bloom’s cognitive level  
3. Map query to relevant competencies  
4. Retrieve relevant documents from vector database (RAG)  
5. Construct role-aware, pedagogy-aware prompt  
6. Generate response using llama.cpp (Gemma models)  
7. Return structured response to client  

This pipeline supports:

- Student explanations  
- Lecturer lesson planning  
- Test and assessment design  
- Curriculum-aligned feedback  

---

### 2.2 Ingestion Pipeline (Lecturer Content Upload)

Triggered via:

POST /api/ingest/upload

Processing flow:

1. Lecturer uploads document (PDF, DOCX, PPTX, or image)  
2. System extracts text (for text-based formats)  
3. Images are accepted but marked **OCR pending**  
4. Text is chunked into semantic segments  
5. Embeddings are generated  
6. Chunks are stored in the vector database  
7. New content becomes immediately available for retrieval  

This allows dynamic enrichment of the system’s knowledge base with:

- Lecture notes  
- Slides  
- Lab manuals  
- Exams and assessments  

---

## 3. Repository Structure and Module Responsibilities
```markdown
# Repository Structure

EduSmart/
│
├── backend/
│ ├── app/
│ │ ├── main.py
│ │ ├── core/
│ │ ├── routes/
│ │ ├── services/
│ │ ├── db/
│ │ ├── models/
│ │ ├── utils/
│ │ └── tests/
│ └── requirements.txt
│
├── frontend/
│ └── electron/
│
├── data/
│
├── models/
│
├── docs/
│
├── scripts/
│
└── README.md
```
---

## 4. Backend Entry Point

### `backend/app/main.py`

Purpose:

- Initializes FastAPI application  
- Registers all API routers  
- Acts as the main entry point for the backend  

Typical responsibilities:

- Include `/api/ai` routes  
- Include `/api/ingest` routes  
- Health check endpoint  

---

## 5. Core Configuration

### `backend/app/core/config.py`

Purpose:

- Centralized configuration management  
- Environment variables  
- Model paths  
- Database paths  
- System-level settings  

This ensures:

- clean separation between code and configuration  
- easy deployment across environments  

---

## 6. API Routes Layer

Located in:
backend/app/routes/


### `ai_query.py`

Implements:
POST /api/ai/query

Responsibilities:

- Receive user queries  
- Validate input schema  
- Orchestrate query pipeline services  
- Return final AI-generated response  

---

### `ingestion.py`

Implements:
POST /api/ingest/upload

Responsibilities:

- Accept lecturer file uploads  
- Validate file type and metadata  
- Trigger ingestion pipeline  
- Return ingestion status and chunk counts  

---

## 7. Service Layer (Core Intelligence)

Located in:
backend/app/services/

These modules implement the main academic intelligence logic.

### `bloom_detector.py`

Purpose:

- Analyze query text  
- Classify into Bloom’s cognitive levels  
  (Remember, Understand, Apply, Analyze, Evaluate, Create)  

Used to guide:

- prompt construction  
- pedagogical depth  

---

### `competency_mapper.py`

Purpose:

- Map queries to curriculum competencies  
- Align responses with CBC learning outcomes  
- Support curriculum-aware reasoning  

---

### `prompt_engine.py`

Purpose:

- Construct structured system prompts  
- Incorporate:
  - user role (student / lecturer)  
  - Bloom level  
  - competency mapping  
  - task type (explanation, test, lesson plan)  

This ensures:

- pedagogically aligned AI responses  
- role-specific behavior  

---

### `rag_engine.py`

Purpose:

- Implement Retrieval-Augmented Generation (RAG)  
- Embed user queries  
- Retrieve relevant chunks from ChromaDB  
- Provide context to the prompt engine  

This module connects:

- vector database  
- prompt construction  
- LLM inference  

---

## 8. LLM Integration Layer (llama.cpp)

Located in:
backend/app/services/llm/llama_cpp_client.py

Purpose:

- Single abstraction layer for all LLM access  
- Interface with llama.cpp  
- Support multiple deployment modes:

  - CPU-based Gemma-3B (server deployment)  
  - Gemma-3n (desktop offline deployment)  
  - Future GPU-based models (Gemma-4B)  

This design allows:

- offline-first deployment  
- dynamic switching between models  
- future scalability without refactoring core logic  

---

## 9. Ingestion Services

Located in:
backend/app/services/ingestion/

### `document_loader.py`

Purpose:

- Load and extract text from:
  - PDF  
  - DOCX  
  - PPTX  
- Route images to OCR pipeline (future)  

---

### `ocr_engine.py` (Stub for Future)

Purpose:

- Placeholder for future OCR integration  
- Will implement:
  - image → text extraction  
- Currently marks image ingestion as **OCR pending**  

---

### `text_chunker.py`

Purpose:

- Split long documents into semantic chunks  
- Control chunk size and overlap  
- Prepare text for embedding  

---

### `embedder.py`

Purpose:

- Generate vector embeddings from text chunks  
- Use lightweight CPU-based embedding models  
- Provide embeddings to vector database  

---

### `ingestion_pipeline.py`

Purpose:

- Orchestrate the full ingestion workflow  
- Coordinate:
  - loading  
  - chunking  
  - embedding  
  - storage  
- Return ingestion statistics to API  

---

## 10. Database Layer

Located in:
backend/app/db/vector_store.py

Purpose:

- Abstract access to ChromaDB  
- Provide functions to:
  - add documents  
  - query vectors  
  - filter by metadata  
- Serve as the core retrieval layer for RAG  

---

## 11. Data Directory

Located in:
data/

Structure:

- `curriculum_docs/` → official curriculum materials  
- `lecturer_uploads/` → lecturer-contributed documents  
- `raw_images/` → images awaiting OCR processing  
- `embeddings/` → cached embedding data  
- `chroma_db/` → persistent vector database  

This directory is excluded from version control.

---

## 12. Frontend Layer

Located in:
frontend/electron/

Purpose:

- Desktop client built with Electron  
- Provides:
  - student interface  
  - lecturer interface  
  - offline deployment support  

The frontend communicates only via:

- `/api/ai/query`  
- `/api/ingest/upload`  

---

## 13. Future Extensions Supported by This Architecture

This modular design supports future integration of:

- OCR for scanned documents and images  
- Authentication and role-based access control  
- Course-level content management  
- Mobile application clients  
- GPU-based inference servers  
- Advanced analytics and logging  

No core architectural refactoring is required to add these features.

---

## 14. Design Principles

This system follows:

- Modular service-oriented design  
- API-first architecture  
- Separation of concerns  
- Extensibility and scalability  
- Offline-first AI deployment  
- Pedagogy-aware AI integration  

---

## 15. Branching Strategy & Development Workflow

EduSmart follows a **structured Git branching strategy** designed to support collaborative development, feature isolation, integration testing, and stable releases.

The repository maintains **three primary branch types**:

---

### 15.1 Main Branch (`main`)

The `main` branch represents the **stable production-ready state** of the system.

**Characteristics:**
- Contains only **tested and stable code**
- Reflects **official project milestones and releases**
- Used for:
  - final project submissions  
  - demonstrations  
  - deployment-ready builds  

**Rules:**
- No direct development on `main`
- Only merged from `dev` after validation
- Each merge represents a stable system version

---

### 15.2 Development Branch (`dev`)

The `dev` branch serves as the **primary integration branch**.

**Purpose:**
- Aggregate completed features
- Perform integration testing
- Validate interoperability between system components

**Characteristics:**
- Contains all **actively developed and tested functionality**
- May be temporarily unstable, but must always remain **buildable**
- Acts as the staging area before promotion to `main`

**Rules:**
- ✔ All feature branches merge into `dev`
- ✔ Integration and system-level testing occurs here
- ✔ Only approved and tested changes are promoted to `main`

---

### 15.3 Feature Branches (`feature/*`)

Each new feature is developed in an **isolated feature branch**, created from the `dev` branch.

**Naming convention:**
feature/feature-name

**Examples:**
- feature/bloom-detector
- feature/rag-engine
- feature/lecturer-ingestion
- feature/llama-integration


**Workflow:**
1. Create feature branch from `dev`
2. Develop and test the feature in isolation
3. Commit incremental changes
4. Merge feature branch back into `dev`
5. Resolve conflicts and validate integration
6. Delete feature branch after successful merge

**Rules:**
- Feature branches are never merged directly into `main`
- Each feature branch targets **one logical feature**
- Branches are short-lived to avoid divergence

---

### 15.4 Development Workflow Summary

The overall workflow follows this pattern:

```
main
↑
│ (stable releases only)
│
dev
↑
│ (integration & testing)
│
feature/*
(isolated feature development)
```

**Step-by-step lifecycle:**
1. **Feature initiation**  
   → branch created from `dev`

2. **Feature development**  
   → coding, testing, and refinement in feature branch

3. **Integration**  
   → feature merged into `dev`

4. **System validation**  
   → integration testing on `dev`

5. **Release promotion**  
   → stable `dev` state merged into `main`

---

### 15.5 Rationale for This Strategy

This branching model was selected to:

- Minimize integration conflicts
- Isolate experimental features
- Protect the stability of the main branch
- Support parallel development by multiple contributors
- Align with industry-standard Git workflows

It ensures that:
- **Research artifacts remain reproducible**
- **Development risks are controlled**
- **System stability is preserved throughout the project lifecycle**


## 16. Summary

EduSmart is designed as a:

- curriculum-aware  
- pedagogy-aligned  
- multi-platform  
- extensible AI learning system  

The architecture cleanly separates:

- API layer  
- intelligence services  
- ingestion services  
- LLM integration  
- data management  

This design supports both:

- rigorous academic research  
- practical deployment in real university environments  

---

## License

This project is licensed under the Apache 2.0 License.
