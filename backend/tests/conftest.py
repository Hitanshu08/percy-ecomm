"""
Pytest configuration and fixtures for the backend tests.
"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import AsyncMock, MagicMock
import os
import tempfile
from faker import Faker

from main import app
from db.session import get_db_session
from db.base import Base
from core.config import settings
from schemas.user_schema import User

# Initialize Faker for test data generation
fake = Faker()

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    future=True
)

# Create test session factory
TestSessionLocal = sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def setup_test_db():
    """Set up test database tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(setup_test_db) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
def client(db_session: AsyncSession) -> TestClient:
    """Create a test client with database session override."""
    def override_get_db():
        return db_session
    
    app.dependency_overrides[get_db_session] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client."""
    def override_get_db():
        return db_session
    
    app.dependency_overrides[get_db_session] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
def mock_user() -> User:
    """Create a mock user for testing."""
    return User(
        id=1,
        username=fake.user_name(),
        email=fake.email(),
        full_name=fake.name(),
        role="user",
        is_active=True,
        credits=100.0
    )


@pytest.fixture
def mock_admin_user() -> User:
    """Create a mock admin user for testing."""
    return User(
        id=2,
        username="admin",
        email="admin@test.com",
        full_name="Admin User",
        role="admin",
        is_active=True,
        credits=1000.0
    )


@pytest.fixture
def mock_token() -> str:
    """Create a mock JWT token for testing."""
    return "mock.jwt.token"


@pytest.fixture
def mock_mongo_db():
    """Mock MongoDB database for testing."""
    mock_db = AsyncMock()
    mock_collection = AsyncMock()
    mock_db.users = mock_collection
    mock_db.services = mock_collection
    mock_db.subscriptions = mock_collection
    return mock_db


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "username": fake.user_name(),
        "email": fake.email(),
        "full_name": fake.name(),
        "password": "testpassword123",
        "role": "user"
    }


@pytest.fixture
def sample_service_data():
    """Sample service data for testing."""
    return {
        "name": fake.company(),
        "description": fake.text(),
        "price": fake.pyfloat(min_value=1.0, max_value=100.0),
        "credits": fake.pyint(min_value=1, max_value=1000),
        "is_active": True
    }


@pytest.fixture
def sample_subscription_data():
    """Sample subscription data for testing."""
    return {
        "service_id": 1,
        "user_id": 1,
        "start_date": fake.date(),
        "end_date": fake.future_date(),
        "is_active": True
    }


# Pytest markers for different test types
pytest_plugins = ["pytest_asyncio"]
