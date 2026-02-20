#!/usr/bin/env python3
from app.db.base import Base
from app.db.models import *  # Import all models
from app.db.postgres import engine

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("✅ All missing tables created successfully!")
