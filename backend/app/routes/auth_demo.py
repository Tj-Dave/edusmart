# app/routes/auth_demo.py
# Production auth endpoints with JWT + PostgreSQL backend

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.db.models import User, UserProfile, UserRole
from app.db.crud_users import get_user_by_email
from app.core.auth import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


# ==================== Schemas ====================
class LoginRequest(BaseModel):
    email: str
    password: str


class SetPasswordRequest(BaseModel):
    password: str
    password_confirm: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    full_name: Optional[str] = None
    approved: bool = False
    courses: Optional[str] = None


# ==================== Helpers ====================
def create_access_token(email: str, role: str) -> str:
    """Create JWT token"""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Extract user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("email")
        role = payload.get("role")
        
        if not email or not role:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return {"email": email, "role": role}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ==================== Routes ====================
@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Login with email and password. Query from PostgreSQL.
    Uses bcrypt for secure password verification.
    """
    email = payload.email.lower().strip()
    password = payload.password
    
    # Query database for user
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=401, 
            detail="Invalid email or password"
        )
    
    # Verify password using bcrypt
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=401, 
            detail="Invalid email or password"
        )
    
    # Generate token
    token = create_access_token(email, user.role.value)
    
    # Get profile info
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    
    return TokenResponse(
        access_token=token,
        user={
            "email": email,
            "role": user.role.value,
            "full_name": profile.full_name if profile else None,
            "approved": user.approved,
        }
    )


@router.post("/set-password")
def set_password(
    payload: SetPasswordRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Set password - updates password in PostgreSQL.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    user_info = get_current_user(authorization)
    email = user_info["email"]
    
    if payload.password != payload.password_confirm:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )
    
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters"
        )
    
    # Update password in database - hash with bcrypt
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Hash the password before storing
    user.password_hash = hash_password(payload.password)
    db.commit()
    
    return {"message": "Password set successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Get current authenticated user profile from PostgreSQL.
    """
    user_info = get_current_user(authorization)
    email = user_info["email"]
    
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    
    return UserResponse(
        id=str(user.id),
        email=email,
        role=user.role.value,
        full_name=profile.full_name if profile else None,
        approved=user.approved,
        courses=profile.courses if profile else None,
    )
