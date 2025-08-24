from core.security import get_password_hash
from core.config import settings
from db.session import Base, engine
from db.models.user import User
from db.models.service import Service
import logging

logger = logging.getLogger(__name__)

def initialize_database():
    """Create tables only. Use database_setup.ipynb for seeding data."""
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
        
        # Note: Data seeding is now handled by database_setup.ipynb
        # Run that notebook to populate the database with sample data
        
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise e