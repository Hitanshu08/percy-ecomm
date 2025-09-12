from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import event
from contextlib import asynccontextmanager
from core.config import settings
import logging
from typing import Optional

Base = declarative_base()
logger = logging.getLogger("percy_ecomm")

def _to_async_database_url(url: str) -> str:
    if not url:
        return url
    # Prefer aiomysql; remove asyncmy usage
    if url.startswith("mysql+pymysql://"):
        return url.replace("mysql+pymysql://", "mysql+aiomysql://", 1)
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+aiomysql://", 1)
    # If someone already used asyncmy, downgrade to aiomysql to avoid dependency
    if url.startswith("mysql+asyncmy://"):
        return url.replace("mysql+asyncmy://", "mysql+aiomysql://", 1)
    return url

ASYNC_DATABASE_URL = _to_async_database_url(settings.DATABASE_URL)

# Pick sane defaults:
# - pool_recycle < DB wait_timeout (often 600s). Use 300–500s.
# - pool_timeout short-ish (10–30s)
# - modest pool size to avoid stampedes on small DBs
if not settings.USE_MONGO:
    engine = create_async_engine(
        ASYNC_DATABASE_URL,
        future=True,
        echo=False,
        pool_pre_ping=bool(getattr(settings, "DB_PRE_PING", True)),
        pool_recycle=int(getattr(settings, "DB_POOL_RECYCLE", 500)),
        pool_size=int(getattr(settings, "DB_POOL_SIZE", 10)),
        max_overflow=int(getattr(settings, "DB_MAX_OVERFLOW", 10)),
        pool_timeout=int(getattr(settings, "DB_POOL_TIMEOUT", 30)),
        connect_args={
            "connect_timeout": int(getattr(settings, "DB_CONNECT_TIMEOUT", 10)),
        },
    )

    SessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
else:
    engine = None  # type: ignore
    async def _noop_session_cm():
        yield None
    # Placeholder to satisfy imports; not used when USE_MONGO=true
    class _NoSQLSessionFactory:
        async def __aenter__(self):
            return None
        async def __aexit__(self, exc_type, exc, tb):
            return False
        def __call__(self, *args, **kwargs):
            return self
        async def __aiter__(self):
            yield None
    SessionLocal = _NoSQLSessionFactory()  # type: ignore

async def get_db_session():
    if settings.USE_MONGO:
        # Do not open SQL sessions in Mongo mode
        yield None
        return
    async with SessionLocal() as db:
        try:
            logger.debug("DB session dependency: opened")
            yield db
        except Exception:
            # ensure we always rollback when something goes wrong
            try:
                await db.rollback()
            finally:
                pass
            raise
        finally:
            logger.debug("DB session dependency: closed")

@asynccontextmanager
async def get_or_use_session(db: Optional[AsyncSession]):
    """Yield provided AsyncSession without closing it, or create one if None."""
    if settings.USE_MONGO:
        # Yield None in Mongo mode; callers must guard
        yield None
        return
    if db is None:
        logger.debug("DB session: creating new session")
        async with SessionLocal() as new_db:
            try:
                yield new_db
            except Exception:
                try:
                    await new_db.rollback()
                finally:
                    pass
                raise
    else:
        logger.debug("DB session: reusing provided session")
        yield db

# Optional: lightweight pool logging (safe to keep)
if not settings.USE_MONGO and engine is not None:
    @event.listens_for(engine.sync_engine, "connect")
    def _on_connect(dbapi_connection, connection_record):
        logger.debug("DB connect: id=%s", id(connection_record))

    @event.listens_for(engine.sync_engine, "close")
    def _on_close(dbapi_connection, connection_record):
        logger.debug("DB close: id=%s", id(connection_record))

    @event.listens_for(engine.sync_engine, "checkout")
    def _on_checkout(dbapi_connection, connection_record, connection_proxy):
        logger.debug("DB checkout: id=%s", id(connection_record))

    @event.listens_for(engine.sync_engine, "checkin")
    def _on_checkin(dbapi_connection, connection_record):
        logger.debug("DB checkin: id=%s", id(connection_record))
