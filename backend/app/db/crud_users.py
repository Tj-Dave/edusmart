# app/db/crud_users.py
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import User, UserProfile, UserRole, AuthProvider
from app.services.auth.security import hash_password, verify_password


def get_user_by_id(db: Session, user_id) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).one_or_none()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).one_or_none()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).one_or_none()


def create_user_local(
    db: Session,
    username: str,
    password: str,
    role: UserRole,
    email: Optional[str] = None,
    full_name: Optional[str] = None,
    university_id: Optional[str] = None,
    department: Optional[str] = None,
    faculty: Optional[str] = None,
    program: Optional[str] = None,
    year_of_study: Optional[int] = None,
    phone: Optional[str] = None,
) -> User:
    """
    Create a local-auth user (username + password).
    Admin should usually call this to provision accounts.
    """
    existing = get_user_by_username(db, username)
    if existing:
        raise ValueError("Username already exists")

    if email:
        existing_email = get_user_by_email(db, email)
        if existing_email:
            raise ValueError("Email already exists")

    user = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        auth_provider=AuthProvider.local,
        email=email,
        is_active=True,
    )

    # Optional profile
    profile = UserProfile(
        full_name=full_name,
        university_id=university_id,
        department=department,
        faculty=faculty,
        program=program,
        year_of_study=year_of_study,
        phone=phone,
    )
    user.profile = profile

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_local(db: Session, username: str, password: str) -> Optional[User]:
    """
    Verify username/password for local accounts.
    Returns User if valid, else None.
    """
    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if user.auth_provider != AuthProvider.local:
        return None
    if not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def set_user_active(db: Session, user_id, is_active: bool) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


def update_user_profile(
    db: Session,
    user_id,
    full_name: Optional[str] = None,
    department: Optional[str] = None,
    faculty: Optional[str] = None,
    program: Optional[str] = None,
    year_of_study: Optional[int] = None,
    phone: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> UserProfile:
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")

    if user.profile is None:
        user.profile = UserProfile()

    if full_name is not None:
        user.profile.full_name = full_name
    if department is not None:
        user.profile.department = department
    if faculty is not None:
        user.profile.faculty = faculty
    if program is not None:
        user.profile.program = program
    if year_of_study is not None:
        user.profile.year_of_study = year_of_study
    if phone is not None:
        user.profile.phone = phone
    if avatar_url is not None:
        user.profile.avatar_url = avatar_url

    db.commit()
    db.refresh(user.profile)
    return user.profile


# --- Google linking (for later) ---
def link_google_account(
    db: Session,
    user_id,
    google_sub: str,
    email: Optional[str] = None,
) -> User:
    """
    Admin-provisioned user links a Google identity.
    Enforce that google_sub is unique at DB level.
    """
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")

    user.google_sub = google_sub
    user.auth_provider = AuthProvider.google
    if email and not user.email:
        user.email = email

    db.commit()
    db.refresh(user)
    return user
