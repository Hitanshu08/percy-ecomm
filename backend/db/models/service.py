from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.types import JSON
from db.session import Base


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    image = Column(String(1024), default="")
    accounts = Column(JSON, default=list)
    credits = Column(JSON, default=dict)  # per-duration credits mapping, e.g., {"7days": 1, "1month": 2}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True, nullable=False)


class ServiceAccount(Base):
    __tablename__ = "service_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    service_id = Column(Integer, ForeignKey("services.id"), index=True, nullable=False)
    account_id = Column(String(255), index=True, nullable=False)
    password_hash = Column(String(255), default="")
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    __table_args__ = (
        Index("ix_service_accounts_active_by_service", "service_id", "is_active"),
        Index("ix_service_accounts_service_end_date", "service_id", "end_date"),
    )