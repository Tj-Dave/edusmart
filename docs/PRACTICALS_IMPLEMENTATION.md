# Practicals Implementation Guide

This guide documents the practical-learning implementation added to EduSmart.

## What Was Implemented

1. Practical task types:
- `case_study`
- `simulation`
- `field_task`

2. Practical task blueprint fields (`roadmap_assessment_tasks`):
- `practical_brief`
- `required_tools`
- `expected_artifact`
- `safety_notes`
- `rubric_json`

3. Practical attempt evidence fields (`enrollment_task_results`):
- `artifact_url`
- `reflection_text`
- `rubric_scores_json`

4. API request/response support:
- Task create/update now accepts practical blueprint fields.
- Attempt create/submit now accepts `artifact_url` and `reflection_text`.
- Attempt grade now accepts `rubric_scores`.

5. Lecturer workspace UI support:
- Task type now uses a controlled dropdown.
- Task create/edit panels include practical brief, tools, expected artifact, safety notes, and rubric JSON.
- Lecturer now has a dedicated `Assessments` tab for grading workflow.
- `Students` tab remains focused on progress tracking and monitoring.
- `Assessments` tab label shows pending submitted attempts count, e.g. `Assessments (6)`.

6. Student submission UX support:
- Student tool drawer submission modal now captures:
  - `evidence_url`
  - `artifact_url`
  - `reflection_text`
  - optional payload/notes JSON
- These fields are sent through `progressApi.submitAttempt(...)` into backend attempt submission.

7. Gamification support (Phase 1):
- Enrollment-scoped XP profile and progression fields:
  - `xp_total`
  - `level`
  - `streak_days`
  - `last_activity_date` (profile persistence field)
- Badge tracking table for unlocked achievements.
- XP event ledger for auditable XP awards.
- Student progress UI now shows level, XP, streak, progress-to-next-level, and unlocked badges.

## Database Upgrade

Run:

```sql
\i backend/app/db/maindb.sql
```

`maindb.sql` now includes the practicals and gamification upgrade blocks, so a single run is enough.

## API Examples

### Create a practical task

```http
POST /roadmap-items/{item_id}/tasks
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "title": "Lab 1: Sensor Calibration",
  "task_type": "lab",
  "description": "Calibrate and validate the sensor readings.",
  "practical_brief": "Calibrate sensor using reference values and submit calibration report.",
  "required_tools": "Sensor kit, multimeter, calibration sheet",
  "expected_artifact": "PDF lab report + raw CSV readings",
  "safety_notes": "Disconnect power before rewiring.",
  "rubric_json": {
    "correctness": 40,
    "process": 30,
    "reflection": 30
  },
  "max_score": 100,
  "max_attempts": 2,
  "allow_late_submission": true,
  "late_penalty_percent": 10
}
```

### Submit a practical attempt

```http
POST /enrollments/{enrollment_id}/tasks/{task_id}/attempts/{attempt_no}/submit
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "evidence_url": "https://example.com/submission/notes",
  "artifact_url": "https://example.com/submission/report.pdf",
  "reflection_text": "I adjusted calibration offsets after observing drift.",
  "payload": {
    "dataset": "calibration_batch_1"
  }
}
```

### Grade with rubric scores

```http
POST /enrollments/{enrollment_id}/tasks/{task_id}/attempts/{attempt_no}/grade
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "score": 82,
  "feedback": "Good process. Improve error analysis depth.",
  "rubric_scores": {
    "correctness": 34,
    "process": 27,
    "reflection": 21
  }
}
```

### Get gamification overview

```http
GET /enrollments/{enrollment_id}/gamification
Authorization: Bearer <JWT>
```

Example response:

```json
{
  "enrollment_id": "6b45fb4b-cbfe-4dd0-97fe-c63f99df4d3f",
  "user_id": "0ff1f15e-8f34-4747-a348-7a0c56d12ef0",
  "xp_total": 86,
  "level": 2,
  "xp_in_level": 26,
  "xp_to_next_level": 34,
  "streak_days": 3,
  "badges": [
    {
      "id": 5,
      "badge_code": "first_attempt",
      "title": "First Attempt",
      "description": "Started your first assessment attempt.",
      "awarded_at": "2026-03-06T14:12:33.105Z"
    }
  ],
  "recent_events": [
    {
      "id": 19,
      "event_type": "attempt_submitted",
      "xp_delta": 10,
      "metadata_json": {
        "task_id": 42,
        "attempt_no": 1
      },
      "created_at": "2026-03-06T14:12:33.096Z"
    }
  ]
}
```

## Backward Compatibility Notes

1. Existing quiz/assignment flows remain valid.
2. Existing scoring and access control logic is unchanged.
3. New practical fields are optional, so older clients continue to work.
4. Gamification awards are additive and non-blocking; core grading/progress logic remains unchanged.

## Lecturer Assessment Section (UI)

Location:

1. Open `Lecturer Workspace`.
2. Go to `Assessments` tab.
3. Select an enrolled student.
4. In each roadmap item, open a task and use the `Assessment & grading` subsection.

Capabilities:

1. View attempt status, submitted timestamp, current score.
2. Open evidence/artifact links when provided.
3. Enter score and feedback.
4. Optionally enter rubric scores as JSON.
5. Submit grade via `Grade Attempt`.
