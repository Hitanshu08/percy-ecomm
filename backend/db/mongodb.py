import logging
import asyncio
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import certifi
from core.config import settings

logger = logging.getLogger(__name__)

_mongo_client: Optional[AsyncIOMotorClient] = None
_mongo_db: Optional[AsyncIOMotorDatabase] = None

def get_mongo_db() -> Optional[AsyncIOMotorDatabase]:
    global _mongo_client, _mongo_db
    if not settings.USE_MONGO:
        return None
    if _mongo_db is not None:
        return _mongo_db
    if not settings.MONGO_URI:
        logger.warning("USE_MONGO=true but MONGO_URI is not set")
        return None
    # Use secure defaults suitable for MongoDB Atlas and TLS endpoints
    client_kwargs = {
        "serverSelectionTimeoutMS": 30000,
        "connectTimeoutMS": 20000,
        "socketTimeoutMS": 20000,
    }
    # If connecting to Atlas or any TLS endpoint, pass CA bundle explicitly to avoid local OpenSSL issues
    try:
        if "mongodb.net" in settings.MONGO_URI or settings.MONGO_URI.startswith("mongodb+srv://"):
            client_kwargs.update({
                "tls": True,
                "tlsCAFile": certifi.where(),
                "retryWrites": True,
            })
    except Exception:
        pass
    # For Atlas SRV, explicitly avoid directConnection
    try:
        if settings.MONGO_URI.startswith("mongodb+srv://"):
            client_kwargs["directConnection"] = False
    except Exception:
        pass
    _mongo_client = AsyncIOMotorClient(settings.MONGO_URI, **client_kwargs)
    _mongo_db = _mongo_client[settings.MONGO_DB]
    return _mongo_db

async def init_mongo_indexes():
    db = get_mongo_db()
    if db is None:
        return
    # Retry ping and index creation to allow primary election / networking delays
    for attempt in range(1, 6):
        try:
            await db.command({"ping": 1})
            # Users
            await db.users.create_index("username", unique=True, name="u_username")
            await db.users.create_index("email", unique=True, name="u_email")
            # Services
            await db.services.create_index("name", unique=True, name="u_service_name")
            # Subscriptions
            await db.subscriptions.create_index([("username", 1), ("service_name", 1)], name="i_user_service")
            await db.subscriptions.create_index("is_active", name="i_active")
            # Refresh tokens
            await db.refresh_tokens.create_index("token", unique=True, name="u_token")
            await db.refresh_tokens.create_index("username", name="i_rt_username")
            return
        except Exception as e:
            wait_s = min(2 ** attempt, 15)
            logger.warning(f"Mongo not ready (attempt {attempt}): {e}; retrying in {wait_s}s")
            await asyncio.sleep(wait_s)
    logger.error("Mongo index initialization failed after retries")