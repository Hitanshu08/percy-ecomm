from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, scoped_session
from core.config import settings

# SQLAlchemy base and session configuration
Base = declarative_base()

# Expect a DATABASE_URL like: mysql+pymysql://user:password@localhost:3306/percy_ecomm
DATABASE_URL = getattr(settings, "DATABASE_URL", None)
if not DATABASE_URL:
    # Fallback to a sensible default; user should override via env/.env
    DATABASE_URL = "mysql+pymysql://root:password@127.0.0.1:3306/percy_ecomm"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = scoped_session(
    sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
)

def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

