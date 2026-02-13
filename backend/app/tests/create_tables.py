from app.db.postgres import engine
from app.db.base import Base

# IMPORTANT: import models so Base.metadata knows them
import app.db.models  # noqa: F401

def main():
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created (if they didn't exist).")

if __name__ == "__main__":
    main()
