from app.db import models
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import re

class NotificationTemplateService:
    def __init__(self, db: Session):
        self.db = db

    def get_template(self, event_type: str) -> Optional[models.NotificationTemplate]:
        return self.db.query(models.NotificationTemplate).filter_by(event_type=event_type).first()

    def render(self, template: str, data: Dict[str, Any]) -> str:
        # Simple {{var}} replacement
        def replacer(match):
            key = match.group(1).strip()
            return str(data.get(key, f"{{{{{key}}}}}"))
        return re.sub(r"{{(.*?)}}", replacer, template)
