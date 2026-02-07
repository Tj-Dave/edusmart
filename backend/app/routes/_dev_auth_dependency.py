# app/routes/_dev_auth_dependency.py
# OPTIONAL: If you want chats to work right now without JWT,
# you can read user_id from a header in dev.

from fastapi import Header, HTTPException


def get_current_user_id(x_user_id: str | None = Header(default=None)) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header (dev auth).")
    return x_user_id
