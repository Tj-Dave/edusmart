from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    GradingTemplate,
    GradingTemplateComponent,
    GradingTemplateRubricLevel,
    GradingTemplateVersion,
    User,
)
from app.services.access_control import is_lecturer, require_role
from app.services.domain_errors import ServiceNotFoundError, ServicePermissionError
from app.services.grading_scheme_service import normalize_grading_scheme_payload


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _serialize_template_version(version: GradingTemplateVersion) -> dict[str, Any]:
    return {
        "id": version.id,
        "template_id": version.template_id,
        "version_no": version.version_no,
        "scheme_name": version.scheme_name,
        "auto_grading_enabled": bool(version.auto_grading_enabled),
        "auto_grading_instructions": version.auto_grading_instructions,
        "created_by_user_id": version.created_by_user_id,
        "created_at": version.created_at,
        "components": [
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
            for component in sorted(
                list(version.components),
                key=lambda item: (item.display_order, item.label.lower()),
            )
        ],
    }


def serialize_template(template: GradingTemplate) -> dict[str, Any]:
    return {
        "id": template.id,
        "owner_user_id": template.owner_user_id,
        "name": template.name,
        "description": template.description,
        "is_active": bool(template.is_active),
        "latest_version_no": template.latest_version_no,
        "created_at": template.created_at,
        "updated_at": template.updated_at,
        "versions": [
            _serialize_template_version(version)
            for version in sorted(list(template.versions), key=lambda item: item.version_no)
        ],
    }


def _template_query(db: Session):
    return db.query(GradingTemplate).options(
        joinedload(GradingTemplate.versions)
        .joinedload(GradingTemplateVersion.components)
        .joinedload(GradingTemplateComponent.rubric_levels)
    )


def _get_template_or_404(db: Session, template_id: UUID) -> GradingTemplate:
    template = _template_query(db).filter(GradingTemplate.id == template_id).one_or_none()
    if not template:
        raise ServiceNotFoundError("Grading template not found")
    return template


def get_template_version_for_actor(
    db: Session,
    *,
    template_version_id: UUID,
    actor: User,
) -> GradingTemplateVersion:
    version = (
        db.query(GradingTemplateVersion)
        .options(
            joinedload(GradingTemplateVersion.template),
            joinedload(GradingTemplateVersion.components)
            .joinedload(GradingTemplateComponent.rubric_levels),
        )
        .filter(GradingTemplateVersion.id == template_version_id)
        .one_or_none()
    )
    if not version:
        raise ServiceNotFoundError("Grading template version not found")
    _require_template_access(version.template, actor)
    return version


def _require_template_access(template: GradingTemplate, actor: User) -> None:
    if not is_lecturer(actor):
        raise ServicePermissionError("Only lecturers can access grading templates")
    if str(template.owner_user_id) != str(actor.id):
        raise ServicePermissionError("You can only access your own grading templates")


def _append_template_version(
    db: Session,
    *,
    template: GradingTemplate,
    grading_scheme: dict[str, Any],
    actor: User,
) -> GradingTemplateVersion:
    normalized = normalize_grading_scheme_payload(grading_scheme, max_score=sum(
        float(component["max_points"]) for component in grading_scheme.get("components") or []
    ))
    next_version_no = int(template.latest_version_no or 0) + 1
    version = GradingTemplateVersion(
        template_id=template.id,
        version_no=next_version_no,
        scheme_name=normalized["scheme_name"],
        auto_grading_enabled=normalized["auto_grading_enabled"],
        auto_grading_instructions=normalized["auto_grading_instructions"],
        created_by_user_id=actor.id,
    )
    db.add(version)
    db.flush()

    component_rows: dict[str, GradingTemplateComponent] = {}
    for component in normalized["components"]:
        row = GradingTemplateComponent(
            template_version_id=version.id,
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
            GradingTemplateRubricLevel(
                component_id=component_rows[level["component_key"]].id,
                label=level["label"],
                min_points=level["min_points"],
                max_points=level["max_points"],
                descriptor=level["descriptor"],
                display_order=level["display_order"],
            )
        )

    template.latest_version_no = next_version_no
    db.flush()
    return version


def create_template(
    db: Session,
    *,
    actor: User,
    payload: dict[str, Any],
) -> dict[str, Any]:
    require_role(actor, allowed={"lecturer"})
    template = GradingTemplate(
        owner_user_id=actor.id,
        name=payload["name"],
        description=payload.get("description"),
        is_active=True,
        latest_version_no=0,
    )
    db.add(template)
    db.flush()
    _append_template_version(db, template=template, grading_scheme=payload["grading_scheme"], actor=actor)
    db.commit()
    return serialize_template(_get_template_or_404(db, template.id))


def list_templates(
    db: Session,
    *,
    actor: User,
) -> list[dict[str, Any]]:
    require_role(actor, allowed={"lecturer"})
    query = _template_query(db)
    query = query.filter(GradingTemplate.owner_user_id == actor.id)
    templates = query.order_by(GradingTemplate.updated_at.desc()).all()
    return [serialize_template(template) for template in templates]


def get_template(
    db: Session,
    *,
    template_id: UUID,
    actor: User,
) -> dict[str, Any]:
    template = _get_template_or_404(db, template_id)
    _require_template_access(template, actor)
    return serialize_template(template)


def update_template(
    db: Session,
    *,
    template_id: UUID,
    actor: User,
    payload: dict[str, Any],
) -> dict[str, Any]:
    template = _get_template_or_404(db, template_id)
    _require_template_access(template, actor)

    if "name" in payload and payload["name"] is not None:
        template.name = payload["name"]
    if "description" in payload:
        template.description = payload.get("description")
    if "is_active" in payload and payload["is_active"] is not None:
        template.is_active = bool(payload["is_active"])
    if payload.get("grading_scheme") is not None:
        _append_template_version(db, template=template, grading_scheme=payload["grading_scheme"], actor=actor)

    db.commit()
    return serialize_template(_get_template_or_404(db, template.id))
