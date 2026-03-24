from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.db.models import (
    EnrollmentTaskResult,
    EnrollmentTaskStatus,
    OfferingRoadmapItem,
    RoadmapAssessmentTask,
    UserRole,
)
from app.services.access_control import require_lecturer_or_admin_for_enrollment
from app.services.assessment_service import (
    apply_late_penalty,
    compute_next_attempt_no,
    evaluate_submission_deadline,
)
from app.services.domain_errors import ServiceConflictError, ServicePermissionError, ServiceValidationError
from app.services.event_service import emit_enrollment_event
from app.services.progress_service import _summaries_for_item, missing_progress_item_ids, select_score_by_rule


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def one_or_none(self):
        return self._result


class _FakeSession:
    def __init__(self, mapping):
        self.mapping = mapping
        self.added = []

    def query(self, model):
        return _FakeQuery(self.mapping.get(model))

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        return None


def _user(role: UserRole, user_id: str | None = None):
    return SimpleNamespace(id=user_id or str(uuid4()), role=role)


def test_attempt_limit_enforced():
    assert compute_next_attempt_no(0, 1) == 1
    assert compute_next_attempt_no(2, 3) == 3
    with pytest.raises(ServiceConflictError):
        compute_next_attempt_no(3, 3)


def test_scoring_rule_best_latest_average_first():
    attempts = [
        EnrollmentTaskResult(attempt_no=1, score=60),
        EnrollmentTaskResult(attempt_no=2, score=80),
        EnrollmentTaskResult(attempt_no=3, score=70),
    ]

    best_score, best_attempt = select_score_by_rule("best", attempts)
    latest_score, latest_attempt = select_score_by_rule("latest", attempts)
    avg_score, avg_attempt = select_score_by_rule("average", attempts)
    first_score, first_attempt = select_score_by_rule("first", attempts)

    assert best_score == 80 and best_attempt == 2
    assert latest_score == 70 and latest_attempt == 3
    assert round(avg_score, 4) == 70 and avg_attempt == 3
    assert first_score == 60 and first_attempt == 1


def test_rollup_metric_calculation_with_weighted_rules():
    item_id = uuid4()
    task_1_id = uuid4()
    task_2_id = uuid4()

    task_1 = RoadmapAssessmentTask(
        id=task_1_id,
        roadmap_item_id=item_id,
        title="Task 1",
        max_score=40,
        weight=1,
        is_required=True,
        is_active=True,
        attempt_scoring_rule="best",
    )
    task_2 = RoadmapAssessmentTask(
        id=task_2_id,
        roadmap_item_id=item_id,
        title="Task 2",
        max_score=50,
        weight=2,
        is_required=True,
        is_active=True,
        attempt_scoring_rule="latest",
    )
    item = OfferingRoadmapItem(id=item_id, assessment_tasks=[task_1, task_2])

    attempts_by_task = {
        task_1_id: [
            EnrollmentTaskResult(task_id=task_1_id, attempt_no=1, score=10, status=EnrollmentTaskStatus.graded),
            EnrollmentTaskResult(task_id=task_1_id, attempt_no=2, score=20, status=EnrollmentTaskStatus.graded),
        ],
        task_2_id: [
            EnrollmentTaskResult(task_id=task_2_id, attempt_no=1, score=30, status=EnrollmentTaskStatus.graded),
            EnrollmentTaskResult(task_id=task_2_id, attempt_no=2, score=25, status=EnrollmentTaskStatus.graded),
        ],
    }

    summaries, metrics = _summaries_for_item(item=item, attempts_by_task=attempts_by_task)
    by_task = {s["task_id"]: s for s in summaries}

    assert by_task[task_1_id]["selected_score"] == 20
    assert by_task[task_2_id]["selected_score"] == 25
    assert metrics["completion_percent"] == 100
    assert round(metrics["total_score"], 4) == 70.0  # 20*1 + 25*2
    assert round(metrics["max_total_score"], 4) == 140.0  # 40*1 + 50*2
    assert round(metrics["avg_score"], 4) == round(70 / 3, 4)
    assert metrics["best_score"] == 25


def test_late_submission_policy_reject_and_penalize():
    due_at = datetime.now(timezone.utc) - timedelta(hours=2)
    submitted_at = datetime.now(timezone.utc)

    with pytest.raises(ServiceValidationError):
        evaluate_submission_deadline(
            due_at=due_at,
            submitted_at=submitted_at,
            allow_late_submission=False,
        )

    is_late = evaluate_submission_deadline(
        due_at=due_at,
        submitted_at=submitted_at,
        allow_late_submission=True,
    )
    assert is_late is True
    assert round(apply_late_penalty(80, 25), 4) == 60.0


def test_authorization_student_cannot_grade_and_wrong_lecturer_cannot_grade():
    enrollment = SimpleNamespace(id=uuid4(), offering_id=uuid4(), user_id=uuid4())
    # Offering is owned by another lecturer
    offering = SimpleNamespace(id=enrollment.offering_id, lecturer_user_id=uuid4())

    db = _FakeSession(mapping={
        # Access control queries by model class keys
        # noqa: intentionally mapping exact classes
    })
    # inject with actual model class keys at runtime
    from app.db.models import Enrollment, CourseOffering
    db.mapping[Enrollment] = enrollment
    db.mapping[CourseOffering] = offering

    student_actor = _user(UserRole.student, user_id=str(uuid4()))
    with pytest.raises(ServicePermissionError):
        require_lecturer_or_admin_for_enrollment(db, enrollment_id=enrollment.id, actor=student_actor)

    lecturer_actor = _user(UserRole.lecturer, user_id=str(uuid4()))
    with pytest.raises(ServicePermissionError):
        require_lecturer_or_admin_for_enrollment(db, enrollment_id=enrollment.id, actor=lecturer_actor)


def test_progress_idempotency_helper_missing_rows():
    a, b = uuid4(), uuid4()
    missing_first = missing_progress_item_ids([a, b], {a})
    missing_second = missing_progress_item_ids([a, b], {a, b})
    assert missing_first == [b]
    assert missing_second == []


def test_enrollment_events_emitted_for_required_event_types():
    db = _FakeSession(mapping={})
    enrollment_id = str(uuid4())
    actor_id = str(uuid4())

    for event_type in [
        "attempt_created",
        "attempt_submitted",
        "attempt_graded",
        "roadmap_item_completed",
    ]:
        emit_enrollment_event(
            db,
            enrollment_id=enrollment_id,
            event_type=event_type,
            actor_user_id=actor_id,
            note={"test": True},
        )

    assert len(db.added) == 4
    assert [ev.event_type for ev in db.added] == [
        "attempt_created",
        "attempt_submitted",
        "attempt_graded",
        "roadmap_item_completed",
    ]

