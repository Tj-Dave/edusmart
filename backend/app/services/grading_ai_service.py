from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import joinedload

from app.db.models import (
    AiEvaluationStatus,
    AttemptAiComponentSuggestion,
    AttemptAiEvaluation,
    EnrollmentTaskResult,
    RoadmapAssessmentTask,
    TaskGradingComponent,
    TaskGradingSchemeVersion,
)
from app.db.postgres import SessionLocal
from app.services.grading_scheme_service import _now, _to_float, can_auto_grade_attempt
from app.services.llm.llama_cpp_subclient import extract_first_json_object


def _clamp(value: float, *, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, float(value)))


def _build_ai_prompt(attempt: EnrollmentTaskResult, scheme_version: TaskGradingSchemeVersion) -> str:
    task: RoadmapAssessmentTask = attempt.task
    auto_components = [
        component
        for component in sorted(
            list(scheme_version.components),
            key=lambda item: (item.display_order, item.label.lower()),
        )
        if component.is_auto_gradable
    ]

    component_blocks: list[str] = []
    for component in auto_components:
        rubric_lines = []
        for level in sorted(
            list(component.rubric_levels),
            key=lambda item: (item.display_order, item.label.lower()),
        ):
            rubric_lines.append(
                f"- {level.label}: {float(level.min_points):.2f}-{float(level.max_points):.2f} points | {level.descriptor}"
            )
        rubric_text = "\n".join(rubric_lines) if rubric_lines else "- No rubric levels provided"
        component_blocks.append(
            "\n".join(
                [
                    f"Component key: {component.component_key}",
                    f"Label: {component.label}",
                    f"Max points: {float(component.max_points):.2f}",
                    f"Description: {component.description or 'N/A'}",
                    "Rubric levels:",
                    rubric_text,
                ]
            )
        )

    return f"""You are assisting a lecturer by generating advisory grading suggestions for a student submission.
Return ONLY valid JSON.

JSON schema:
{{
  "overall_confidence": 0.0,
  "component_suggestions": [
    {{
      "component_key": "clarity",
      "suggested_score": 7.5,
      "confidence": 0.82,
      "rationale": "Short explanation"
    }}
  ]
}}

Rules:
- Only score the listed auto-gradable components.
- Do not include manual-only components.
- Keep each suggested_score between 0 and the component max points.
- Confidence must be between 0 and 1.
- If evidence is weak, lower the confidence instead of inflating the score.

Task title: {task.title}
Task type: {task.task_type.value if hasattr(task.task_type, "value") else str(task.task_type)}
Task description: {task.description or 'N/A'}
Task max score: {float(task.max_score):.2f}
Submission text:
{attempt.submission_text or ''}

Auto-gradable components:
{chr(10).join(component_blocks)}
"""


def process_ai_evaluation(
    *,
    evaluation_id: UUID | str,
    llm_client: Any | None,
) -> None:
    db = SessionLocal()
    try:
        evaluation = (
            db.query(AttemptAiEvaluation)
            .options(
                joinedload(AttemptAiEvaluation.attempt)
                .joinedload(EnrollmentTaskResult.task),
                joinedload(AttemptAiEvaluation.attempt)
                .joinedload(EnrollmentTaskResult.grading_scheme_version)
                .joinedload(TaskGradingSchemeVersion.components)
                .joinedload(TaskGradingComponent.rubric_levels),
            )
            .filter(AttemptAiEvaluation.id == evaluation_id)
            .one_or_none()
        )
        if evaluation is None:
            return

        attempt = evaluation.attempt
        scheme_version = attempt.grading_scheme_version

        if llm_client is None:
            evaluation.status = AiEvaluationStatus.failed
            evaluation.error_text = "AI client is not configured"
            evaluation.completed_at = _now()
            db.commit()
            return

        if scheme_version is None or not can_auto_grade_attempt(attempt, scheme_version):
            evaluation.status = AiEvaluationStatus.failed
            evaluation.error_text = "Attempt is not eligible for auto-grading"
            evaluation.completed_at = _now()
            db.commit()
            return

        evaluation.status = AiEvaluationStatus.running
        evaluation.provider = "llama_cpp"
        evaluation.model_name = llm_client.__class__.__name__
        evaluation.started_at = _now()
        evaluation.error_text = None
        db.commit()

        prompt = _build_ai_prompt(attempt, scheme_version)
        try:
            raw_output = llm_client.generate(prompt, False)
        except TypeError:
            raw_output = llm_client.generate(prompt)

        parsed = extract_first_json_object(raw_output)
        suggestions = parsed.get("component_suggestions") or []

        for old_row in list(evaluation.component_suggestions):
            db.delete(old_row)
        db.flush()

        auto_components = {
            component.component_key: component
            for component in scheme_version.components
            if component.is_auto_gradable
        }
        total = 0.0

        for raw_row in suggestions:
            component_key = str(raw_row.get("component_key") or "").strip().lower()
            component = auto_components.get(component_key)
            if component is None:
                continue

            suggested_score = _clamp(
                float(raw_row.get("suggested_score") or 0.0),
                minimum=0.0,
                maximum=_to_float(component.max_points) or 0.0,
            )
            confidence = raw_row.get("confidence")
            confidence_value = None if confidence is None else _clamp(float(confidence), minimum=0.0, maximum=1.0)
            total += suggested_score

            db.add(
                AttemptAiComponentSuggestion(
                    evaluation_id=evaluation.id,
                    component_id=component.id,
                    suggested_score=round(suggested_score, 4),
                    confidence=None if confidence_value is None else round(confidence_value, 4),
                    rationale=(str(raw_row.get("rationale") or "").strip() or None),
                )
            )

        evaluation.overall_confidence = round(
            _clamp(float(parsed.get("overall_confidence") or 0.0), minimum=0.0, maximum=1.0),
            4,
        )
        evaluation.suggested_total_score = round(total, 4)
        evaluation.raw_response_json = {
            "raw_text": raw_output,
            "parsed": parsed,
        }
        evaluation.status = AiEvaluationStatus.completed
        evaluation.completed_at = _now()
        attempt.latest_ai_evaluation_id = evaluation.id
        db.commit()
    except Exception as err:
        db.rollback()
        evaluation = (
            db.query(AttemptAiEvaluation)
            .filter(AttemptAiEvaluation.id == evaluation_id)
            .one_or_none()
        )
        if evaluation is not None:
            evaluation.status = AiEvaluationStatus.failed
            evaluation.error_text = str(err)
            evaluation.completed_at = _now()
            db.commit()
    finally:
        db.close()
