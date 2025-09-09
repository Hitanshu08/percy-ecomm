from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import event
from contextlib import asynccontextmanager
from core.config import settings
import logging

# SQLAlchemy base and async session configuration
Base = declarative_base()

# Normalize DATABASE_URL to an async driver
def _to_async_database_url(url: str) -> str:
	if not url:
		return url
	# Common sync → async conversions
	# mysql+pymysql:// -> mysql+aiomysql://
	if url.startswith("mysql+pymysql://"):
		return url.replace("mysql+pymysql://", "mysql+aiomysql://", 1)
	# mysql:// -> mysql+aiomysql://
	if url.startswith("mysql://"):
		return url.replace("mysql://", "mysql+aiomysql://", 1)
	return url

ASYNC_DATABASE_URL = _to_async_database_url(settings.DATABASE_URL)
logger = logging.getLogger("percy_ecomm")

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    future=True,
    pool_pre_ping=True,                 # validate before checkout
    pool_recycle=int(getattr(settings, "DB_POOL_RECYCLE", 300)),  # 5 min < common wait_timeout
    pool_size=int(getattr(settings, "DB_POOL_SIZE", 10)),
    max_overflow=int(getattr(settings, "DB_MAX_OVERFLOW", 20)),
    pool_timeout=int(getattr(settings, "DB_POOL_TIMEOUT", 30)),   # give a bit more time
    pool_use_lifo=True,                 # reduce stampede when reconnecting
    echo=False,                         # set True temporarily if you need SQL logs
    connect_args={
        # asyncmy supports these timeouts
        "connect_timeout": int(getattr(settings, "DB_CONNECT_TIMEOUT", 10)),
        # don't set charset here; already in URL
    },
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    # autocommit is removed in SA 2.x; avoid passing it
    # keep autoflush default (True) unless you have a reason to disable
)

async def get_db_session():
    async with SessionLocal() as db:
        try:
            logger.debug("DB session dependency: opened")
            yield db
            # note: explicitly commit in your service/repo layer when you intend to
        except Exception:
            # rollback so the connection isn’t returned to pool in a bad state
            await db.rollback()
            raise
        finally:
            logger.debug("DB session dependency: closed")

@asynccontextmanager
async def get_or_use_session(new_db: AsyncSession):
    """Yield provided AsyncSession without closing it, or create one if None."""
    if new_db is None:
        logger.debug("DB session: creating new session")
        async with SessionLocal() as new_db:
            try:
                yield new_db
            except Exception:
                await new_db.rollback()
                raise
    else:
        logger.debug("DB session: reusing provided session")
        yield new_db


# Engine/pool debug events
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
