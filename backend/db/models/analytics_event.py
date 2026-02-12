from sqlalchemy import Column, String, DateTime, Integer, Index
from sqlalchemy.sql import func
from sqlalchemy.types import JSON
from db.session import Base


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(100), index=True, nullable=False)
    status = Column(String(20), index=True, nullable=False, default="success")
    actor_username = Column(String(255), index=True, nullable=True)
    actor_role = Column(String(50), index=True, nullable=True)
    target_username = Column(String(255), index=True, nullable=True)
    source = Column(String(50), index=True, nullable=True)
    external_ref = Column(String(255), index=True, nullable=True)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_analytics_event_type_created_at", "event_type", "created_at"),
        Index("ix_analytics_actor_created_at", "actor_username", "created_at"),
        Index("ix_analytics_target_created_at", "target_username", "created_at"),
    )
