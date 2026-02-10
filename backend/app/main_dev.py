"""
EduSmart Backend - Development Mode
Minimal FastAPI app for testing without heavy dependencies
"""
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from pydantic import BaseModel, EmailStr

from app.db.postgres import engine, get_db, SessionLocal
from app.core.config import settings
from app.core.auth import hash_password
from app.db.models import User, UserRole

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Request/Response schemas
class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "STUDENT"


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    approved: bool


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app startup and shutdown"""
    # Startup
    logger.info("🚀 Initializing EduSmart Backend (DEV MODE)...")
    
    try:
        # Test database connection (optional)
        logger.info("🗄️  Testing database connection...")
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                logger.info("✅ Database connection successful")
        except Exception as e:
            logger.warning(f"⚠️  Database connection failed (not critical in dev): {str(e)}")
        
        logger.info("✨ EduSmart Backend initialized successfully!")
        
    except Exception as e:
        logger.error(f"❌ Initialization error: {str(e)}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="EduSmart Backend (DEV)",
    description="Educational AI System - Development Mode",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "EduSmart Backend (DEV)"}


@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint"""
    return {"status": "ready", "service": "EduSmart Backend"}


# ============================================================================
# SETUP ROUTES - First-time initialization
# ============================================================================

try:
    from app.routes.setup import router as setup_router
    app.include_router(setup_router, prefix="/api")
    logger.info("✅ Setup routes loaded")
except Exception as e:
    logger.warning(f"⚠️  Setup routes failed to load: {e}")


# Import routers - wrapped in try-except for optional features
try:
    from app.routes.auth_demo import router as auth_router
    app.include_router(auth_router, prefix="/api", tags=["Authentication"])
    logger.info("✅ Auth routes loaded")
except Exception as e:
    logger.warning(f"⚠️  Auth routes failed to load: {e}")

try:
    from app.routes.chats import router as chats_router
    app.include_router(chats_router, prefix="/api/chats", tags=["Chats"])
    logger.info("✅ Chat routes loaded")
except Exception as e:
    logger.warning(f"⚠️  Chat routes failed to load: {e}")

try:
    from app.routes.admin import router as admin_router
    app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
    logger.info("✅ Admin routes loaded")
except Exception as e:
    logger.warning(f"⚠️  Admin routes failed to load: {e}")

try:
    from app.routes.config import router as config_router
    app.include_router(config_router, prefix="/api", tags=["Config"])
    logger.info("✅ Config routes loaded")
except Exception as e:
    logger.warning(f"⚠️  Config routes failed to load: {e}")

try:
    from app.routes.ai_query import router as ai_query_router
    app.include_router(ai_query_router, prefix="/api", tags=["AI"])
    logger.info("✅ AI query routes loaded")
except Exception as e:
    logger.warning(f"⚠️  AI query routes failed to load: {e}")


# ============================================================================
# ADMIN SETUP ENDPOINT - For initial user creation (development only)
# ============================================================================

@app.post("/api/setup/create-user", response_model=UserResponse, tags=["Setup"])
async def setup_create_user(request: CreateUserRequest):
    """
    🔐 DEVELOPMENT ONLY - Create a user for initial setup
    
    This endpoint is for development/testing only.
    In production, user creation should require admin authentication.
    
    Example:
    ```bash
    curl -X POST http://localhost:8001/api/setup/create-user \
      -H "Content-Type: application/json" \
      -d '{
        "email": "admin@must.ac.ug",
        "password": "SecurePassword123!",
        "role": "ADMIN"
      }'
    ```
    
    Roles: ADMIN, INSTRUCTOR, STUDENT
    """
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == request.email).first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f"User with email {request.email} already exists"
            )
        
        # Validate role
        valid_roles = [role.value for role in UserRole]
        if request.role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
            )
        
        # Create new user
        new_user = User(
            email=request.email,
            password_hash=hash_password(request.password),
            role=UserRole(request.role),
            approved=True,  # Auto-approve in dev mode
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"✅ User created: {request.email} (role: {request.role})")
        
        return UserResponse(
            id=str(new_user.id),
            email=new_user.email,
            role=new_user.role.value,
            approved=new_user.approved
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error creating user: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating user: {str(e)}"
        )
    finally:
        db.close()


@app.get("/api/setup/users", tags=["Setup"])
async def setup_list_users():
    """
    🔐 DEVELOPMENT ONLY - List all users
    
    Shows all registered users for debugging/testing
    """
    db = SessionLocal()
    try:
        users = db.query(User).all()
        return {
            "total": len(users),
            "users": [
                {
                    "id": str(u.id),
                    "email": u.email,
                    "role": u.role.value,
                    "approved": u.approved,
                    "created_at": u.created_at.isoformat() if u.created_at else None
                }
                for u in users
            ]
        }
    finally:
        db.close()


@app.delete("/api/setup/users/{email}", tags=["Setup"])
async def setup_delete_user(email: str):
    """
    🔐 DEVELOPMENT ONLY - Delete a user by email
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"User {email} not found")
        
        db.delete(user)
        db.commit()
        
        logger.info(f"✅ User deleted: {email}")
        return {"message": f"User {email} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/")

async def root():
    """Root endpoint"""
    return {
        "message": "EduSmart Backend (Development Mode)",
        "docs": "http://localhost:8000/docs",
        "health": "http://localhost:8000/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main_dev:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )
