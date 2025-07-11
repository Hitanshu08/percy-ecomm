import os
import json
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional
import re

class Settings(BaseSettings):
    # App settings
    APP_NAME: str = "Percy E-commerce API"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Security settings
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Admin settings
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@percy.com"
    ADMIN_PASSWORD: str = "adminpass"
    ADMIN_USER_ID: str = "admin"
    ADMIN_ROLE: str = "admin"
    
    # MongoDB settings
    MONGODB_URL: str = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.5.5"
    MONGODB_DATABASE: str = "percy_ecomm"
    
    # CORS settings
    ALLOWED_ORIGINS: list = ["http://localhost:3000", "http://localhost:5173"]
    
    # API settings
    API_V1_STR: str = "/api/v1"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Load config from JSON file if it exists
config_path = Path(__file__).parent.parent / "config.json"
if config_path.exists():
    with open(config_path, 'r') as f:
        config_data = json.load(f)
    
    # Override settings with config file values
    for key, value in config_data.items():
        if hasattr(Settings, key):
            setattr(Settings, key, value)

settings = Settings()

# Load environment variables
def get_env_var(key: str, default: str = "") -> str:
    """Get environment variable with fallback to config file"""
    return os.getenv(key, getattr(settings, key, default))

# Update settings with environment variables
settings.SECRET_KEY = get_env_var("SECRET_KEY", settings.SECRET_KEY)
settings.MONGODB_URL = get_env_var("MONGODB_URL", settings.MONGODB_URL)
settings.MONGODB_DATABASE = get_env_var("MONGODB_DATABASE", settings.MONGODB_DATABASE)
settings.ADMIN_PASSWORD = get_env_var("ADMIN_PASSWORD", settings.ADMIN_PASSWORD)
settings.DEBUG = get_env_var("DEBUG", str(settings.DEBUG)) == True

def is_bcrypt_hash(s):
    # Bcrypt hashes start with $2b$ or $2a$ and are 60 chars long
    return isinstance(s, str) and re.match(r"^\$2[abxy]\$.{56}$", s)

