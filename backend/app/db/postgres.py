from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Put it in backend/.env")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,     # auto-detect dead connections
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    FastAPI dependency that yields a DB session per request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
