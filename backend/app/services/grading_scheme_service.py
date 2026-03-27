from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    AiEvaluationStatus,
    AttemptAiComponentSuggestion,
    AttemptAiEvaluation,
    AttemptComponentScore,
    AttemptScoreSource,
    ComponentScoreSource,
    EnrollmentTaskResult,
    GradingTemplateComponent,
    GradingTemplateVersion,
    RoadmapAssessmentTask,
    TaskGradingComponent,
    TaskGradingSchemeVersion,
    TaskComponentRubricLevel,
)
from app.services.domain_errors import ServiceConflictError, ServiceNotFoundError, ServiceValidationError


POINT_TOLERANCE = 0.01


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _normalize_component_key(raw: str) -> str:
    key = re.sub(r"[^a-z0-9]+", "_", (raw or "").strip().lower()).strip("_")
    return key or "component"


def _ensure_unique_key(base_key: str, used: set[str]) -> str:
    candidate = base_key
    suffix = 2
    while candidate in used:
        candidate = f"{base_key}_{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate


def _assert_points_close(actual: float, expected: float, *, message: str) -> None:
    if abs(float(actual) - float(expected)) > POINT_TOLERANCE:
        raise ServiceValidationError(message)


def _normalize_components(raw_components: list[dict[str, Any]], *, max_score: float) -> list[dict[str, Any]]:
    if not raw_components:
        raise ServiceValidationError("grading_scheme.components must contain at least one component")

    used_keys: set[str] = set()
    out: list[dict[str, Any]] = []
    total = 0.0

    for index, raw in enumerate(raw_components):
        label = str(raw.get("label") or "").strip()
        if not label:
            raise ServiceValidationError("Each grading component requires a non-empty label")

        raw_key = str(raw.get("key") or label).strip()
        key = _ensure_unique_key(_normalize_component_key(raw_key), used_keys)

        try:
            max_points = float(raw.get("max_points"))
        except Exception as err:
            raise ServiceValidationError(f"Component '{label}' max_points must be numeric") from err

        if max_points <= 0:
            raise ServiceValidationError(f"Component '{label}' max_points must be greater than 0")

        is_auto_gradable = bool(raw.get("is_auto_gradable", False))
        manual_only = bool(raw.get("manual_only", False))
        if manual_only and is_auto_gradable:
            raise ServiceValidationError(f"Component '{label}' cannot be both manual_only and auto_gradable")

        display_order = int(raw.get("display_order", index))
        if display_order < 0:
            raise ServiceValidationError(f"Component '{label}' display_order must be >= 0")

        component = {
            "key": key,
            "label": label,
            "description": raw.get("description"),
            "max_points": round(max_points, 4),
            "display_order": display_order,
            "is_auto_gradable": is_auto_gradable,
            "manual_only": manual_only,
        }
        out.append(component)
        total += max_points

    _assert_points_close(
        total,
        max_score,
        message=f"Component max_points must sum to task max_score ({float(max_score):.2f})",
    )

    return sorted(out, key=lambda item: (item["display_order"], item["label"].lower()))


