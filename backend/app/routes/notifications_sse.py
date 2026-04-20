import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from sqlalchemy.orm import Session

from app.core.sse_manager import manager
from app.db.models import Notification, User
from app.db.postgres import get_db
from app.services.auth.deps import get_current_user

router = APIRouter()

@router.get("/notifications/stream/{user_id}")
async def stream_notifications(request: Request, user_id: str):
    queue = await manager.connect(user_id)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                data = await queue.get()
                yield {
                    "event": "notification",
                    "data": json.dumps(data)
                }
        finally:
            manager.disconnect(user_id, queue)

    return EventSourceResponse(event_generator())


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .one_or_none()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.add(notification)
    db.commit()

    return {"ok": True, "id": str(notification.id)}
