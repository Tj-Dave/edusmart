from app.db.postgres import SessionLocal
from app.db.crud_users import create_user_local
from app.db.models import UserRole

db = SessionLocal()
u = create_user_local(
    db,
    username="student001",
    password="pass1234",
    role=UserRole.student,
    email=None
)
print(u.id, u.username, u.role, u.auth_provider)
db.close()
