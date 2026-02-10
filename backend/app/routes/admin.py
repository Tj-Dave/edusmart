# app/routes/admin.py
# Admin endpoints for managing lecturers and analytics

from __future__ import annotations

from typing import Optional, List
from pydantic import BaseModel, EmailStr
import uuid

from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.postgres import get_db
from app.db.models import User, UserProfile, UserRole, ChatSession, ChatMessage
from app.routes.auth_demo import get_current_user
from app.core.auth import hash_password

router = APIRouter(tags=["admin"])


# ==================== Schemas ====================
class LecturerInfo(BaseModel):
    email: str
    full_name: str
    approved: bool
    courses: Optional[str] = None


class AdminAnalytics(BaseModel):
    total_students: int
    total_lecturers: int
    approved_lecturers: int
    pending_lecturers: int
    total_chats: int
    total_messages: int


class AdminAction(BaseModel):
    action: str  # "approve", "revoke", "delete"


class CreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str  # "student" or "lecturer"
    password: str
    courses: Optional[str] = None


class ImportPayload(BaseModel):
    type: str  # "students" or "lecturers"
    data: List[dict]  # CSV data as list of dicts


# ==================== Helper ====================
async def verify_admin(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> dict:
    """Verify user is admin"""
    user = get_current_user(authorization)
    
    # Verify role from database
    admin_user = db.query(User).filter(User.email == user["email"]).first()
    if not admin_user or admin_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user


# ==================== Routes ====================
@router.get("/users", response_model=List[dict])
async def get_users(
    user: dict = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    Get all users (students and lecturers) with their details.
    """
    users_db = db.query(User, UserProfile).outerjoin(
        UserProfile, User.id == UserProfile.user_id
    ).filter(User.role.in_([UserRole.student, UserRole.lecturer])).all()
    
    users_list = []
    for db_user, profile in users_db:
        users_list.append({
            "email": db_user.email,
            "full_name": profile.full_name if profile else "",
            "role": db_user.role.value,
            "approved": db_user.approved,
            "is_active": db_user.is_active,
            "courses": profile.courses if profile else None,
        })
    
    return users_list


@router.get("/lecturers", response_model=List[LecturerInfo])
async def get_lecturers(
    user: dict = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    Get all lecturers with their details from PostgreSQL.
    """
    # Query all lecturers from database
    lecturers_db = db.query(User, UserProfile).outerjoin(
        UserProfile, User.id == UserProfile.user_id
    ).filter(User.role == UserRole.lecturer).all()
    
    lecturers = []
    for user, profile in lecturers_db:
        lecturers.append(
            LecturerInfo(
                email=user.email,
                full_name=profile.full_name if profile else "",
                approved=user.approved,
                courses=profile.courses if profile else None,
            )
        )
    
    return lecturers


@router.patch("/lecturers/{email}")
async def manage_lecturer(
    email: str,
    payload: AdminAction,
    user: dict = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    Manage lecturer: approve, revoke, or delete.
    
    Actions:
    - approve: Set approved=True
    - revoke: Set approved=False
    - delete: Remove lecturer account
    """
    email = email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Lecturer not found")
    
    if user.role != UserRole.lecturer:
        raise HTTPException(status_code=400, detail="User is not a lecturer")
    
    action = payload.action.lower()
    
    if action == "approve":
        user.approved = True
        db.commit()
        return {"message": f"Lecturer {email} approved"}
    
    elif action == "revoke":
        user.approved = False
        db.commit()
        return {"message": f"Lecturer {email} access revoked"}
    
    elif action == "delete":
        db.delete(user)
        db.commit()
        return {"message": f"Lecturer {email} deleted"}
    
    else:
        raise HTTPException(
            status_code=400, 
            detail="Invalid action. Use: approve, revoke, or delete"
        )


@router.get("/analytics", response_model=AdminAnalytics)
async def get_analytics(
    user: dict = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    Get admin dashboard analytics from PostgreSQL.
    Returns student count, lecturer count, chat statistics.
    """
    # Query counts from database
    total_students = db.query(func.count(User.id)).filter(
        User.role == UserRole.student
    ).scalar() or 0
    
    total_lecturers = db.query(func.count(User.id)).filter(
        User.role == UserRole.lecturer
    ).scalar() or 0
    
    approved_lecturers = db.query(func.count(User.id)).filter(
        User.role == UserRole.lecturer,
        User.approved == True,
    ).scalar() or 0
    
    pending_lecturers = total_lecturers - approved_lecturers
    
    total_chats = db.query(func.count(ChatSession.id)).scalar() or 0
    total_messages = db.query(func.count(ChatMessage.id)).scalar() or 0
    return AdminAnalytics(
        total_students=total_students,
        total_lecturers=total_lecturers,
        approved_lecturers=approved_lecturers,
        pending_lecturers=pending_lecturers,
        total_chats=total_chats,
        total_messages=total_messages,
    )


@router.post("/users")
async def create_user(
    payload: CreateUserRequest,
    user: dict = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    Create a new user (student or lecturer).
    
    Admin only. Requires valid authentication.
    """
    email = payload.email.lower().strip()
    
    # Check if user already exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"User {email} already exists")
    
    # Validate role
    role_value = payload.role.lower()
    if role_value not in ["student", "lecturer"]:
        raise HTTPException(status_code=400, detail="Role must be 'student' or 'lecturer'")
    
    # Validate password
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    try:
        # Generate unique username: use email or email + UUID suffix if needed
        base_username = email.split("@")[0]
        username = base_username
        
        # Check if username is already taken, if so add UUID suffix
        attempt = 0
        while db.query(User).filter(User.username == username).first() and attempt < 3:
            username = f"{base_username}_{str(uuid.uuid4())[:8]}"
            attempt += 1
        
        # If still collision after 3 attempts, use full UUID
        if db.query(User).filter(User.username == username).first():
            username = str(uuid.uuid4())[:12]
        
        # Create user
        role_enum = UserRole.student if role_value == "student" else UserRole.lecturer
        new_user = User(
            username=username,
            email=email,
            password_hash=hash_password(payload.password),
            role=role_enum,
            approved=(role_value == "student"),  # Auto-approve students
            is_active=True,
        )
        
        db.add(new_user)
        db.flush()  # Get the user ID
        
        # Create user profile
        profile = UserProfile(
            user_id=new_user.id,
            full_name=payload.full_name,
            courses=payload.courses if payload.courses else None,
        )
        db.add(profile)
        db.commit()
        
        return {
            "success": True,
            "message": f"{role_value.capitalize()} account created for {email}",
            "email": email,
            "role": role_value,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")


@router.post("/import")
def import_data(
    payload: ImportPayload,
    user: dict = Depends(verify_admin),
    db: Session = Depends(get_db),
):
    """
    Import students or lecturers from CSV to PostgreSQL.
    
    Expected format:
    {
      "type": "students" or "lecturers",
      "data": [
        {
          "email": "user@must.ac.ug",
          "full_name": "User Name",
          "password": "password123",
          "courses": "CS101,CS102" (for lecturers only)
        }
      ]
    }
    """
    if payload.type not in ["students", "lecturers"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid type. Use 'students' or 'lecturers'"
        )
    
    imported_count = 0
    errors = []
    
    for idx, row in enumerate(payload.data):
        try:
            email = row.get("email", "").lower().strip()
            password = row.get("password", "password123")
            full_name = row.get("full_name", "")
            courses = row.get("courses", "")
            
            if not email:
                errors.append(f"Row {idx + 1}: Missing email")
                continue
            
            # Check if user already exists in database
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                errors.append(f"Row {idx + 1}: Email already exists")
                continue
            
            # Create user in database
            role = UserRole.lecturer if payload.type == "lecturers" else UserRole.student
            
            # Generate unique username
            base_username = email.split("@")[0]
            username = base_username
            
            # Check if username is already taken, if so add UUID suffix
            attempt = 0
            while db.query(User).filter(User.username == username).first() and attempt < 3:
                username = f"{base_username}_{str(uuid.uuid4())[:8]}"
                attempt += 1
            
            # If still collision after 3 attempts, use full UUID
            if db.query(User).filter(User.username == username).first():
                username = str(uuid.uuid4())[:12]
            
            new_user = User(
                email=email,
                username=username,
                password_hash=hash_password(password),  # Hash the password
                role=role,
                approved=(role == UserRole.student),  # Auto-approve students, lecturers need approval
                is_active=True,
            )
            db.add(new_user)
            db.flush()  # Get the user ID
            
            # Create user profile
            profile = UserProfile(
                user_id=new_user.id,
                full_name=full_name,
                courses=courses if courses else None,
            )
            db.add(profile)
            imported_count += 1
            
        except Exception as e:
            errors.append(f"Row {idx + 1}: {str(e)}")
    
    # Commit all changes
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    
    return {
        "type": payload.type,
        "imported": imported_count,
        "total_rows": len(payload.data),
        "errors": errors if errors else None,
    }
