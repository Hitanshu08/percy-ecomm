from fastapi import Depends, HTTPException, status
from core.security import oauth2_scheme, verify_token
from schemas.user_schema import User as UserSchema
from db.session import get_db_session, SessionLocal
from core.config import settings
from db.mongodb import get_mongo_db
from db.models.user import User as UserModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

logger = logging.getLogger(__name__)

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db_session)) -> UserSchema:
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub") or ""
    email = payload.get("email") or ""
    user_id = payload.get("user_id") or username
    role = payload.get("role") or "user"

    # Fast path: build from JWT claims to avoid DB dependency on every request
    token_user = UserSchema(
        username=username,
        email=email,
        user_id=user_id,
        role=role,
        services=[],
        credits=0,
        btc_address="",
    )

    if not username:
        # Malformed token
        raise HTTPException(status_code=404, detail="User not found")

    async def _fetch(session: AsyncSession, uname: str):
        result = await session.execute(select(UserModel).where(UserModel.username == uname))
        return result.scalars().first()

    # Try to enrich with DB data; tolerate transient transport issues by falling back to token claims
    if settings.USE_MONGO:
        # In Mongo mode, enrich from Mongo if available; fallback to token claims
        try:
            mdb = get_mongo_db()
            if mdb is not None and username:
                doc = await mdb.users.find_one({"username": username})
                if doc:
                    return UserSchema(
                        username=doc.get("username", username),
                        email=doc.get("email", email),
                        user_id=doc.get("user_id", user_id),
                        role=doc.get("role", role),
                        services=[],
                        credits=int(doc.get("credits", 0)),
                        btc_address=str(doc.get("btc_address", "")),
                    )
        except Exception:
            pass
        return token_user

    try:
        db_user = await _fetch(db, username)
    except Exception as e:
        logger.warning(f"get_current_user initial DB attempt failed: {e}; retrying with fresh session")
        try:
            await db.rollback()
        except Exception:
            pass
        try:
            async with SessionLocal() as fresh_db:
                db_user = await _fetch(fresh_db, username)
        except Exception as e2:
            logger.error(f"get_current_user retry failed: {e2}; falling back to token claims")
            return token_user

    if not db_user:
        # If DB says no user, still return token claims to avoid 500s due to transient replication
        return token_user

    return UserSchema(
        username=db_user.username,
        email=db_user.email,
        user_id=db_user.user_id or db_user.username,
        role=db_user.role,
        services=db_user.services or [],
        credits=db_user.credits,
        btc_address=db_user.btc_address or "",
    )

async def admin_required(current_user: UserSchema = Depends(get_current_user)) -> UserSchema:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Fast path: trust JWT claims to verify admin role without DB hit
async def admin_required_fast(token: str = Depends(oauth2_scheme)) -> UserSchema:
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    role = payload.get("role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return UserSchema(
        username=payload.get("sub", ""),
        email=payload.get("email", ""),
        user_id=payload.get("user_id", ""),
        role=role,
        services=[],
        credits=0,
        btc_address="",
    )