from app.services.notification.service import NotificationService
from app.db.postgres import SessionLocal

def handle_event(event_type: str, payload: dict):
    db = SessionLocal()
    try:
        service = NotificationService(db)
        if event_type == "STUDENT_ENROLLED":
            service.handle_student_enrolled(payload)
        elif event_type == "ASSIGNMENT_DEADLINE":
            service.handle_deadline(payload)
        # Add more event handlers as needed
    finally:
        db.close()
