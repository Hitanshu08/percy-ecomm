from sqlalchemy import Column, String, Integer, Boolean, DateTime, Index
from sqlalchemy.sql import func
from sqlalchemy.types import JSON
from db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), unique=True, index=True)
    username = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)
    credits = Column(Integer, default=0, nullable=False)
    btc_address = Column(String(255), default="")
    services = Column(JSON, default=list)
    profile = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True, nullable=False)
    __table_args__ = (
        Index("ix_users_username_email", "username", "email"),
    )