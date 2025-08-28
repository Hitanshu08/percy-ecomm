from fastapi import Depends, HTTPException, status
from core.security import oauth2_scheme, verify_token
from schemas.user_schema import User as UserSchema
from db.session import get_db_session
from db.models.user import User as UserModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

logger = logging.getLogger(__name__)

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db_session)) -> UserSchema:
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

        result = await db.execute(select(UserModel).where(UserModel.username == username))
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserSchema(
            username=user.username,
            email=user.email,
            user_id=user.user_id or user.username,
            role=user.role,
            services=user.services or [],
            credits=user.credits,
            btc_address=user.btc_address or "",
        )
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def admin_required(current_user: UserSchema = Depends(get_current_user)) -> UserSchema:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user