from schemas.user_schema import UserCreate, UserUpdate, User, ChangePasswordRequest
from db.session import SessionLocal
from db.models.user import User as UserModel
from db.models.refresh_token import RefreshToken
from core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from core.config import settings
from fastapi import HTTPException
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

def create_user(user: UserCreate):
    """Create a new user"""
    try:
        db = SessionLocal()
        try:
            if db.query(UserModel).filter(UserModel.username == user.username).first():
                raise HTTPException(status_code=400, detail="Username already registered")
            if db.query(UserModel).filter(UserModel.email == user.email).first():
                raise HTTPException(status_code=400, detail="Email already registered")

            hashed_password = get_password_hash(user.password)
            new_user = UserModel(
                user_id=user.username,
                username=user.username,
                email=user.email,
                hashed_password=hashed_password,
                role="user",
                services=[],
                credits=0,
                btc_address=f"btc-{user.username}",
                notifications=["Welcome to Valuesubs E-commerce!"],
                profile={
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
                },
            )
            db.add(new_user)
            db.commit()
            return {"message": "User created successfully"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def authenticate_user(email: str, password: str):
    """Authenticate user and return user data"""
    try:
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.email == email).first()
            if not user:
                return None
            if not verify_password(password, user.hashed_password):
                return None
            return user
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        return None

def login_user(email: str, password: str):
    """Login user and return tokens"""
    try:
        user = authenticate_user(email, password)
        print(user)
        if not user:
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        # Create tokens
        access_token = create_access_token(
            data={"sub": user.username, "email": user.email, "user_id": (user.user_id or user.username), "role": user.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )

        refresh_token = create_refresh_token(
            data={"sub": user.username},
        )

        # Store refresh token
        db = SessionLocal()
        try:
            db.add(RefreshToken(username=user.username, token=refresh_token))
            db.commit()
        finally:
            db.close()
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "credits": user.credits,
            }
        }
    except Exception as e:
        logger.error(f"Error logging in user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_user_profile(username: str):
    """Get user profile"""
    try:
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            return {
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "credits": user.credits,
                "btc_address": user.btc_address,
                "notifications": user.notifications or [],
                "profile": user.profile or {},
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def update_user_profile(username: str, user_update: UserUpdate):
    """Update user profile"""
    try:
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            if user_update.email and user_update.email != user.email:
                if db.query(UserModel).filter(UserModel.email == user_update.email, UserModel.username != username).first():
                    raise HTTPException(status_code=400, detail="Email already registered")
                user.email = user_update.email

            if user_update.password:
                user.hashed_password = get_password_hash(user_update.password)

            db.commit()
            return {"message": "Profile updated successfully"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def change_password(username: str, password_request: ChangePasswordRequest):
    """Change user password"""
    try:
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            if not verify_password(password_request.current_password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
            user.hashed_password = get_password_hash(password_request.new_password)
            db.commit()
            return {"message": "Password changed successfully"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_user_by_username(username: str):
    """Get user by username"""
    try:
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == username).first()
            if not user:
                return None
            return User(
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
        logger.error(f"Error getting user by username: {e}")
        return None 