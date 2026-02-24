from app.db import models
from app.services.notification.templates import NotificationTemplateService
from app.services.notification.dispatcher import NotificationDispatcher
from sqlalchemy.orm import Session
from typing import Any, Dict

class NotificationService:
        def handle_student_enrolled(self, payload: dict):
            user_id = payload["user_id"]
            course_name = payload["course_name"]
            title = f"Welcome to {course_name} 🎉"
            message = "Your roadmap is now available."
            self.create_notification(user_id, title, message, "STUDENT_ENROLLED", payload)

        def handle_deadline(self, payload: dict):
            user_id = payload["user_id"]
            assignment = payload["assignment_name"]
            due = payload["due_date"]
            title = f"Assignment Due: {assignment}"
            message = f"Your assignment is due on {due}."
            self.create_notification(user_id, title, message, "ASSIGNMENT_DEADLINE", payload)

    def create_notification(self, user_id, title, message, event_type, metadata):
        # Store notification in DB (in-app)
        from app.db import models
        notification = models.Notification(
            user_id=user_id,
            type=event_type,
            title=title,
            message=message,
            channel="in_app",
            is_read=False,
            metadata=metadata
        )
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)

        # Push via SSE
        try:
            from app.core.sse_manager import manager
            import asyncio
            loop = asyncio.get_event_loop()
            loop.create_task(manager.send_to_user(
                user_id,
                {
                    "id": str(notification.id),
                    "title": notification.title,
                    "message": notification.message,
                    "type": notification.type,
                    "metadata": notification.metadata,
                    "created_at": str(notification.created_at)
                }
            ))
        except Exception:
            pass  # SSE push is best-effort
    def __init__(self, db: Session):
        self.db = db
        self.template_service = NotificationTemplateService(db)
        self.dispatcher = NotificationDispatcher(db)

    def notify(self, event_type: str, user_id: str, data: Dict[str, Any]):
        """
        Main entrypoint: handle an event and send notification(s).
        """
        template = self.template_service.get_template(event_type)
        if not template:
            return
        title = self.template_service.render(template.title_template, data)
        message = self.template_service.render(template.body_template, data)
        # Store notification in DB, dispatch via channels
        self.dispatcher.dispatch(user_id, event_type, title, message, data)
