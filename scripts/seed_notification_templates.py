from sqlalchemy.orm import sessionmaker
from app.db.models import NotificationTemplate
from app.db.postgres import engine

Session = sessionmaker(bind=engine)

templates = [
    {
        "event_type": "student_enrolled",
        "title_template": "Enrollment Confirmed",
        "body_template": "Hello {{user_name}}, you are now enrolled in {{course_name}}!"
    },
    {
        "event_type": "assignment_due",
        "title_template": "Assignment Deadline",
        "body_template": "Reminder: {{assignment_name}} is due on {{due_date}}."
    },
    {
        "event_type": "roadmap_unlocked",
        "title_template": "New Roadmap Available",
        "body_template": "Congrats {{user_name}}! The {{roadmap_name}} roadmap is now available."
    },
    {
        "event_type": "grade_posted",
        "title_template": "Grade Available",
        "body_template": "Your grade for {{assignment_name}} is {{grade}}."
    },
    {
        "event_type": "course_announcement",
        "title_template": "Announcement from {{course_name}}",
        "body_template": "{{announcement_message}}"
    }
]

def seed_templates():
    session = Session()
    for t in templates:
        exists = session.query(NotificationTemplate).filter_by(event_type=t["event_type"]).first()
        if not exists:
            session.add(NotificationTemplate(**t))
    session.commit()
    session.close()

if __name__ == "__main__":
    seed_templates()
