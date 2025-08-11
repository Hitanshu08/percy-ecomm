from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from db.session import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(255), index=True, nullable=False)
    # Keep token length within index byte limits for utf8mb4 (<= 3072 bytes): 512 chars * 4 bytes = 2048
    token = Column(String(512), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

