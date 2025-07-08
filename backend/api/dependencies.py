from fastapi import Depends, HTTPException, status
from core.security import oauth2_scheme, verify_token
from schemas.user_schema import User
from db.mongodb import get_sync_users_collection
import logging

logger = logging.getLogger(__name__)

def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
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
        
        users_collection = get_sync_users_collection()
        user_data = users_collection.find_one({"username": username})
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Remove profile field as it's not part of the User schema
        user_data_clean = {k: v for k, v in user_data.items() if k != 'profile' and k != 'hashed_password'}
        return User(**user_data_clean)
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def admin_required(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user 