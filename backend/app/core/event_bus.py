from rq import Queue
from app.core.redis import redis_conn

notification_queue = Queue("notifications", connection=redis_conn)

class EventBus:
    @staticmethod
    def emit(event_type: str, payload: dict):
        notification_queue.enqueue(
            "app.workers.notification_worker.handle_event",
            event_type,
            payload
        )
