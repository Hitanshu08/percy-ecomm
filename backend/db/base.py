from core.security import get_password_hash
from core.config import settings
from db.session import Base, engine
from db.models.user import User
from db.models.service import Service
import logging

logger = logging.getLogger(__name__)

# Sample data for SQL initialization
SAMPLE_USERS = {
    "admin": {
        "username": settings.ADMIN_USERNAME,
        "email": settings.ADMIN_EMAIL,
        "user_id": settings.ADMIN_USER_ID,
        "hashed_password": get_password_hash(settings.ADMIN_PASSWORD),
        "role": settings.ADMIN_ROLE,
        "services": [
            {"service_id": "qb1", "end_date": "31/12/2025", "is_active": True, "credits": 3500},  # 1 year Quillbot
            {"service_id": "gram1", "end_date": "31/12/2025", "is_active": True, "credits": 3000},  # 1 year Grammarly
            {"service_id": "chat1", "end_date": "31/10/2025", "is_active": True, "credits": 4500}   # 1 year ChatGPT
        ],
        "credits": 100000,
        "btc_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
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
            {"service_id": "qb1", "end_date": "31/12/2025", "is_active": True, "credits": 500}  # 1 month Quillbot
        ],
        "credits": 500,
        "btc_address": "btc-testuser",
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
            {"service_id": "qb2", "end_date": "30/11/2025", "is_active": True, "credits": 1200},  # 3 months Quillbot
            {"service_id": "chat1", "end_date": "31/10/2025", "is_active": True, "credits": 1500}   # 3 months ChatGPT
        ],
        "credits": 2500,
        "btc_address": "bc1qpremiumuser123456789",
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
    """Create tables and seed initial data if empty (MySQL)."""
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)

        from sqlalchemy.orm import Session
        with Session(bind=engine, future=True) as db:
            # Seed users if none
            existing_users = db.query(User).count()
            if existing_users == 0:
                for username, user_data in SAMPLE_USERS.items():
                    db.add(User(
                        user_id=user_data.get("user_id", username),
                        username=user_data["username"],
                        email=user_data["email"],
                        hashed_password=user_data["hashed_password"],
                        role=user_data.get("role", "user"),
                        credits=user_data.get("credits", 0),
                        btc_address=user_data.get("btc_address", ""),
                        services=user_data.get("services", []),
                        profile=user_data.get("profile", {}),
                    ))
                db.commit()

            # Seed services if none
            existing_services = db.query(Service).count()
            if existing_services == 0:
                for _, service_data in SAMPLE_SERVICES.items():
                    db.add(Service(
                        name=service_data["name"],
                        image=service_data.get("image", ""),
                        accounts=service_data.get("accounts", []),
                        is_active=True,
                    ))
                db.commit()

        logger.info("Database initialized with sample data (MySQL)")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise e