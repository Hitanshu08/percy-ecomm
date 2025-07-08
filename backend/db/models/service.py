from sqlalchemy import Column, String, Boolean, JSON, DateTime, Integer
from sqlalchemy.sql import func
from app.db.base import Base

class Service(Base):
    __tablename__ = "services"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    image = Column(String)
    accounts = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)

class ServiceAccount(Base):
    __tablename__ = "service_accounts"

    id = Column(String, primary_key=True, index=True)
    service_id = Column(String, index=True)
    account_id = Column(String, index=True)
    password_hash = Column(String)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now()) 