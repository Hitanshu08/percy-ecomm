from schemas.user_schema import UserCreate, UserUpdate, User, ChangePasswordRequest
from db.session import SessionLocal, get_or_use_session
from db.models.user import User as UserModel
from db.models.refresh_token import RefreshToken
from core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from core.config import settings
from db.mongodb import get_mongo_db
from fastapi import HTTPException
from datetime import timedelta, datetime
import logging
from sqlalchemy import select, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from utils.timing import timeit
from db.models.password_reset_otp import PasswordResetOTP
import random
from utils.email import send_otp_email
from sqlalchemy.exc import IntegrityError, DBAPIError
from utils.db import safe_commit

logger = logging.getLogger(__name__)

async def create_user(user: UserCreate, db: AsyncSession  = None):
    """Create a new user"""
    try:
        mongo = get_mongo_db()
        if settings.USE_MONGO and (mongo is not None):
            # Unique checks
            if await mongo.users.find_one({"username": user.username}):
                raise HTTPException(status_code=400, detail="Username already registered")
            if await mongo.users.find_one({"email": user.email}):
                raise HTTPException(status_code=400, detail="Email already registered")
            hashed_password = get_password_hash(user.password)
            doc = {
                "user_id": user.username,
                "username": user.username,
                "email": user.email,
                "hashed_password": hashed_password,
                "role": "user",
                "credits": 0,
                "btc_address": f"btc-{user.username}",
                "services": [],
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
                },
                "created_at": datetime.utcnow().isoformat(),
                "is_active": True,
            }
            await mongo.users.insert_one(doc)
            return {"message": "User created successfully"}

        async with get_or_use_session(db) as _db:
            existing = await _db.execute(select(UserModel).where(UserModel.username == user.username))
            if existing.scalars().first() is not None:
                raise HTTPException(status_code=400, detail="Username already registered")
            existing = await _db.execute(select(UserModel).where(UserModel.email == user.email))
            if existing.scalars().first() is not None:
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
            _db.add(new_user)
            await safe_commit(_db, client_error_message="Invalid signup data", server_error_message="Internal server error")
            return {"message": "User created successfully"}
    except HTTPException:
        # Propagate intended HTTP errors (e.g., 400 for duplicates)
        raise
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def authenticate_user(email: str, password: str, db: AsyncSession  = None):
    """Authenticate user and return user data"""
    try:
        mongo = get_mongo_db()
        if settings.USE_MONGO and (mongo is not None):
            # Accept either email or username
            user = await mongo.users.find_one({"$or": [{"email": email}, {"username": email}]})
            if not user:
                return None
            if not verify_password(password, user.get("hashed_password", "")):
                return None
            class Obj:
                pass
            o = Obj()
            o.username = user["username"]
            o.email = user["email"]
            o.user_id = user.get("user_id") or user["username"]
            o.role = user.get("role", "user")
            o.credits = int(user.get("credits", 0))
            return o

        async with get_or_use_session(db) as _db:
            # Accept either email or username in the OAuth2 "username" field
            result = await _db.execute(
                select(UserModel).where(
                    or_(UserModel.email == email, UserModel.username == email)
                )
            )
            user = result.scalars().first()
            if not user:
                return None
            if not verify_password(password, user.hashed_password):
                return None
            return user
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        return None

