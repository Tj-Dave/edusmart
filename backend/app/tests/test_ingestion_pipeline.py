from pathlib import Path
from app.core.config import settings
from app.services.ingestion import IngestionPipeline
from app.db.postgres import SessionLocal

from sqlalchemy import select
from app.db.models import User, UserRole, AuthProvider

def get_or_create_test_lecturer(db):
    u = db.execute(select(User).where(User.username == "lecturer_test")).scalar_one_or_none()
    if u:
        return str(u.id)

    u = User(
        username="lecturer_test",
        role=UserRole.lecturer,
        auth_provider=AuthProvider.local,
        password_hash="hello",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return str(u.id)


def main():
    file_path = (Path(settings.BASE_DIR) / "backend" / "app" / "tests" / "test_data" / "test data.docx").resolve()

    pipe = IngestionPipeline()

    db = SessionLocal()
    try:
        r1 = pipe.ingest(
            file_path,
            course_id="cs101",
            uploader_user_id=get_or_create_test_lecturer(db),
            uploader_role="lecturer",
            course_meta={"course_code": "CS101", "course_title": "Intro to DBMS"},
            extra_meta={"semester": "2025A"},
            reingest_mode="upsert",
            db=db,
        )
        print("\nRUN 1:", r1.model_dump())

        r2 = pipe.ingest(
            file_path,
            course_id="cs101",
            uploader_user_id=get_or_create_test_lecturer(db),
            uploader_role="lecturer",
            course_meta={"course_code": "CS101", "course_title": "Intro to DBMS"},
            extra_meta={"semester": "2025A"},
            reingest_mode="upsert",
            db=db,
        )
        print("\nRUN 2:", r2.model_dump())

        print("\nSame document_id across runs?", r1.document_id == r2.document_id)
    finally:
        db.close()

if __name__ == "__main__":
    main()
