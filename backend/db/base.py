# In-memory storage for current implementation
# This will be replaced with database models in the future
# fake_users_db = {}
# services_db = {}
# refresh_tokens_db = {}

# Initialize admin user
from core.security import get_password_hash
from core.config import settings
from db.mongodb import get_sync_users_collection, get_sync_services_collection, get_sync_refresh_tokens_collection
import logging

logger = logging.getLogger(__name__)

# Sample data for MongoDB initialization
SAMPLE_USERS = {
    "admin": {
        "username": settings.ADMIN_USERNAME,
        "email": settings.ADMIN_EMAIL,
        "user_id": settings.ADMIN_USER_ID,
        "hashed_password": get_password_hash(settings.ADMIN_PASSWORD),
        "role": settings.ADMIN_ROLE,
        "services": [
            {"service_id": "qb1", "end_date": "31/12/2025", "is_active": True},
            {"service_id": "gram1", "end_date": "31/12/2025", "is_active": True},
            {"service_id": "chat1", "end_date": "31/10/2025", "is_active": True}
        ],
        "credits": 100000,
        "btc_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
        "notifications": [
            "Welcome to Percy E-commerce Admin Panel!",
            "You have 3 active service subscriptions",
            "System maintenance scheduled for tomorrow"
        ],
        "profile": {
            "first_name": "Admin",
            "last_name": "User",
            "phone": "+1-555-0123",
            "country": "United States",
            "timezone": "UTC-5",
            "preferences": {
                "email_notifications": True,
                "sms_notifications": False,
                "theme": "dark"
            }
        }
    },
    "testuser": {
        "username": "testuser",
        "email": "test@example.com",
        "user_id": "testuser",
        "hashed_password": get_password_hash("userpass123"),
        "role": "user",
        "services": [
            {"service_id": "qb1", "end_date": "31/12/2025", "is_active": True}
        ],
        "credits": 500,
        "btc_address": "btc-testuser",
        "notifications": ["Welcome to Percy E-commerce!"],
        "profile": {
            "first_name": "Test",
            "last_name": "User",
            "phone": "+1-555-9999",
            "country": "Canada",
            "timezone": "UTC-8",
            "preferences": {
                "email_notifications": True,
                "sms_notifications": True,
                "theme": "light"
            }
        }
    },
    "premiumuser": {
        "username": "premiumuser",
        "email": "premium@example.com",
        "user_id": "premiumuser",
        "hashed_password": get_password_hash("premium123"),
        "role": "user",
        "services": [
            {"service_id": "qb2", "end_date": "30/11/2025", "is_active": True},
            {"service_id": "chat1", "end_date": "31/10/2025", "is_active": True}
        ],
        "credits": 2500,
        "btc_address": "bc1qpremiumuser123456789",
        "notifications": [
            "Welcome to Percy E-commerce!",
            "You have 2 active subscriptions",
            "New service available: Jasper AI"
        ],
        "profile": {
            "first_name": "Premium",
            "last_name": "Customer",
            "phone": "+1-555-8888",
            "country": "United Kingdom",
            "timezone": "UTC+0",
            "preferences": {
                "email_notifications": True,
                "sms_notifications": False,
                "theme": "auto"
            }
        }
    }
}

SAMPLE_SERVICES = {
    "Quillbot": {
        "name": "Quillbot",
        "image": "https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=Quillbot",
        "accounts": [
            {"id": "qb1", "password": "pass1", "end_date": "31/12/2025", "is_active": True},
            {"id": "qb2", "password": "pass2", "end_date": "30/11/2025", "is_active": True}
        ]
    },
    "Grammarly": {
        "name": "Grammarly", 
        "image": "https://via.placeholder.com/300x200/10B981/FFFFFF?text=Grammarly",
        "accounts": [
            {"id": "gram1", "password": "pass3", "end_date": "31/12/2025", "is_active": True}
        ]
    },
    "ChatGPT": {
        "name": "ChatGPT",
        "image": "https://via.placeholder.com/300x200/8B5CF6/FFFFFF?text=ChatGPT", 
        "accounts": [
            {"id": "chat1", "password": "pass4", "end_date": "31/01/2026", "is_active": True}
        ]
    }
}

def initialize_database():
    """Initialize MongoDB with sample data"""
    try:
        users_collection = get_sync_users_collection()
        services_collection = get_sync_services_collection()
        
        # Clear existing data
        users_collection.delete_many({})
        services_collection.delete_many({})
        
        # Insert sample users
        for username, user_data in SAMPLE_USERS.items():
            users_collection.update_one(
                {"username": username},
                {"$set": user_data},
                upsert=True
            )
        
        # Insert sample services
        for service_name, service_data in SAMPLE_SERVICES.items():
            services_collection.update_one(
                {"name": service_name},
                {"$set": service_data},
                upsert=True
            )
        
        logger.info("Database initialized with sample data")
        
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise e

# Legacy fake database access (for backward compatibility during transition)
def get_fake_users_db():
    """Get users from MongoDB (replaces fake_users_db)"""
    try:
        users_collection = get_sync_users_collection()
        users = {}
        for user in users_collection.find():
            users[user["username"]] = user
        return users
    except Exception as e:
        logger.error(f"Error getting users from MongoDB: {e}")
        return {}

def get_fake_services_db():
    """Get services from MongoDB (replaces services_db)"""
    try:
        services_collection = get_sync_services_collection()
        services = {}
        for service in services_collection.find():
            services[service["name"]] = service
        return services
    except Exception as e:
        logger.error(f"Error getting services from MongoDB: {e}")
        return {}

def get_fake_refresh_tokens_db():
    """Get refresh tokens from MongoDB (replaces refresh_tokens_db)"""
    try:
        tokens_collection = get_sync_refresh_tokens_collection()
        tokens = {}
        for token in tokens_collection.find():
            tokens[token["username"]] = token["refresh_token"]
        return tokens
    except Exception as e:
        logger.error(f"Error getting refresh tokens from MongoDB: {e}")
        return {}

# Export for backward compatibility
fake_users_db = get_fake_users_db
fake_services_db = get_fake_services_db
fake_refresh_tokens_db = get_fake_refresh_tokens_db 