def _normalize_rubric_levels(
    raw_levels: list[dict[str, Any]],
    *,
    components: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_key = {component["key"]: component for component in components}
    out: list[dict[str, Any]] = []

    for index, raw in enumerate(raw_levels):
        component_key = _normalize_component_key(str(raw.get("component_key") or "").strip())
        if component_key not in by_key:
            raise ServiceValidationError(f"Rubric level references unknown component '{component_key}'")

        label = str(raw.get("label") or "").strip()
        descriptor = str(raw.get("descriptor") or "").strip()
        if not label or not descriptor:
            raise ServiceValidationError("Each rubric level requires non-empty label and descriptor")

        try:
            min_points = float(raw.get("min_points"))
            max_points = float(raw.get("max_points"))
        except Exception as err:
            raise ServiceValidationError(f"Rubric level '{label}' point range must be numeric") from err

        if min_points < 0 or max_points < min_points:
            raise ServiceValidationError(f"Rubric level '{label}' has an invalid point range")

        component_max = float(by_key[component_key]["max_points"])
        if max_points > component_max + POINT_TOLERANCE:
            raise ServiceValidationError(
                f"Rubric level '{label}' exceeds the max_points for component '{by_key[component_key]['label']}'"
            )

        display_order = int(raw.get("display_order", index))
        if display_order < 0:
            raise ServiceValidationError(f"Rubric level '{label}' display_order must be >= 0")

        out.append(
            {
                "component_key": component_key,
                "label": label,
                "min_points": round(min_points, 4),
                "max_points": round(max_points, 4),
                "descriptor": descriptor,
                "display_order": display_order,
            }
        )

    return sorted(out, key=lambda item: (item["component_key"], item["display_order"], item["label"].lower()))


def normalize_grading_scheme_payload(
    grading_scheme: dict[str, Any] | None,
    *,
    max_score: float,
) -> dict[str, Any]:
    if grading_scheme is None:
        raise ServiceValidationError("grading_scheme is required")

    components = _normalize_components(list(grading_scheme.get("components") or []), max_score=max_score)
    rubric_levels = _normalize_rubric_levels(list(grading_scheme.get("rubric_levels") or []), components=components)

    return {
        "scheme_name": str(grading_scheme.get("scheme_name") or "").strip() or None,
        "auto_grading_enabled": bool(grading_scheme.get("auto_grading_enabled", False)),
        "auto_grading_instructions": grading_scheme.get("auto_grading_instructions"),
        "components": components,
        "rubric_levels": rubric_levels,
    }


def default_grading_scheme_payload(task: RoadmapAssessmentTask) -> dict[str, Any]:
    components: list[dict[str, Any]]
    rubric_json = task.rubric_json if isinstance(task.rubric_json, dict) else None
    if rubric_json:
        used_keys: set[str] = set()
        components = []
        for index, (label, points) in enumerate(rubric_json.items()):
            label_text = str(label).strip()
            if not label_text:
                continue
            key = _ensure_unique_key(_normalize_component_key(label_text), used_keys)
            components.append(
                {
                    "key": key,
                    "label": label_text,
                    "description": None,
                    "max_points": round(float(points), 4),
                    "display_order": index,
                    "is_auto_gradable": False,
                    "manual_only": False,
                }
            )
        if components:
            total = sum(float(component["max_points"]) for component in components)
            _assert_points_close(
                total,
                float(task.max_score),
                message=f"Legacy rubric_json total must match task max_score ({float(task.max_score):.2f})",
            )
        else:
            components = []
    else:
        components = []

    if not components:
        components = [
            {
                "key": "overall",
                "label": "Overall",
                "description": None,
                "max_points": round(float(task.max_score), 4),
                "display_order": 0,
                "is_auto_gradable": False,
                "manual_only": False,
            }
        ]

    return {
        "scheme_name": task.title,
        "auto_grading_enabled": False,
        "auto_grading_instructions": None,
        "components": components,
        "rubric_levels": [],
    }


def grading_scheme_payload_from_template_version(template_version: GradingTemplateVersion) -> dict[str, Any]:
    return {
        "scheme_name": template_version.scheme_name,
        "auto_grading_enabled": bool(template_version.auto_grading_enabled),
        "auto_grading_instructions": template_version.auto_grading_instructions,
        "components": [
            {
                "key": component.component_key,
                "label": component.label,
                "description": component.description,
                "max_points": _to_float(component.max_points),
                "display_order": component.display_order,
                "is_auto_gradable": bool(component.is_auto_gradable),
                "manual_only": bool(component.manual_only),
            }
            for component in template_version.components
        ],
        "rubric_levels": [
            {
                "component_key": component.component_key,
                "label": level.label,
                "min_points": _to_float(level.min_points),
                "max_points": _to_float(level.max_points),
                "descriptor": level.descriptor,
                "display_order": level.display_order,
            }
            for component in template_version.components
            for level in component.rubric_levels
        ],
    }


def legacy_rubric_json_from_scheme(scheme_version: TaskGradingSchemeVersion) -> dict[str, float]:
    return {
        component.label: round(_to_float(component.max_points) or 0.0, 4)
        for component in scheme_version.components
    }


def serialize_scheme_version(scheme_version: TaskGradingSchemeVersion | None) -> dict[str, Any] | None:
    if scheme_version is None:
        return None

    components = []
    for component in sorted(
        list(scheme_version.components),
        key=lambda item: (item.display_order, item.label.lower()),
    ):
        components.append(
            {
                "id": component.id,
                "key": component.component_key,
                "label": component.label,
                "description": component.description,
                "max_points": _to_float(component.max_points),
                "display_order": component.display_order,
                "is_auto_gradable": bool(component.is_auto_gradable),
                "manual_only": bool(component.manual_only),
                "rubric_levels": [
                    {
                        "id": level.id,
                        "component_key": component.component_key,
                        "label": level.label,
                        "min_points": _to_float(level.min_points),
                        "max_points": _to_float(level.max_points),
                        "descriptor": level.descriptor,
                        "display_order": level.display_order,
                    }
                    for level in sorted(
                        list(component.rubric_levels),
                        key=lambda item: (item.display_order, item.label.lower()),
                    )
                ],
            }
        )

    return {
        "id": scheme_version.id,
        "task_id": scheme_version.task_id,
        "version_no": scheme_version.version_no,
        "scheme_name": scheme_version.scheme_name,
        "source_template_version_id": scheme_version.source_template_version_id,
        "auto_grading_enabled": bool(scheme_version.auto_grading_enabled),
        "auto_grading_instructions": scheme_version.auto_grading_instructions,
        "created_by_user_id": scheme_version.created_by_user_id,
        "created_at": scheme_version.created_at,
        "components": components,
    }


def serialize_component_score(score_row: AttemptComponentScore) -> dict[str, Any]:
    component = score_row.component
    return {
        "id": score_row.id,
        "component_id": component.id,
        "component_key": component.component_key,
        "component_label": component.label,
        "max_points": _to_float(component.max_points),
        "score": _to_float(score_row.score),
        "feedback": score_row.feedback,
        "source": score_row.source.value if hasattr(score_row.source, "value") else str(score_row.source),
        "created_by_user_id": score_row.created_by_user_id,
        "created_at": score_row.created_at,
        "updated_at": score_row.updated_at,
    }


def serialize_ai_evaluation(evaluation: AttemptAiEvaluation | None) -> dict[str, Any] | None:
    if evaluation is None:
        return None

    return {
        "id": evaluation.id,
        "status": evaluation.status.value if hasattr(evaluation.status, "value") else str(evaluation.status),
        "trigger_source": evaluation.trigger_source,
        "provider": evaluation.provider,
        "model_name": evaluation.model_name,
        "overall_confidence": _to_float(evaluation.overall_confidence),
        "suggested_total_score": _to_float(evaluation.suggested_total_score),
        "error_text": evaluation.error_text,
        "started_at": evaluation.started_at,
        "completed_at": evaluation.completed_at,
        "created_at": evaluation.created_at,
        "updated_at": evaluation.updated_at,
        "component_suggestions": [
            {
                "id": suggestion.id,
                "component_id": suggestion.component_id,
                "component_key": suggestion.component.component_key,
                "component_label": suggestion.component.label,
                "max_points": _to_float(suggestion.component.max_points),
                "suggested_score": _to_float(suggestion.suggested_score),
                "confidence": _to_float(suggestion.confidence),
                "rationale": suggestion.rationale,
                "created_at": suggestion.created_at,
            }
            for suggestion in sorted(
                list(evaluation.component_suggestions),
                key=lambda item: (item.component.display_order, item.component.label.lower()),
            )
        ],
    }


def create_task_grading_scheme_version(
    db: Session,
    *,
    task: RoadmapAssessmentTask,
    grading_scheme: dict[str, Any],
    actor_user_id: str | None = None,
    source_template_version_id: UUID | str | None = None,
) -> TaskGradingSchemeVersion:
    normalized = normalize_grading_scheme_payload(grading_scheme, max_score=float(task.max_score))
    latest_version = (
        db.query(TaskGradingSchemeVersion.version_no)
        .filter(TaskGradingSchemeVersion.task_id == task.id)
        .order_by(TaskGradingSchemeVersion.version_no.desc())
        .first()
    )
    next_version_no = int(latest_version[0]) + 1 if latest_version else 1

    scheme_version = TaskGradingSchemeVersion(
        task_id=task.id,
        version_no=next_version_no,
        scheme_name=normalized["scheme_name"],
        source_template_version_id=source_template_version_id,
        auto_grading_enabled=normalized["auto_grading_enabled"],
        auto_grading_instructions=normalized["auto_grading_instructions"],
        created_by_user_id=actor_user_id,
    )
    db.add(scheme_version)
    db.flush()

    component_rows: dict[str, TaskGradingComponent] = {}
    for component in normalized["components"]:
        row = TaskGradingComponent(
            scheme_version_id=scheme_version.id,
            component_key=component["key"],
            label=component["label"],
            description=component["description"],
            max_points=component["max_points"],
            display_order=component["display_order"],
            is_auto_gradable=component["is_auto_gradable"],
            manual_only=component["manual_only"],
        )
        db.add(row)
        db.flush()
        component_rows[component["key"]] = row

    for level in normalized["rubric_levels"]:
        db.add(
            TaskComponentRubricLevel(
                component_id=component_rows[level["component_key"]].id,
                label=level["label"],
                min_points=level["min_points"],
                max_points=level["max_points"],
                descriptor=level["descriptor"],
                display_order=level["display_order"],
            )
        )

    db.flush()
    db.refresh(scheme_version)
    task.current_grading_scheme_version_id = scheme_version.id
    task.rubric_json = legacy_rubric_json_from_scheme(scheme_version)
    db.flush()
    return scheme_version


def ensure_task_grading_scheme(
    db: Session,
    *,
    task: RoadmapAssessmentTask,
    actor_user_id: str | None = None,
) -> TaskGradingSchemeVersion:
    scheme_version = None
    if task.current_grading_scheme_version_id:
        scheme_version = (
            db.query(TaskGradingSchemeVersion)
            .options(
                joinedload(TaskGradingSchemeVersion.components).joinedload(TaskGradingComponent.rubric_levels)
            )
            .filter(TaskGradingSchemeVersion.id == task.current_grading_scheme_version_id)
            .one_or_none()
        )
    if scheme_version is not None:
        return scheme_version

    create_task_grading_scheme_version(
        db,
        task=task,
        grading_scheme=default_grading_scheme_payload(task),
        actor_user_id=actor_user_id,
    )
    scheme_version = (
        db.query(TaskGradingSchemeVersion)
        .options(
            joinedload(TaskGradingSchemeVersion.components).joinedload(TaskGradingComponent.rubric_levels)
        )
        .filter(TaskGradingSchemeVersion.id == task.current_grading_scheme_version_id)
        .one()
    )
    return scheme_version


def get_task_grading_scheme_or_404(
    db: Session,
    *,
    task_id: UUID,
) -> TaskGradingSchemeVersion:
    task = db.query(RoadmapAssessmentTask).filter(RoadmapAssessmentTask.id == task_id).one_or_none()
    if not task:
        raise ServiceNotFoundError("Assessment task not found")
    return ensure_task_grading_scheme(db, task=task)


def load_template_version_or_404(db: Session, template_version_id: UUID) -> GradingTemplateVersion:
    version = (
        db.query(GradingTemplateVersion)
        .options(
            joinedload(GradingTemplateVersion.components).joinedload(GradingTemplateComponent.rubric_levels)
        )
        .filter(GradingTemplateVersion.id == template_version_id)
        .one_or_none()
    )
    if not version:
        raise ServiceNotFoundError("Grading template version not found")
    return version


def create_task_scheme_from_template_version(
    db: Session,
    *,
    task: RoadmapAssessmentTask,
    template_version: GradingTemplateVersion,
    actor_user_id: str | None = None,
) -> TaskGradingSchemeVersion:
    return create_task_grading_scheme_version(
        db,
        task=task,
        grading_scheme=grading_scheme_payload_from_template_version(template_version),
        actor_user_id=actor_user_id,
        source_template_version_id=template_version.id,
    )


def load_attempt_with_grading_or_404(
    db: Session,
    *,
    enrollment_id: UUID,
    task_id: UUID,
    attempt_no: int,
) -> EnrollmentTaskResult:
    attempt = (
        db.query(EnrollmentTaskResult)
        .options(
            joinedload(EnrollmentTaskResult.grading_scheme_version)
            .joinedload(TaskGradingSchemeVersion.components)
            .joinedload(TaskGradingComponent.rubric_levels),
            joinedload(EnrollmentTaskResult.component_scores).joinedload(AttemptComponentScore.component),
            joinedload(EnrollmentTaskResult.latest_ai_evaluation)
            .joinedload(AttemptAiEvaluation.component_suggestions)
            .joinedload(AttemptAiComponentSuggestion.component),
            joinedload(EnrollmentTaskResult.ai_evaluations)
            .joinedload(AttemptAiEvaluation.component_suggestions)
            .joinedload(AttemptAiComponentSuggestion.component),
        )
        .filter(
            EnrollmentTaskResult.enrollment_id == enrollment_id,
            EnrollmentTaskResult.task_id == task_id,
            EnrollmentTaskResult.attempt_no == attempt_no,
        )
        .one_or_none()
    )
    if not attempt:
        raise ServiceNotFoundError("Attempt not found")
    return attempt


def get_latest_completed_ai_evaluation(attempt: EnrollmentTaskResult) -> AttemptAiEvaluation | None:
    completed = [
        evaluation
        for evaluation in attempt.ai_evaluations
        if (evaluation.status.value if hasattr(evaluation.status, "value") else str(evaluation.status))
        == AiEvaluationStatus.completed.value
    ]
    if not completed:
        return None
    return sorted(completed, key=lambda item: item.created_at or _now())[-1]


def can_auto_grade_attempt(attempt: EnrollmentTaskResult, scheme_version: TaskGradingSchemeVersion | None) -> bool:
    if scheme_version is None or not bool(scheme_version.auto_grading_enabled):
        return False
    if not (attempt.submission_text and attempt.submission_text.strip()):
        return False
    return any(bool(component.is_auto_gradable) for component in scheme_version.components)


def create_pending_ai_evaluation(
    db: Session,
    *,
    attempt: EnrollmentTaskResult,
    trigger_source: str = "auto_submit",
) -> AttemptAiEvaluation:
    evaluation = AttemptAiEvaluation(
        attempt_id=attempt.id,
        status=AiEvaluationStatus.pending,
        trigger_source=trigger_source,
    )
    db.add(evaluation)
    db.flush()
    attempt.latest_ai_evaluation_id = evaluation.id
    db.flush()
    return evaluation


def get_component_alias_map(scheme_version: TaskGradingSchemeVersion) -> dict[str, TaskGradingComponent]:
    aliases: dict[str, TaskGradingComponent] = {}
    for component in scheme_version.components:
        aliases[component.component_key.lower()] = component
        aliases[_normalize_component_key(component.component_key)] = component
        aliases[_normalize_component_key(component.label)] = component
        aliases[component.label.lower()] = component
    return aliases


def map_legacy_rubric_scores_to_component_inputs(
    scheme_version: TaskGradingSchemeVersion,
    rubric_scores: dict[str, float],
) -> list[dict[str, Any]]:
    aliases = get_component_alias_map(scheme_version)
    resolved: list[dict[str, Any]] = []

    for raw_key, raw_score in rubric_scores.items():
        lookup = str(raw_key or "").strip()
        component = aliases.get(lookup.lower()) or aliases.get(_normalize_component_key(lookup))
        if component is None:
            raise ServiceValidationError(f"rubric_scores contains unknown criterion '{lookup}'")
        resolved.append(
            {
                "component": component,
                "score": float(raw_score),
                "feedback": None,
                "source": ComponentScoreSource.legacy,
            }
        )

    return resolved


def resolve_component_scores_for_finalization(
    *,
    attempt: EnrollmentTaskResult,
    scheme_version: TaskGradingSchemeVersion,
    component_scores: list[dict[str, Any]] | None = None,
    rubric_scores: dict[str, float] | None = None,
    direct_score: float | None = None,
    use_ai_suggestions: bool = False,
) -> tuple[list[dict[str, Any]], float]:
    if component_scores and rubric_scores:
        raise ServiceValidationError("Provide either component_scores or rubric_scores, not both")

    aliases = get_component_alias_map(scheme_version)
    resolved: dict[str, dict[str, Any]] = {}

    if component_scores:
        for raw in component_scores:
            lookup = str(raw.get("component_key") or "").strip()
            component = aliases.get(lookup.lower()) or aliases.get(_normalize_component_key(lookup))
            if component is None:
                raise ServiceValidationError(f"component_scores contains unknown component '{lookup}'")
            if component.component_key in resolved:
                raise ServiceValidationError(f"Duplicate component score provided for '{component.label}'")
            score_value = float(raw.get("score"))
            max_points = _to_float(component.max_points) or 0.0
            if score_value < 0 or score_value > max_points + POINT_TOLERANCE:
                raise ServiceValidationError(f"Score for '{component.label}' must be between 0 and {max_points:.2f}")
            resolved[component.component_key] = {
                "component": component,
                "score": min(score_value, max_points),
                "feedback": raw.get("feedback"),
                "source": ComponentScoreSource.manual,
            }

    if rubric_scores:
        for row in map_legacy_rubric_scores_to_component_inputs(scheme_version, rubric_scores):
            component = row["component"]
            score_value = float(row["score"])
            max_points = _to_float(component.max_points) or 0.0
            if score_value < 0 or score_value > max_points + POINT_TOLERANCE:
                raise ServiceValidationError(f"Score for '{component.label}' must be between 0 and {max_points:.2f}")
            resolved[component.component_key] = {
                "component": component,
                "score": min(score_value, max_points),
                "feedback": None,
                "source": ComponentScoreSource.legacy,
            }

    if use_ai_suggestions:
        evaluation = get_latest_completed_ai_evaluation(attempt)
        if evaluation is None:
            raise ServiceConflictError("No completed AI suggestions are available for this attempt")
        for suggestion in evaluation.component_suggestions:
            component = suggestion.component
            if component.component_key in resolved:
                continue
            resolved[component.component_key] = {
                "component": component,
                "score": min(
                    _to_float(suggestion.suggested_score) or 0.0,
                    _to_float(component.max_points) or 0.0,
                ),
                "feedback": suggestion.rationale,
                "source": ComponentScoreSource.ai_accepted,
            }

    ordered_components = sorted(
        list(scheme_version.components),
        key=lambda item: (item.display_order, item.label.lower()),
    )

    if not resolved and direct_score is not None:
        if len(ordered_components) != 1:
            raise ServiceValidationError(
                "score without component_scores is only supported for single-component grading schemes"
            )
        only_component = ordered_components[0]
        max_points = _to_float(only_component.max_points) or 0.0
        if direct_score < 0 or direct_score > max_points + POINT_TOLERANCE:
            raise ServiceValidationError(f"score must be between 0 and {max_points:.2f}")
        resolved[only_component.component_key] = {
            "component": only_component,
            "score": min(float(direct_score), max_points),
            "feedback": None,
            "source": ComponentScoreSource.legacy,
        }

    missing = [component.label for component in ordered_components if component.component_key not in resolved]
    if missing:
        raise ServiceValidationError(f"Missing component scores for: {', '.join(missing)}")

    ordered_rows = [
        resolved[component.component_key]
        for component in ordered_components
    ]
    raw_total = sum(float(row["score"]) for row in ordered_rows)

    if direct_score is not None:
        _assert_points_close(
            raw_total,
            float(direct_score),
            message="score does not match the supplied component totals",
        )

    return ordered_rows, raw_total


def persist_component_scores(
    db: Session,
    *,
    attempt: EnrollmentTaskResult,
    actor_user_id: UUID | str | None,
    resolved_scores: list[dict[str, Any]],
) -> list[AttemptComponentScore]:
    existing = {row.component_id: row for row in attempt.component_scores}
    keep_ids: set[str] = set()
    rows: list[AttemptComponentScore] = []

    for row in resolved_scores:
        component = row["component"]
        db_row = existing.get(component.id)
        if db_row is None:
            db_row = AttemptComponentScore(
                attempt_id=attempt.id,
                component_id=component.id,
            )
            db.add(db_row)
        db_row.score = round(float(row["score"]), 4)
        db_row.feedback = row.get("feedback")
        db_row.source = row["source"]
        db_row.created_by_user_id = actor_user_id
        keep_ids.add(component.id)
        rows.append(db_row)

    for component_id, db_row in existing.items():
        if component_id not in keep_ids:
            db.delete(db_row)

    db.flush()
    return rows


def derive_attempt_score_source(component_rows: list[dict[str, Any]]) -> AttemptScoreSource:
    sources = {row["source"] for row in component_rows}
    if sources == {ComponentScoreSource.ai_accepted}:
        return AttemptScoreSource.ai_accepted
    if sources == {ComponentScoreSource.legacy}:
        return AttemptScoreSource.legacy
    if sources == {ComponentScoreSource.manual}:
        return AttemptScoreSource.manual
    return AttemptScoreSource.hybrid


def legacy_rubric_scores_from_component_rows(component_rows: list[AttemptComponentScore]) -> dict[str, float]:
    return {
        row.component.label: round(_to_float(row.score) or 0.0, 4)
        for row in component_rows
    }


def build_attempt_grading_detail(attempt: EnrollmentTaskResult) -> dict[str, Any]:
    latest_ai = attempt.latest_ai_evaluation or get_latest_completed_ai_evaluation(attempt)
    return {
        "attempt": attempt,
        "grading_scheme": serialize_scheme_version(attempt.grading_scheme_version),
        "component_scores": [
            serialize_component_score(row)
            for row in sorted(
                list(attempt.component_scores),
                key=lambda item: (item.component.display_order, item.component.label.lower()),
            )
        ],
        "latest_ai_evaluation": serialize_ai_evaluation(latest_ai),
    }
