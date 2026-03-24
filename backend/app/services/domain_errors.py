from __future__ import annotations


class ServiceError(Exception):
    status_code: int = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class ServiceValidationError(ServiceError):
    status_code = 400


class ServicePermissionError(ServiceError):
    status_code = 403


class ServiceNotFoundError(ServiceError):
    status_code = 404


class ServiceConflictError(ServiceError):
    status_code = 409

