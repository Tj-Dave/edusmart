# app/routes/auth_demo.py
# Minimal auth endpoints (local login) so you can test chats API immediately.
# Replace token logic with JWT later; for now we return user_id directly for testing.

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.db.crud_users import authenticate_local

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_local(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "user_id": str(user.id),
        "username": user.username,
        "role": user.role,
    }
