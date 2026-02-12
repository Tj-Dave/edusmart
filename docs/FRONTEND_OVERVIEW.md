# EduSmart Frontend Overview

This document captures the personas, primary use cases, and UI surfaces currently implemented in the EduSmart frontend. It should help designers, engineers, and stakeholders stay aligned on what the interface delivers today and where each audience interacts.

## Personas

1. **Lecturer**  
   - Owns course content, curriculum alignment, and quality.  
   - Needs tooling to ingest materials, verify Bloom/CBC coverage, and monitor how students use their uploads.  
   - Requires credible citations so they can trust the assistant’s responses reference their vetted sources.

2. **Student**  
   - Consumes chat guidance grounded in course materials.  
   - Can upload supplemental references for personal study, but those sources are marked as non-lecturer to protect citation credibility.  
   - Uses Bloom-driven prompts (generate questions, summaries, guides) to prepare for assessments.

3. **Administrator / Instructional Designer** *(secondary)*  
   - Monitors adoption across courses, but primarily relies on lecturer analytics (uploads, queries, citations) to ensure coverage.  
   - Uses the same lecturer UI for now; future iterations may introduce dedicated dashboards.

## Key Use Cases

| Persona    | Use Case | Description |
|------------|----------|-------------|
| Lecturer   | Bulk upload course packs | Drag/drop syllabi, lectures, rubrics (PDF/DOCX/PPTX) via UploadPage; monitor processing + OCR status. |
| Lecturer   | Verify Bloom coverage | After ingestion, open chat, use Bloom checklist prompts to auto-generate quizzes, study guides, or scaffolding tied to their uploads. |
| Lecturer   | Trace citations | Review analytics that show how many AI responses cite their materials; in chat, only lecturer uploads appear in the citation drawer. |
| Student    | Ask grounded questions | Chat with EduSmart using course context selected from `useCourseStore`; uploads they perform are allowed but citations remain flagged as non-lecturer. |
| Student    | Personal study uploads | Use chat composer’s “Attach supporting material” toggle to add references for personal research; backend keeps them separate from authoritative lecturer sources. |
| Admin      | Monitor engagement | View lecturer analytics (total uploads, queries, top questions) to understand adoption. |

## UI Surfaces

### Chat Page (`/chat`)
- **Shared for all personas** with role-aware cues.  
- **Message stream**: light theme, displays assistant replies with lecturer-only citation drawer and warnings when non-lecturer references were hidden.  
- **Composer**: white/blue card with `+` toggle. Extras include file upload controls that feed the ingestion pipeline plus quick action placeholders.  
- **Bloom Checklist Support**: prompts (generate questions, notes, guides) rely on whichever course is active in `useCourseStore`.  
- **Sidebar**: local chat sessions per course with dropdown actions; header exposes account/settings/log-out.

### Upload Page (`/upload`)
- **Lecturer-only guard**: Non-lecturers see a lock screen with a “Go to Chat” button.  
- **Tabs**: Upload / History / Analytics.  
  - **Upload Tab**: Course+semester selectors, optional description, drag/drop zone (max 10 files, 20 MB each), success banner with “Chat with this course” CTA once ingestion starts.  
  - **History Tab**: Table of uploads (status badges, sizes, timestamps) with per-row “Chat with this course” buttons that pre-load `/chat` with the matching course context.  
  - **Analytics Tab**: Cards for total uploads, total queries, most queried materials, top student questions, and a citation attribution panel.

### Citation Handling
- Chat responses only show citations when the backend marks the source as `lecturer`.  
- Student uploads still feed the RAG but get hidden from the visible citation list to retain credibility.  
- If the assistant had to hide references, a warning line indicates how many were omitted and why.

### Navigation Links
- Upload success banner ➜ `Chat with this course`.  
- History table action ➜ Quick jump into chat for any course.  
- Non-lecturer guard ➜ Redirect to chat so students aren’t blocked from the main experience.

## Future Hooks
- **Preview mode** for front-end-only work (mock data while backend is offline).  
- **Student analytics** to show personal study uploads and derived content.  
- **Admin dashboards** for multi-course oversight beyond the lecturer panels.

Use this overview alongside `docs/FRONTEND_HANDLERS.md` when onboarding new teammates or planning the next set of UI changes.
