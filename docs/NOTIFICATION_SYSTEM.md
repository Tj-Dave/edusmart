# EduSmart Notification System Documentation

## Overview
The notification system provides real-time, scalable, and multi-channel notifications for students, instructors, and admins. It is designed as a modular submodule in the backend, ready for future microservice migration.

---

## Architecture
```
Core Services (Enrollment, Payment, Assignment)
        ↓
Event Bus (Redis + RQ)
        ↓
Notification Worker
        ↓
Notification Service
        ↓
Database
        ↓
SSE (Server-Sent Events) / Email / Push
        ↓
Frontend (React)
```

---

## Database Tables
- **notifications**: Stores all notifications for users.
- **notification_templates**: Stores templates for different event types.
- **notification_preferences**: Stores user preferences for notification channels.

---

## Backend Components
- **NotificationService**: Handles notification creation, template rendering, and dispatching.
- **EventBus**: Emits events to the Redis queue.
- **Notification Worker**: Processes events and triggers notifications.
- **SSEManager**: Manages real-time connections for SSE delivery.

---

## Real-Time Delivery (SSE)
- Endpoint: `/notifications/stream/{user_id}`
- Uses `sse-starlette` for HTTP streaming.
- Clients receive notifications instantly without polling.

---

## API Endpoints
- `GET /notifications`: Fetch all notifications for a user.
- `PATCH /notifications/{id}/read`: Mark a notification as read.
- `GET /notifications/unread-count`: Get unread notification count.
- `GET /notifications/stream/{user_id}`: Subscribe to real-time notifications (SSE).

---

## Frontend Integration
- **NotificationBell**: React component subscribing to SSE, showing unread count and dropdown.
- **NotificationContext**: Global context for notification state, accessible anywhere in the app.

---


## Event Flow Example
```
1. Database and tables are set up (including notification_templates).
2. Run scripts/seed_notification_templates.py to populate notification_templates with starter templates.
3. Student enrolls or other event occurs.
      ↓
4. EnrollmentService emits event via EventBus.
      ↓
5. EventBus queues event in Redis.
      ↓
6. Notification Worker processes event in background.
      ↓
7. NotificationService fetches template, renders message.
      ↓
8. Notification is saved to DB.
      ↓
9. SSEManager pushes notification to frontend client.
      ↓
10. React NotificationBell (with NotificationContext) updates in real-time.
```

---

## Template Seeding

Before using notifications, populate the notification_templates table:

- Run the seed script: `python scripts/seed_notification_templates.py`
- This inserts starter templates for common LMS events (enrollment, assignment, roadmap, grade, announcement).
- You can add more templates as needed for new event types.

---

---

## Extending the System
- Add email/push channels in NotificationDispatcher.
- Add scheduled reminders with RQ/Celery.
- Add analytics and priority queues.
- Move to microservice when scaling needs grow.

---

## Best Practices
- Keep NotificationService decoupled.
- Use templates for all notification types.
- Respect user preferences for channels.
- Use SSE for real-time, email for important events.

---

## References
- [FastAPI](https://fastapi.tiangolo.com/)
- [RQ (Redis Queue)](https://python-rq.org/)
- [sse-starlette](https://github.com/sysid/sse-starlette)
- [React](https://react.dev/)
