from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from api.v1 import auth, users, services, wallet, admin
from core.config import settings
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

NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

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
    """Initialize SQL database with sample data if needed"""
    try:
        initialize_database()
        logger.info("Database initialized with sample data")
    except Exception as e:
        logger.warning(f"Could not initialize database with sample data: {e}")
    logger.info("Application startup complete")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Application shutdown"""
    logger.info("Application shutdown complete")

@app.get("/")
async def root():
    return {"message": "Valuesubs E-commerce API", "version": settings.VERSION}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}
