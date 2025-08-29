from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # App settings
    APP_NAME: str = "Valuesubs E-commerce API"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Security settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Admin settings
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str
    ADMIN_PASSWORD: str
    ADMIN_USER_ID: str = "admin"
    ADMIN_ROLE: str = "admin"
    
    # Database settings (MySQL)
    DATABASE_URL: str
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # API settings
    API_V1_STR: str = "/api/v1"
    API_BASE_URL: str = "https://devmens.com"
    LOG_LEVEL: str = "INFO"
    
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

