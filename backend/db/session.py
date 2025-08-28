from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from core.config import settings

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

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    future=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

async def get_db_session():
    async with SessionLocal() as db:
        yield db

