from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.sql import func
from db.session import Base


class ReferralCredit(Base):
    __tablename__ = "referral_credits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    referrer_user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    referred_user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    subscription_id = Column(Integer, ForeignKey("user_subscriptions.id"), nullable=True)
    credits_awarded = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        UniqueConstraint("referrer_user_id", "referred_user_id", name="uq_referrer_referred"),
        Index("ix_referral_credits_referrer", "referrer_user_id"),
        Index("ix_referral_credits_referred", "referred_user_id"),
    )

