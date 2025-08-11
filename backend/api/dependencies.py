from fastapi import Depends, HTTPException, status
from core.security import oauth2_scheme, verify_token
from schemas.user_schema import User as UserSchema
from db.session import SessionLocal
from db.models.user import User as UserModel
import logging

logger = logging.getLogger(__name__)

def get_current_user(token: str = Depends(oauth2_scheme)) -> UserSchema:
    try:
        payload = verify_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=404, detail="User not found")
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            # Map to schema, exclude hashed_password/profile
            return UserSchema(
                username=user.username,
                email=user.email,
                user_id=user.user_id or user.username,
                role=user.role,
                services=user.services or [],
                credits=user.credits,
                btc_address=user.btc_address or "",
                notifications=user.notifications or [],
            )
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def admin_required(current_user: UserSchema = Depends(get_current_user)) -> UserSchema:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user 