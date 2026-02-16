from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.postgres import get_db
from app.db.models import User, UserProfile, UserRole, AuthProvider
from app.services.auth.security import hash_password, verify_password, create_access_token
from app.services.auth.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Schemas ----------
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)

    # optional profile fields
    username: Optional[str] = None
    full_name: Optional[str] = None
    university_id: Optional[str] = None
    faculty: Optional[str] = None
    department: Optional[str] = None
    program: Optional[str] = None
    year_of_study: Optional[int] = None
    phone: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SetPasswordRequest(BaseModel):
    password: str = Field(min_length=6)
    password_confirm: str = Field(min_length=6)


class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str]
    role: str

    full_name: Optional[str] = None
    university_id: Optional[str] = None
    faculty: Optional[str] = None
    department: Optional[str] = None
    program: Optional[str] = None
    year_of_study: Optional[int] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True


def _username_from_email(email: str) -> str:
    # simple fallback; must be unique in DB
    base = email.split("@")[0]
    return base[:50]


def _user_to_out(u: User) -> UserOut:
    p = u.profile
    return UserOut(
        id=str(u.id),
        username=u.username,
        email=u.email,
        role=u.role.value if hasattr(u.role, "value") else str(u.role),
        full_name=p.full_name if p else None,
        university_id=p.university_id if p else None,
        faculty=p.faculty if p else None,
        department=p.department if p else None,
        program=p.program if p else None,
        year_of_study=p.year_of_study if p else None,
        phone=p.phone if p else None,
    )


# ---------- Endpoints ----------
@router.post("/register", response_model=UserOut)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    # check email uniqueness
    existing = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # username is required by your model
    username = (payload.username or "").strip() or _username_from_email(payload.email)

    # ensure username is unique
    u2 = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if u2:
        # simple collision fix
        username = f"{username}_{payload.email.split('@')[0][-4:]}"

    user = User(
        username=username,
        email=str(payload.email),
        role=UserRole.student,              # default; you can promote later
        auth_provider=AuthProvider.local,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # create profile row (optional fields)
    profile = UserProfile(
        user_id=user.id,
        full_name=payload.full_name,
        university_id=payload.university_id,
        faculty=payload.faculty,
        department=payload.department,
        program=payload.program,
        year_of_study=payload.year_of_study,
        phone=payload.phone,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    return _user_to_out(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject=str(user.id), extra_claims={"role": user.role.value})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return _user_to_out(current_user)


@router.post("/set-password")
def set_password(
    payload: SetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.password != payload.password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    # set/overwrite local password
    current_user.password_hash = hash_password(payload.password)
    current_user.auth_provider = AuthProvider.local
    db.commit()

    return {"ok": True}
