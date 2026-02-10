#!/usr/bin/env python3
"""
Initialize the database schema by creating all tables.
Run this once before starting the server.
"""
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

# Import database components directly
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.db.models import User, UserProfile, AuthSession, ChatSession, ChatMessage
from app.core.config import settings

# Create engine directly
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)


def init_db():
    """Create all tables in PostgreSQL"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")
    print("\nTables created:")
    print("  - users")
    print("  - user_profiles")
    print("  - auth_sessions")
    print("  - chat_sessions")
    print("  - chat_messages")


def seed_test_accounts():
    """Add test accounts to the database"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        # Check if test data already exists
        admin_exists = db.query(User).filter(User.email == "admin@must.ac.ug").first()
        if admin_exists:
            print("✅ Test accounts already exist. Skipping seeding.")
            return
        
        print("\nSeeding test accounts...")
        
        # Import here to avoid chromadb issues
        from app.db.models import UserRole
        
        test_accounts = [
            {
                "email": "admin@must.ac.ug",
                "username": "admin",
                "password": "password123",
                "role": UserRole.admin,
                "approved": True,
                "full_name": "Admin User",
            },
            {
                "email": "john.student@must.ac.ug",
                "username": "john_student",
                "password": "password123",
                "role": UserRole.student,
                "approved": True,
                "full_name": "John Student",
            },
            {
                "email": "jane.student@must.ac.ug",
                "username": "jane_student",
                "password": "password123",
                "role": UserRole.student,
                "approved": True,
                "full_name": "Jane Student",
            },
            {
                "email": "lecturer.approved@must.ac.ug",
                "username": "lecturer_app",
                "password": "password123",
                "role": UserRole.lecturer,
                "approved": True,
                "full_name": "Approved Lecturer",
                "department": "Computer Science",
            },
            {
                "email": "lecturer.pending@must.ac.ug",
                "username": "lecturer_pend",
                "password": "password123",
                "role": UserRole.lecturer,
                "approved": False,
                "full_name": "Pending Lecturer",
                "department": "Engineering",
            },
            {
                "email": "another.pending@must.ac.ug",
                "username": "another_pend",
                "password": "password123",
                "role": UserRole.lecturer,
                "approved": False,
                "full_name": "Another Pending",
                "department": "Mathematics",
            },
        ]
        
        for account in test_accounts:
            password = account.pop("password")
            full_name = account.pop("full_name")
            department = account.pop("department", None)
            
            # Create user - for now, use plaintext password (will hash with bcrypt later)
            user = User(
                **account,
                password_hash=password,  # Will implement hashing when bcrypt available
                is_active=True,
            )
            db.add(user)
            db.flush()  # Get the user ID
            
            # Create user profile
            profile = UserProfile(
                user_id=user.id,
                full_name=full_name,
                department=department,
            )
            db.add(profile)
        
        db.commit()
        print("✅ Test accounts created successfully!")
        print("\nTest Accounts:")
        for account in test_accounts:
            print(f"  - {account['email']} (role: {account['role']}, approved: {account['approved']})")
        
    except Exception as e:
        print(f"❌ Error seeding accounts: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    seed_test_accounts()
    print("\n✨ Database initialization complete!")
