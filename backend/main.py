from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from api.v1 import auth, users, services, wallet, admin
from core.config import settings
from db.base import initialize_database
from db.session import engine, SessionLocal
from sqlalchemy import text
import logging
from utils.logging_config import configure_logging, RequestContextMiddleware

# Configure logging with date-based files and TTL retention
logger = configure_logging("percy_ecomm")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG
)

# Add GZip compression for larger JSON payloads
app.add_middleware(GZipMiddleware, minimum_size=500)

# Add logging context middleware to capture user_id and API path
app.add_middleware(RequestContextMiddleware)

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
        await initialize_database()
        logger.info("Database initialized with sample data")
    except Exception as e:
        logger.warning(f"Could not initialize database with sample data: {e}")
    logger.info("Application startup complete")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Application shutdown"""
    try:
        await engine.dispose()
        logger.info("Disposed DB engine")
    except Exception as e:
        logger.warning(f"Engine dispose failed: {e}")
    logger.info("Application shutdown complete")

@app.get("/")
async def root():
    return {"message": "Valuesubs E-commerce API", "version": settings.VERSION}

@app.get("/health")
async def health_check():
    # Actively check DB connectivity
    try:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.warning(f"Health DB check failed: {e}")
        db_status = "unavailable"
    return {"status": "healthy", "database": db_status}
