from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse
from app.core.sse_manager import manager
import json

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
