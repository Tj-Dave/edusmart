from __future__ import annotations
import hashlib
from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["argon2"],   # use argon2 only
    deprecated="auto"
)

def _normalize_password(password: str) -> str:
    pw_bytes = password.encode("utf-8")
    # Still optional, but safe: cap extremely long passwords
    if len(pw_bytes) <= 1024:
        return password
    return hashlib.sha256(pw_bytes).hexdigest()

def hash_password(password: str) -> str:
    return pwd_context.hash(_normalize_password(password))

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(_normalize_password(password), password_hash)
