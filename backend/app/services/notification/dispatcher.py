from app.db import models
from sqlalchemy.orm import Session
from typing import Any, Dict

class NotificationDispatcher:
    def __init__(self, db: Session):
        self.db = db

    def dispatch(self, user_id: str, event_type: str, title: str, message: str, data: Dict[str, Any]):
        # Store notification in DB (in-app)
        notification = models.Notification(
            user_id=user_id,
            type=event_type,
            title=title,
            message=message,
            channel="in_app",
            is_read=False,
            metadata=data
        )
        self.db.add(notification)
        self.db.commit()
        # TODO: Add email, push, and real-time dispatch here
