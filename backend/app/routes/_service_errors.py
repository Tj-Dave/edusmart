from __future__ import annotations

from fastapi import HTTPException

from app.services.domain_errors import ServiceError


def to_http_exception(err: Exception) -> HTTPException:
    if isinstance(err, ServiceError):
        return HTTPException(status_code=err.status_code, detail=err.message)
    return HTTPException(status_code=500, detail=str(err))