async def login_user(email: str, password: str, db: AsyncSession  = None):
    """Login user and return tokens"""
    try:
        user = await authenticate_user(email, password, db=db)
        if not user:
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        access_token = create_access_token(
            data={"sub": user.username, "email": user.email, "user_id": (user.user_id or user.username), "role": user.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )

        refresh_token = create_refresh_token(
            data={"sub": user.username},
        )

        mongo = get_mongo_db()
        if settings.USE_MONGO and (mongo is not None):
            # Upsert a single refresh token per user (no mass delete)
            await mongo.refresh_tokens.update_one(
                {"username": user.username},
                {"$set": {"token": refresh_token, "created_at": datetime.utcnow().isoformat()}},
                upsert=True
            )
        else:
            async with get_or_use_session(db) as _db:
                # Enforce single refresh token per user
                await _db.execute(delete(RefreshToken).where(RefreshToken.username == user.username))
                _db.add(RefreshToken(username=user.username, token=refresh_token))
                await safe_commit(_db, client_error_message="Invalid login request", server_error_message="Internal server error")
        
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


@timeit("request_password_reset")
async def request_password_reset(email: str, db: AsyncSession = None):
    """Generate an OTP for password reset and send it via email."""
    try:
        mongo = get_mongo_db()
        if settings.USE_MONGO and (mongo is not None):
            user = await mongo.users.find_one({"email": email})
            if not user:
                raise HTTPException(status_code=404, detail=f"Account not created for {email}")
            # Rate limiting backoff: 1m, 2m, 5m, 10m, 30m
            now = datetime.utcnow()
            last = await mongo.password_reset_otps.find({"email": email}).sort([("created_at", -1)]).limit(1).to_list(length=1)
            wait_seconds = 0
            if last:
                last_doc = last[0]
                created = None
                try:
                    created = datetime.fromisoformat(last_doc.get("created_at"))
                except Exception:
                    created = now
                # Determine attempt count in last 24h
                since = now - timedelta(hours=24)
                attempts = await mongo.password_reset_otps.count_documents({"email": email, "created_at": {"$gte": since.isoformat()}})
                backoff = [60, 120, 300, 600, 1800]
                idx = min(max(attempts - 1, 0), len(backoff) - 1)
                wait_seconds = backoff[idx]
                if (created + timedelta(seconds=wait_seconds)) > now:
                    remaining = int(((created + timedelta(seconds=wait_seconds)) - now).total_seconds())
                    raise HTTPException(status_code=429, detail=f"Please wait {remaining} seconds before requesting another OTP")
            otp_code = f"{random.randint(0, 999999):06d}"
            expires_at = now + timedelta(minutes=10)
            await mongo.password_reset_otps.insert_one({
                "email": email,
                "otp_code": otp_code,
                "expires_at": expires_at.isoformat(),
                "created_at": now.isoformat(),
                "used_at": None,
            })
            sent = send_otp_email(email, otp_code)
            if not sent:
                raise HTTPException(status_code=500, detail="Failed to send OTP email")
            return {"message": "If an account exists, an OTP has been sent"}

        async with get_or_use_session(db) as _db:
            # Check user exists
            result = await _db.execute(select(UserModel).where(UserModel.email == email))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail=f"Account not created for {email}")
            # Rate limiting backoff based on last OTP for this email
            from sqlalchemy import desc, and_
            last_q = await _db.execute(select(PasswordResetOTP).where(PasswordResetOTP.email == email).order_by(desc(PasswordResetOTP.created_at)).limit(1))
            last_row = last_q.scalars().first()
            now_dt = datetime.utcnow()
            if last_row:
                # attempts in last 24h
                since = now_dt - timedelta(hours=24)
                cnt_q = await _db.execute(select(PasswordResetOTP).where(and_(PasswordResetOTP.email == email, PasswordResetOTP.created_at >= since)))
                attempts = len(cnt_q.scalars().all())
                backoff = [60, 120, 300, 600, 1800]
                idx = min(max(attempts - 1, 0), len(backoff) - 1)
                wait_seconds = backoff[idx]
                if last_row.created_at and (last_row.created_at + timedelta(seconds=wait_seconds)) > now_dt:
                    remaining = int(((last_row.created_at + timedelta(seconds=wait_seconds)) - now_dt).total_seconds())
                    raise HTTPException(status_code=429, detail=f"Please wait {remaining} seconds before requesting another OTP")

            # Generate 6-digit OTP
            otp_code = f"{random.randint(0, 999999):06d}"
            expires_at = datetime.utcnow() + timedelta(minutes=10)

            otp = PasswordResetOTP(email=email, otp_code=otp_code, expires_at=expires_at)
            _db.add(otp)
            await safe_commit(_db, client_error_message="Invalid password reset request", server_error_message="Internal server error")

            # Send email; surface failure so frontend can signal server issue
            sent = send_otp_email(email, otp_code)
            if not sent:
                raise HTTPException(status_code=500, detail="Failed to send OTP email")

            return {"message": "If an account exists, an OTP has been sent"}
    except HTTPException:
        # Propagate intended errors like 404 for unknown email
        raise
    except Exception as e:
        logger.error(f"Error requesting password reset: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def reset_password_with_otp(email: str, otp_code: str, new_password: str, db: AsyncSession = None):
    """Verify OTP and set new password for the user."""
    try:
        if not email or not otp_code or not new_password:
            raise HTTPException(status_code=400, detail="Email, OTP and new password are required")
        mongo = get_mongo_db()
        now_iso = datetime.utcnow().isoformat()
        if settings.USE_MONGO and (mongo is not None):
            # Find a valid OTP
            # Only latest OTP should be valid: fetch latest and compare
            latest = await mongo.password_reset_otps.find({"email": email}).sort([("created_at", -1)]).limit(1).to_list(length=1)
            otp_doc = latest[0] if latest else None
            if not otp_doc or otp_doc.get("otp_code") != otp_code or otp_doc.get("used_at") is not None:
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            if not otp_doc:
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            # Check expiry
            try:
                exp = datetime.fromisoformat(otp_doc.get("expires_at"))
            except Exception:
                exp = datetime.utcnow()
            if exp < datetime.utcnow():
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            # Update user password
            user_doc = await mongo.users.find_one({"email": email})
            if not user_doc:
                raise HTTPException(status_code=404, detail=f"Account not created for {email}")
            hashed = get_password_hash(new_password)
            await mongo.users.update_one({"_id": user_doc["_id"]}, {"$set": {"hashed_password": hashed}})
            # Mark OTP used
            await mongo.password_reset_otps.update_one({"_id": otp_doc["_id"]}, {"$set": {"used_at": now_iso}})
            return {"message": "Password reset successful"}

        # SQL path
        async with get_or_use_session(db) as _db:
            # Validate OTP: only the latest for the email
            from sqlalchemy import desc
            latest_q = await _db.execute(select(PasswordResetOTP).where(PasswordResetOTP.email == email).order_by(desc(PasswordResetOTP.created_at)).limit(1))
            otp_row = latest_q.scalars().first()
            if not otp_row or otp_row.otp_code != otp_code or getattr(otp_row, 'used_at', None) is not None:
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            if not otp_row:
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            if otp_row.expires_at and otp_row.expires_at < datetime.utcnow():
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            user = (await _db.execute(select(UserModel).where(UserModel.email == email))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail=f"Account not created for {email}")
            user.hashed_password = get_password_hash(new_password)
            try:
                otp_row.used_at = datetime.utcnow()  # type: ignore
            except Exception:
                pass
            await safe_commit(_db, client_error_message="Invalid reset password request", server_error_message="Internal server error")
            return {"message": "Password reset successful"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password with OTP: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def verify_password_reset_otp(email: str, otp_code: str, db: AsyncSession = None):
    """Verify OTP only (no password change)."""
    try:
        if not email or not otp_code:
            raise HTTPException(status_code=400, detail="Email and OTP are required")
        mongo = get_mongo_db()
        if settings.USE_MONGO and (mongo is not None):
            otp_doc = await mongo.password_reset_otps.find_one({
                "email": email,
                "otp_code": otp_code,
                "used_at": None
            })
            if not otp_doc:
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            try:
                exp = datetime.fromisoformat(otp_doc.get("expires_at"))
            except Exception:
                exp = datetime.utcnow()
            if exp < datetime.utcnow():
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            # Confirm user exists
            user_doc = await mongo.users.find_one({"email": email})
            if not user_doc:
                raise HTTPException(status_code=404, detail=f"Account not created for {email}")
            return {"message": "OTP verified"}

        async with get_or_use_session(db) as _db:
            otp_row = (await _db.execute(select(PasswordResetOTP).where(
                PasswordResetOTP.email == email,
                PasswordResetOTP.otp_code == otp_code,
                PasswordResetOTP.used_at.is_(None)
            ))).scalars().first()
            if not otp_row:
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            if otp_row.expires_at and otp_row.expires_at < datetime.utcnow():
                raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            user = (await _db.execute(select(UserModel).where(UserModel.email == email))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail=f"Account not created for {email}")
            return {"message": "OTP verified"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying password reset OTP: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@timeit("get_user_profile")
async def get_user_profile(username: str, db: AsyncSession  = None):
    """Get user profile"""
    try:
        async with get_or_use_session(db) as _db:
            result = await _db.execute(select(UserModel).where(UserModel.username == username))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            return {
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "credits": user.credits,
                "btc_address": user.btc_address,
                "profile": user.profile or {},
            }
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def update_user_profile(username: str, user_update: UserUpdate, db: AsyncSession  = None):
    """Update user profile"""
    try:
        async with get_or_use_session(db) as _db:
            result = await _db.execute(select(UserModel).where(UserModel.username == username))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            if user_update.email and user_update.email != user.email:
                result = await _db.execute(
                    select(UserModel).where(UserModel.email == user_update.email, UserModel.username != username)
                )
                if result.scalars().first():
                    raise HTTPException(status_code=400, detail="Email already registered")
                user.email = user_update.email

            if user_update.password:
                user.hashed_password = get_password_hash(user_update.password)

            await safe_commit(_db, client_error_message="Invalid profile update", server_error_message="Internal server error")
            return {"message": "Profile updated successfully"}
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def change_password(username: str, password_request: ChangePasswordRequest, db: AsyncSession  = None):
    """Change user password"""
    try:
        async with get_or_use_session(db) as _db:
            result = await _db.execute(select(UserModel).where(UserModel.username == username))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            if not verify_password(password_request.current_password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
            user.hashed_password = get_password_hash(password_request.new_password)
            await safe_commit(_db, client_error_message="Invalid password change request", server_error_message="Internal server error")
            return {"message": "Password changed successfully"}
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def get_user_by_username(username: str, db: AsyncSession  = None):
    """Get user by username"""
    try:
        async with get_or_use_session(db) as _db:
            result = await _db.execute(select(UserModel).where(UserModel.username == username))
            user = result.scalars().first()
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
            )
    except Exception as e:
        logger.error(f"Error getting user by username: {e}")
        return None