# app/routes/config.py
# Configuration endpoints for institution setup

from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.routes.auth_demo import get_current_user

router = APIRouter(prefix="/config", tags=["config"])


# ==================== Schemas ====================
class CampusInfo(BaseModel):
    id: str
    name: str


class YearInfo(BaseModel):
    id: str
    name: str


class SemesterInfo(BaseModel):
    id: str
    name: str


class CourseInfo(BaseModel):
    id: str
    code: str
    name: str
    campusId: str
    yearId: str
    semesterId: str


class InstitutionConfig(BaseModel):
    campuses: List[CampusInfo]
    years: List[YearInfo]
    semesters: List[SemesterInfo]
    courses: List[CourseInfo]


# ==================== Default Data ====================
DEFAULT_CONFIG = InstitutionConfig(
    campuses=[
        {"id": "kampala", "name": "Kampala Campus"},
        {"id": "jinja", "name": "Jinja Campus"},
        {"id": "mbarara", "name": "Mbarara Campus"},
    ],
    years=[
        {"id": "y1", "name": "Year 1"},
        {"id": "y2", "name": "Year 2"},
        {"id": "y3", "name": "Year 3"},
        {"id": "y4", "name": "Year 4"},
    ],
    semesters=[
        {"id": "sem1", "name": "Semester 1"},
        {"id": "sem2", "name": "Semester 2"},
    ],
    courses=[
        {
            "id": "cs101",
            "code": "CS101",
            "name": "Introduction to Programming",
            "campusId": "kampala",
            "yearId": "y1",
            "semesterId": "sem1",
        },
        {
            "id": "cs102",
            "code": "CS102",
            "name": "Data Structures",
            "campusId": "kampala",
            "yearId": "y1",
            "semesterId": "sem2",
        },
        {
            "id": "cs201",
            "code": "CS201",
            "name": "Database Systems",
            "campusId": "kampala",
            "yearId": "y2",
            "semesterId": "sem1",
        },
    ],
)


# ==================== Routes ====================
@router.get("/institution", response_model=InstitutionConfig)
def get_institution_config(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Get institution configuration (campuses, years, semesters, courses).
    Returns default config for now - can be persisted to database later.
    """
    # For now, return default config. In future, this could be:
    # 1. Read from database if Institution model exists
    # 2. Read from environment variables
    # 3. Read from a config file
    return DEFAULT_CONFIG


@router.put("/institution", response_model=InstitutionConfig)
def update_institution_config(
    config: InstitutionConfig,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Update institution configuration (admin only).
    For now, just returns the received config - persistence layer can be added later.
    """
    # Verify user is authenticated
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user = get_current_user(authorization)
    
    # In future, could check if user is admin:
    # if user.get("role") != "admin":
    #     raise HTTPException(status_code=403, detail="Admin access required")
    
    # TODO: Persist to database
    return config
