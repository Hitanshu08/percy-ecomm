from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func
from db.session import Base


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), index=True, nullable=False)
    otp_code = Column(String(10), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_password_reset_email_created", "email", "created_at"),
    )


