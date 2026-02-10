# backend/app/routes/setup.py
"""
First-time setup endpoints for EduSmart system initialization.
These endpoints are only functional when no admin user exists.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db.postgres import get_db, SessionLocal
from app.db.models import User, UserProfile, UserRole
from app.core.auth import hash_password
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/setup", tags=["setup"])


class SetupStatusResponse(BaseModel):
    needs_setup: bool
    setup_completed: bool


class SetupRequest(BaseModel):
    """Initial setup request with institution and admin details"""
    institution_name: str
    admin_email: EmailStr
    admin_password: str
    campus: str


class SetupResponse(BaseModel):
    """Response after successful setup"""
    success: bool
    message: str
    admin_email: str
    institution: str


@router.get("/status", response_model=SetupStatusResponse)
def get_setup_status():
    """
    Check if system needs initial setup.
    
    Returns:
        - needs_setup: True if no admin exists yet
        - setup_completed: True if admin exists (inverse of needs_setup)
    """
    db = SessionLocal()
    try:
        admin_count = db.query(User).filter(User.role == UserRole.admin).count()
        needs_setup = admin_count == 0
        
        return SetupStatusResponse(
            needs_setup=needs_setup,
            setup_completed=not needs_setup
        )
    finally:
        db.close()


@router.post("/initialize", response_model=SetupResponse, status_code=201)
def initialize_system(request: SetupRequest):
    """
    🔐 ONE-TIME INITIALIZATION ENDPOINT
    
    Initializes the EduSmart system for first use by creating:
    1. Admin user account
    2. Admin user profile
    
    ⚠️ SECURITY:
    - Can only be called ONCE (fails if admin already exists)
    - After completion, setup endpoints return 403 Forbidden
    - No credentials are logged or returned beyond success confirmation
    
    Args:
        institution_name: Name of the institution
        admin_email: Email for the admin account
        admin_password: Password for the admin account (min 8 chars)
        campus: Default campus/branch name
    
    Returns:
        Success confirmation with admin email and institution name
    """
    db = SessionLocal()
    
    try:
        # 🔒 SECURITY CHECK: Prevent re-initialization
        existing_admin = db.query(User).filter(
            User.role == UserRole.admin
        ).first()
        
        if existing_admin:
            logger.warning("Setup attempt on already-initialized system")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="System already initialized. Setup can only run once. Please login with your admin credentials."
            )
        
        # Validate password length
        if len(request.admin_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long"
            )
        
        # ✅ Create admin user
        admin_user = User(
            username=request.admin_email.split("@")[0],  # Use email prefix as username
            email=request.admin_email,
            password_hash=hash_password(request.admin_password),
            role=UserRole.admin,
            approved=True,
            is_active=True
        )
        
        db.add(admin_user)
        db.flush()  # Get the user ID
        
        # ✅ Create admin profile
        admin_profile = UserProfile(
            user_id=admin_user.id,
            full_name="System Administrator",
            university_id=request.institution_name
        )
        
        db.add(admin_profile)
        db.commit()
        
        logger.info(f"✅ System initialized successfully for institution: {request.institution_name}")
        logger.info(f"📧 Admin user created: {request.admin_email}")
        
        return SetupResponse(
            success=True,
            message="System initialized successfully. Please login with your admin credentials.",
            admin_email=request.admin_email,
            institution=request.institution_name
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors)
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Setup failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Setup failed: {str(e)}"
        )
    finally:
        db.close()


@router.get("/blocked")
def setup_blocked():
    """
    Returns 403 if setup is blocked (system already initialized)
    Used to provide clear feedback to frontend
    """
    db = SessionLocal()
    try:
        admin_exists = db.query(User).filter(
            User.role == UserRole.admin
        ).first()
        
        if admin_exists:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="System setup has already been completed"
            )
        
        return {"message": "Setup is available"}
    finally:
        db.close()
