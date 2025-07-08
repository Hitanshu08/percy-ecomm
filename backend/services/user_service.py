from schemas.user_schema import UserCreate, UserUpdate, User, ChangePasswordRequest
from db.base import get_fake_users_db
from db.mongodb import get_sync_users_collection, get_sync_refresh_tokens_collection
from core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from core.config import settings
from fastapi import HTTPException
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

def create_user(user: UserCreate):
    """Create a new user"""
    try:
        users_collection = get_sync_users_collection()
        
        # Check if user already exists
        existing_user = users_collection.find_one({"username": user.username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        existing_email = users_collection.find_one({"email": user.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        hashed_password = get_password_hash(user.password)
        user_data = {
            "username": user.username,
            "email": user.email,
            "user_id": user.username,  # Using username as user_id for simplicity
            "hashed_password": hashed_password,
            "role": "user",
            "services": [],
            "credits": 100,  # Starting credits
            "btc_address": f"btc-{user.username}",
            "notifications": ["Welcome to Percy E-commerce!"],
            "profile": {
                "first_name": "",
                "last_name": "",
                "phone": "",
                "country": "",
                "timezone": "UTC",
                "preferences": {
                    "email_notifications": True,
                    "sms_notifications": False,
                    "theme": "light"
                }
            }
        }
        
        users_collection.insert_one(user_data)
        
        return {"message": "User created successfully"}
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def authenticate_user(email: str, password: str):
    """Authenticate user and return user data"""
    try:
        users_collection = get_sync_users_collection()
        print(email)
        user = users_collection.find_one({"email": email})
        print(user)
        
        if not user:
            return None
        
        if not verify_password(password, user["hashed_password"]):
            print(
                password,
                user["hashed_password"]
            )
            return None
        
        return user
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        return None

def login_user(email: str, password: str):
    """Login user and return tokens"""
    try:
        user = authenticate_user(email, password)
        if not user:
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        # Create tokens
        access_token = create_access_token(
            data={"sub": user["username"], "email": user["email"], "user_id": user["user_id"], "role": user["role"]},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        refresh_token = create_refresh_token(
            data={"sub": user["username"]},
            # expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        
        # Store refresh token
        tokens_collection = get_sync_refresh_tokens_collection()
        tokens_collection.update_one(
            {"username": user["username"]},
            {"$set": {"refresh_token": refresh_token}},
            upsert=True
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "username": user["username"],
                "email": user["email"],
                "role": user["role"],
                "credits": user["credits"]
            }
        }
    except Exception as e:
        logger.error(f"Error logging in user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_user_profile(username: str):
    """Get user profile"""
    try:
        users_collection = get_sync_users_collection()
        user = users_collection.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "credits": user["credits"],
            "btc_address": user["btc_address"],
            "notifications": user["notifications"],
            "profile": user["profile"]
        }
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def update_user_profile(username: str, user_update: UserUpdate):
    """Update user profile"""
    try:
        users_collection = get_sync_users_collection()
        update_data = {}
        
        if user_update.email:
            # Check if email is already taken
            existing_email = users_collection.find_one({"email": user_update.email, "username": {"$ne": username}})
            if existing_email:
                raise HTTPException(status_code=400, detail="Email already registered")
            update_data["email"] = user_update.email
        
        if user_update.password:
            update_data["hashed_password"] = get_password_hash(user_update.password)
        
        if update_data:
            result = users_collection.update_one(
                {"username": username},
                {"$set": update_data}
            )
            
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "Profile updated successfully"}
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def change_password(username: str, password_request: ChangePasswordRequest):
    """Change user password"""
    try:
        users_collection = get_sync_users_collection()
        user = users_collection.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify current password
        if not verify_password(password_request.current_password, user["hashed_password"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Update password
        new_hashed_password = get_password_hash(password_request.new_password)
        users_collection.update_one(
            {"username": username},
            {"$set": {"hashed_password": new_hashed_password}}
        )
        
        return {"message": "Password changed successfully"}
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_user_by_username(username: str):
    """Get user by username"""
    try:
        users_collection = get_sync_users_collection()
        user = users_collection.find_one({"username": username})
        
        if not user:
            return None
        
        return User(**user)
    except Exception as e:
        logger.error(f"Error getting user by username: {e}")
        return None 