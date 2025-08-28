from core.security import get_password_hash
from core.config import settings
from db.session import Base, engine
from db.models.user import User
from db.models.service import Service
import logging
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)

async def initialize_database():
    """Create tables only. Use database_setup.ipynb for seeding data."""
    try:
        # Run DDL in async context
        assert isinstance(engine, AsyncEngine)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
        
        # Note: Data seeding is now handled by database_setup.ipynb
        # Run that notebook to populate the database with sample data
        
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise e