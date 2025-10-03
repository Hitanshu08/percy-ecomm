from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # App settings
    APP_NAME: str = "Valuesubs E-commerce API"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Security settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Admin settings
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str
    ADMIN_PASSWORD: str
    ADMIN_USER_ID: str = "admin"
    ADMIN_ROLE: str = "admin"
    
    # Database settings (MySQL)
    DATABASE_URL: str
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 300
    DB_POOL_TIMEOUT: int = 10
    DB_PRE_PING: bool = True
    DB_COMPILED_CACHE_SIZE: int = 256
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "https://valuesubs.com",
        "https://www.valuesubs.com",
        "http://127.0.0.1:8000"
    ]
    
    # API settings
    API_V1_STR: str = "/api/v1"
    API_BASE_URL: str = "http://127.0.0.1:8000"
    LOG_LEVEL: str = "DEBUG"
    LOG_DIR: str = "logs"
    LOG_TTL_DAYS: int = 7
    
    # SMTP / Email settings
    SMTP_HOST: str = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = None
    SMTP_PASSWORD: str = None
    SMTP_FROM_EMAIL: str = None
    SMTP_FROM_NAME: str = "Valuesubs"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_TIMEOUT: int = 15
    SMTP_DEBUG: bool = False

    # MongoDB (optional)
    USE_MONGO: bool = True
    MONGO_URI: str = None
    MONGO_DB: str = "percy_ecomm"
    
    # Payments (NOWPayments)
    # NOWPAYMENTS_API_KEY: str = None
    # NOWPAYMENTS_IPN_SECRET: str = None
    # NOWPAYMENTS_BASE_URL: str = "https://api.nowpayments.io/v1"
    # PAYMENT_SUCCESS_URL: str = "https://valuesubs.com/wallet?payment=success"
    # PAYMENT_CANCEL_URL: str = "https://valuesubs.com/wallet?payment=cancel"

    class Config:
        env_file = ".env"
        case_sensitive = True

# Create settings instance
settings = Settings()

# Validate required settings
if not settings.SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")

if not settings.ADMIN_EMAIL:
    raise ValueError("ADMIN_EMAIL environment variable is required")

if not settings.ADMIN_PASSWORD:
    raise ValueError("ADMIN_PASSWORD environment variable is required")

if not settings.DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")
