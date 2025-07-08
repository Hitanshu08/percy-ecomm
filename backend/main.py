from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.v1 import auth, users, services, wallet, admin
from core.config import settings
from db.mongodb import MongoDB
from db.base import initialize_database
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, tags=["Authentication"])
app.include_router(users.router, tags=["Users"])
app.include_router(services.router, tags=["Services"])
app.include_router(wallet.router, tags=["Wallet"])
app.include_router(admin.router, tags=["Admin"])

@app.on_event("startup")
async def startup_db_client():
    """Connect to MongoDB on startup and initialize with sample data"""
    await MongoDB.connect_to_mongo()
    try:
        initialize_database()
        logger.info("Database initialized with sample data")
    except Exception as e:
        logger.warning(f"Could not initialize database with sample data: {e}")
    logger.info("Application startup complete")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Close MongoDB connection on shutdown"""
    await MongoDB.close_mongo_connection()
    logger.info("Application shutdown complete")

@app.get("/")
async def root():
    return {"message": "Percy E-commerce API", "version": settings.VERSION}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}
