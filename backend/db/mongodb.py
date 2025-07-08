from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from core.config import settings
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    sync_client: MongoClient = None
    
    @classmethod
    async def connect_to_mongo(cls):
        """Create database connection."""
        try:
            cls.client = AsyncIOMotorClient(settings.MONGODB_URL)
            cls.sync_client = MongoClient(settings.MONGODB_URL)
            logger.info("Connected to MongoDB.")
        except Exception as e:
            logger.error(f"Could not connect to MongoDB: {e}")
            raise e
    
    @classmethod
    async def close_mongo_connection(cls):
        """Close database connection."""
        if cls.client:
            cls.client.close()
            cls.sync_client.close()
            logger.info("Closed MongoDB connection.")
    
    @classmethod
    def get_database(cls):
        """Get database instance."""
        return cls.client[settings.MONGODB_DATABASE]
    
    @classmethod
    def get_sync_database(cls):
        """Get synchronous database instance."""
        if cls.sync_client is None:
            cls.sync_client = MongoClient(settings.MONGODB_URL)
        return cls.sync_client[settings.MONGODB_DATABASE]

# Database collections
def get_users_collection():
    """Get users collection."""
    return MongoDB.get_database().users

def get_services_collection():
    """Get services collection."""
    return MongoDB.get_database().services

def get_refresh_tokens_collection():
    """Get refresh tokens collection."""
    return MongoDB.get_database().refresh_tokens

def get_sync_users_collection():
    """Get synchronous users collection."""
    return MongoDB.get_sync_database().users

def get_sync_services_collection():
    """Get synchronous services collection."""
    return MongoDB.get_sync_database().services

def get_sync_refresh_tokens_collection():
    """Get synchronous refresh tokens collection."""
    return MongoDB.get_sync_database().refresh_tokens 