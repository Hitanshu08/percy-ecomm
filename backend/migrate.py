import asyncio
import logging
from datetime import datetime, date

from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, UniqueConstraint, select
from sqlalchemy.orm import relationship
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from db.session import Base, engine, SessionLocal
from db.models.user import User
from db.models.service import Service, ServiceAccount  # ServiceAccount model already exists

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

# New normalized models (only used by this migration script)
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

def parse_date_maybe(s):
    if not s:
        return None
    if isinstance(s, date):
        return s
    if isinstance(s, datetime):
        return s.date()
    try:
        # dd/mm/yyyy
        if "/" in s:
            return datetime.strptime(s, "%d/%m/%Y").date()
        # yyyy-mm-dd
        if "-" in s and len(s) == 10:
            return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None
    return None

async def ensure_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Ensured tables exist (including new normalized tables).")

async def migrate_service_accounts(session: AsyncSession):
    total_inserted = 0
    result = await session.execute(select(Service))
    services = result.scalars().all()
    for svc in services:
        accounts = svc.accounts or []
        for acc in accounts:
            acc_id_str = acc.get("id")
            if not acc_id_str:
                continue
            # does this account already exist?
            existing = await session.execute(
                select(ServiceAccount).where(
                    ServiceAccount.service_id == svc.id,
                    ServiceAccount.account_id == acc_id_str
                )
            )
            if existing.scalars().first():
                continue
            new_sa = ServiceAccount(
                service_id=svc.id,
                account_id=acc_id_str,
                password_hash=acc.get("password", "") or "",
                end_date=parse_date_maybe(acc.get("end_date")),
                is_active=bool(acc.get("is_active", True)),
            )
            session.add(new_sa)
            total_inserted += 1
    await session.commit()
    logger.info(f"Migrated Service.accounts -> service_accounts: inserted {total_inserted}")

async def migrate_service_credits(session: AsyncSession):
    inserted = 0
    result = await session.execute(select(Service))
    for svc in result.scalars().all():
        credits_map = svc.credits or {}
        for duration_key, credits in credits_map.items():
            exists = await session.execute(
                select(ServiceDurationCredit).where(
                    ServiceDurationCredit.service_id == svc.id,
                    ServiceDurationCredit.duration_key == duration_key
                )
            )
            if exists.scalars().first():
                continue
            try:
                val = int(credits)
            except Exception:
                val = 0
            session.add(ServiceDurationCredit(
                service_id=svc.id,
                duration_key=duration_key,
                credits=val
            ))
            inserted += 1
    await session.commit()
    logger.info(f"Migrated Service.credits -> service_duration_credits: inserted {inserted}")

async def resolve_service_for_subscription(session: AsyncSession, sub: dict, services_by_name: dict, accounts_index: dict):
    # Prefer service_name
    svc_name = sub.get("service_name")
    if svc_name and svc_name in services_by_name:
        return services_by_name[svc_name].id
    # Else try to resolve by account id
    acc_id_str = sub.get("account_id") or sub.get("service_id")
    if acc_id_str and acc_id_str in accounts_index:
        return accounts_index[acc_id_str]["service_id"]
    return None

async def build_accounts_index(session: AsyncSession):
    # Map account_id string -> {sa_id, service_id}
    idx = {}
    result = await session.execute(select(ServiceAccount))
    for sa in result.scalars().all():
        idx[sa.account_id] = {"sa_id": sa.id, "service_id": sa.service_id}
    return idx

async def migrate_user_subscriptions(session: AsyncSession):
    services_by_name = {s.name: s for s in (await session.execute(select(Service))).scalars().all()}
    accounts_idx = await build_accounts_index(session)
    users = (await session.execute(select(User))).scalars().all()

    inserted = 0
    today = date.today()

    for u in users:
        subs = u.services or []
        for sub in subs:
            service_id = await resolve_service_for_subscription(session, sub, services_by_name, accounts_idx)
            if not service_id:
                continue

            acc_id_str = sub.get("account_id") or sub.get("service_id")
            sa_id = None
            if acc_id_str and acc_id_str in accounts_idx:
                sa_id = accounts_idx[acc_id_str]["sa_id"]

            start_date = parse_date_maybe(sub.get("assignment_date") or sub.get("created_date"))
            end_date = parse_date_maybe(sub.get("end_date"))
            is_active = bool(sub.get("is_active", True))
            if end_date and (end_date - today).days < 0:
                is_active = False

            try:
                td = int(sub.get("total_duration", 0) or 0)
            except Exception:
                td = 0

            duration_key = sub.get("duration")
            # Check if already migrated (avoid duplicates):
            exists = await session.execute(
                select(UserSubscription).where(
                    UserSubscription.user_id == u.id,
                    UserSubscription.service_id == service_id,
                    # Use account and end_date combo to avoid dupes
                    UserSubscription.account_id == (sa_id if sa_id else None),
                    UserSubscription.end_date == (end_date if end_date else None),
                )
            )
            if exists.scalars().first():
                continue

            us = UserSubscription(
                user_id=u.id,
                service_id=service_id,
                account_id=sa_id,
                start_date=start_date,
                end_date=end_date,
                is_active=is_active,
                duration_key=duration_key,
                total_duration_days=td,
            )
            session.add(us)
            inserted += 1

    await session.commit()
    logger.info(f"Migrated User.services -> user_subscriptions: inserted {inserted}")

# ... existing code above ...

async def cleanup_legacy_fields(session: AsyncSession, drop_columns: bool = False):
    """
    After successful data migration, clear legacy JSON fields.
    Optionally drop the columns if drop_columns=True (use with caution).
    """
    # Clear JSON data on Services
    services = (await session.execute(select(Service))).scalars().all()
    for svc in services:
        svc.accounts = []
        svc.credits = {}
    # Clear JSON data on Users
    users = (await session.execute(select(User))).scalars().all()
    for u in users:
        u.services = []
    await session.commit()
    logger.info("Cleared legacy JSON fields on users.services, services.accounts, services.credits")

    if drop_columns:
        # Only enable when your ORM models no longer reference these columns.
        try:
            await session.execute(text("ALTER TABLE services DROP COLUMN accounts"))
            logger.info("Dropped column services.accounts")
        except Exception as e:
            logger.warning(f"Skipping drop services.accounts: {e}")
        try:
            await session.execute(text("ALTER TABLE services DROP COLUMN credits"))
            logger.info("Dropped column services.credits")
        except Exception as e:
            logger.warning(f"Skipping drop services.credits: {e}")
        try:
            await session.execute(text("ALTER TABLE users DROP COLUMN services"))
            logger.info("Dropped column users.services")
        except Exception as e:
            logger.warning(f"Skipping drop users.services: {e}")

async def main():
    logger.info("Starting normalization migration...")
    await ensure_tables()
    # use a dedicated async session
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with async_session() as session:
        await migrate_service_accounts(session)
        await migrate_service_credits(session)
        await migrate_user_subscriptions(session)
        # Set drop_columns=True only after updating ORM models to remove these columns.
        await cleanup_legacy_fields(session, drop_columns=False)
    logger.info("Migration complete.")

if __name__ == "__main__":
    asyncio.run(main())