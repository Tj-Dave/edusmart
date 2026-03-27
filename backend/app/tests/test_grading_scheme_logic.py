from __future__ import annotations

from uuid import uuid4

import pytest

from app.db.models import (
    AiEvaluationStatus,
    AttemptAiComponentSuggestion,
    AttemptAiEvaluation,
    EnrollmentTaskResult,
    TaskGradingComponent,
    TaskGradingSchemeVersion,
)
from app.services.domain_errors import ServiceValidationError
from app.services.grading_scheme_service import (
    can_auto_grade_attempt,
    derive_attempt_score_source,
    normalize_grading_scheme_payload,
    resolve_component_scores_for_finalization,
)


def _component(
    *,
    scheme_version_id,
    key: str,
    label: str,
    max_points: float,
    display_order: int,
    is_auto_gradable: bool = False,
    manual_only: bool = False,
) -> TaskGradingComponent:
    return TaskGradingComponent(
        id=uuid4(),
        scheme_version_id=scheme_version_id,
        component_key=key,
        label=label,
        max_points=max_points,
        display_order=display_order,
        is_auto_gradable=is_auto_gradable,
        manual_only=manual_only,
        rubric_levels=[],
    )


def test_normalize_grading_scheme_payload_requires_exact_component_total():
    with pytest.raises(ServiceValidationError):
        normalize_grading_scheme_payload(
            {
                "components": [
                    {"key": "clarity", "label": "Clarity", "max_points": 30},
                    {"key": "accuracy", "label": "Accuracy", "max_points": 20},
                ]
            },
            max_score=60,
        )


def test_resolve_component_scores_merges_ai_and_manual_inputs():
    scheme_id = uuid4()
    clarity = _component(
        scheme_version_id=scheme_id,
        key="clarity",
        label="Clarity",
        max_points=10,
        display_order=0,
        is_auto_gradable=True,
    )
    confidence = _component(
        scheme_version_id=scheme_id,
        key="confidence",
        label="Confidence",
        max_points=10,
        display_order=1,
        manual_only=True,
    )
    scheme = TaskGradingSchemeVersion(
        id=scheme_id,
        task_id=uuid4(),
        version_no=1,
        auto_grading_enabled=True,
        components=[clarity, confidence],
    )
    evaluation = AttemptAiEvaluation(
        id=uuid4(),
        attempt_id=uuid4(),
        status=AiEvaluationStatus.completed,
        component_suggestions=[
            AttemptAiComponentSuggestion(
                id=uuid4(),
                evaluation_id=uuid4(),
                component_id=clarity.id,
                component=clarity,
                suggested_score=8,
                confidence=0.81,
                rationale="Clear structure and strong explanations.",
            )
        ],
    )
    attempt = EnrollmentTaskResult(
        id=uuid4(),
        task_id=uuid4(),
        enrollment_id=uuid4(),
        attempt_no=1,
        max_score_snapshot=20,
        submission_text="A text submission",
        grading_scheme_version=scheme,
        ai_evaluations=[evaluation],
    )

    resolved, raw_total = resolve_component_scores_for_finalization(
        attempt=attempt,
        scheme_version=scheme,
        component_scores=[
            {"component_key": "confidence", "score": 9, "feedback": "Strong delivery."}
        ],
        rubric_scores=None,
        direct_score=None,
        use_ai_suggestions=True,
    )

    by_key = {row["component"].component_key: row for row in resolved}
    assert raw_total == 17
    assert by_key["clarity"]["source"].value == "ai_accepted"
    assert by_key["confidence"]["source"].value == "manual"
    assert derive_attempt_score_source(resolved).value == "hybrid"


def test_resolve_component_scores_supports_single_component_legacy_score():
    scheme_id = uuid4()
    overall = _component(
        scheme_version_id=scheme_id,
        key="overall",
        label="Overall",
        max_points=100,
        display_order=0,
    )
    scheme = TaskGradingSchemeVersion(
        id=scheme_id,
        task_id=uuid4(),
        version_no=1,
        auto_grading_enabled=False,
        components=[overall],
    )
    attempt = EnrollmentTaskResult(
        id=uuid4(),
        task_id=uuid4(),
        enrollment_id=uuid4(),
        attempt_no=1,
        max_score_snapshot=100,
        grading_scheme_version=scheme,
        ai_evaluations=[],
    )

    resolved, raw_total = resolve_component_scores_for_finalization(
        attempt=attempt,
        scheme_version=scheme,
        component_scores=None,
        rubric_scores=None,
        direct_score=77,
        use_ai_suggestions=False,
    )

    assert raw_total == 77
    assert resolved[0]["component"].component_key == "overall"
    assert resolved[0]["source"].value == "legacy"


def test_can_auto_grade_attempt_requires_submission_text_and_auto_component():
    scheme_id = uuid4()
    auto_component = _component(
        scheme_version_id=scheme_id,
        key="analysis",
        label="Analysis",
        max_points=10,
        display_order=0,
        is_auto_gradable=True,
    )
    scheme = TaskGradingSchemeVersion(
        id=scheme_id,
        task_id=uuid4(),
        version_no=1,
        auto_grading_enabled=True,
        components=[auto_component],
    )
    attempt = EnrollmentTaskResult(
        id=uuid4(),
        task_id=uuid4(),
        enrollment_id=uuid4(),
        attempt_no=1,
        max_score_snapshot=10,
        grading_scheme_version=scheme,
        submission_text=None,
    )

    assert can_auto_grade_attempt(attempt, scheme) is False
    attempt.submission_text = "This submission can be evaluated."
    assert can_auto_grade_attempt(attempt, scheme) is True
