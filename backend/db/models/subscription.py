from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.sql import func
from db.session import Base


class ServiceDurationCredit(Base):
    __tablename__ = "service_duration_credits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    service_id = Column(Integer, ForeignKey("services.id"), index=True, nullable=False)
    duration_key = Column(String(50), nullable=False)
    credits = Column(Integer, default=0, nullable=False)
    __table_args__ = (UniqueConstraint("service_id", "duration_key", name="uq_service_duration"),)


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), index=True, nullable=False)
    account_id = Column(Integer, ForeignKey("service_accounts.id"), index=True, nullable=True)
    start_date = Column(Date)
    end_date = Column(Date)
    is_active = Column(Boolean, default=True, nullable=False)
    duration_key = Column(String(50))
    total_duration_days = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    __table_args__ = (
        Index("ix_user_subs_user_service_active", "user_id", "service_id", "is_active"),
        Index("ix_user_subs_user_account", "user_id", "account_id"),
    )


