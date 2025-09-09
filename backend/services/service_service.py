from schemas.user_schema import User, SubscriptionPurchase
from config import config
from db.session import get_or_use_session
from db.models.user import User as UserModel
from db.models.service import Service as ServiceModel, ServiceAccount
from db.models.subscription import ServiceDurationCredit, UserSubscription
from db.models.refresh_token import RefreshToken
from core.security import create_access_token
from core.config import settings
from fastapi import HTTPException
from datetime import timedelta, datetime, date, time as dt_time
import logging
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import time
from utils.timing import timeit

_services_cache = {"data": None, "ts": 0.0}
_user_services_cache: dict[str, dict] = {}
_SERVICES_TTL_SECONDS = 30.0

logger = logging.getLogger(__name__)

def parse_date(date_string: str) -> datetime:
    """Parse date string in dd/mm/yyyy format"""
    try:
        return datetime.strptime(date_string, "%d/%m/%Y")
    except ValueError:
        return datetime.strptime(date_string, "%Y-%m-%d")

def format_date(date_obj: datetime) -> str:
    return date_obj.strftime("%d/%m/%Y")

async def get_services(current_user: User = None, db: AsyncSession  = None):
    try:
        # TTL cache for anonymous or when current_user not used
        now = time.time()
        if (not current_user or not getattr(current_user, "username", None)) and _services_cache["data"] and (now - _services_cache["ts"]) < _SERVICES_TTL_SECONDS:
            return _services_cache["data"]
        # Per-user TTL cache for service view
        cache_key = None
        if current_user and getattr(current_user, "username", None):
            cache_key = f"svc:{current_user.username}"
            cached = _user_services_cache.get(cache_key)
            if cached and (now - cached.get("ts", 0.0)) < _SERVICES_TTL_SECONDS:
                return cached["data"]
        services = []
        today = datetime.now()
        async with get_or_use_session(db) as _db:
            user_record = None
            if current_user and getattr(current_user, "username", None):
                try:
                    result = await _db.execute(select(UserModel).where(UserModel.username == current_user.username))
                    user_record = result.scalars().first()
                except Exception:
                    user_record = None
            result = await _db.execute(select(ServiceModel))
            service_rows = result.scalars().all()
            service_ids = [s.id for s in service_rows]
            # Batch fetch active accounts for all services on this page
            acc_rows = []
            if service_ids:
                acc_rows = (await _db.execute(select(ServiceAccount).where(ServiceAccount.service_id.in_(service_ids), ServiceAccount.is_active == True))).scalars().all()
            accounts_by_service: dict[int, list[ServiceAccount]] = {}
            for sa in acc_rows:
                accounts_by_service.setdefault(sa.service_id, []).append(sa)
            # Batch fetch credits for all services
            credits_by_service: dict[int, dict[str, int]] = {}
            if service_ids:
                sdc_rows = (await _db.execute(select(ServiceDurationCredit).where(ServiceDurationCredit.service_id.in_(service_ids)))).scalars().all()
                for row in sdc_rows:
                    svc_map = credits_by_service.setdefault(row.service_id, {})
                    try:
                        svc_map[row.duration_key] = int(row.credits)
                    except Exception:
                        svc_map[row.duration_key] = 0
            # Batch fetch user subscriptions for all services for this user
            latest_user_end_by_service: dict[int, str] = {}
            if user_record and service_ids:
                subs_rows = (await _db.execute(select(UserSubscription).where(UserSubscription.user_id == user_record.id, UserSubscription.service_id.in_(service_ids)))).scalars().all()
                latest_by_service: dict[int, datetime] = {}
                for sub in subs_rows:
                    if sub.end_date:
                        prev = latest_by_service.get(sub.service_id)
                        if not prev or sub.end_date > prev:
                            latest_by_service[sub.service_id] = sub.end_date
                for svc_id, dt_val in latest_by_service.items():
                    try:
                        latest_user_end_by_service[svc_id] = dt_val.strftime("%d/%m/%Y")
                    except Exception:
                        pass
            for service in service_rows:
                available_accounts = []
                max_days_until_expiry = 0
                max_end_date = ""
                # Use pre-grouped accounts
                sa_rows = accounts_by_service.get(service.id, [])
                for sa in sa_rows:
                    end_dt = sa.end_date
                    if not end_dt:
                        continue
                    # Normalize to datetime for arithmetic
                    if isinstance(end_dt, date) and not isinstance(end_dt, datetime):
                        end_dt_dt = datetime.combine(end_dt, dt_time.min)
                    else:
                        end_dt_dt = end_dt
                    days_until_expiry = (end_dt_dt - today).days
                    if days_until_expiry > max_days_until_expiry:
                        max_days_until_expiry = days_until_expiry
                        max_end_date = (end_dt_dt).strftime("%d/%m/%Y")
                    available_accounts.append({
                        "id": sa.account_id,
                        "days_until_expiry": days_until_expiry,
                        "end_date": (end_dt_dt).strftime("%d/%m/%Y"),
                    })
                user_end_date = latest_user_end_by_service.get(service.id, "")
                services.append({
                    "name": service.name,
                    "image": service.image,
                    "available_accounts": len(available_accounts),
                    "total_accounts": len(sa_rows),
                    "max_days_until_expiry": max_days_until_expiry,
                    "max_end_date": max_end_date,
                    # use batched credits map per service
                    "credits": credits_by_service.get(service.id, {}),
                    "user_end_date": user_end_date,
                })
        resp = {"services": services}
        if not current_user or not getattr(current_user, "username", None):
            _services_cache["data"] = resp
            _services_cache["ts"] = now
        elif cache_key:
            _user_services_cache[cache_key] = {"data": resp, "ts": now}
        return resp
    except Exception as e:
        logger.error(f"Error getting services: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def purchase_subscription(request: SubscriptionPurchase, current_user: User, db: AsyncSession  = None):
    async with get_or_use_session(db) as _db:
        try:
            result = await _db.execute(select(UserModel).where(UserModel.username == current_user.username))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            subscription_durations = config.get_subscription_durations()
            duration_config = subscription_durations.get(request.duration)
            if not duration_config:
                raise HTTPException(status_code=400, detail="Invalid subscription duration")
            requested_days = int(duration_config.get("days", 0))
            result = await _db.execute(select(ServiceModel).where(ServiceModel.name == request.service_name))
            service_data = result.scalars().first()
            if not service_data:
                raise HTTPException(status_code=404, detail="Service not found")
            # credits from normalized table
            credits_q = await _db.execute(select(ServiceDurationCredit).where(ServiceDurationCredit.service_id == service_data.id))
            service_credits_map = {row.duration_key: row.credits for row in credits_q.scalars().all()}
            try:
                cost_to_deduct = int(service_credits_map.get(request.duration, duration_config.get("credits_cost", 0)))
            except Exception:
                cost_to_deduct = int(duration_config.get("credits_cost", 0))
            current_credits = user.credits or 0
            if current_credits < cost_to_deduct:
                raise HTTPException(status_code=400, detail="Insufficient credits")
            # active accounts from normalized table
            available_accounts = (await _db.execute(select(ServiceAccount).where(ServiceAccount.service_id == service_data.id, ServiceAccount.is_active == True))).scalars().all()
            if not available_accounts:
                raise HTTPException(status_code=400, detail="No available accounts for this service")
            today = datetime.now()
            # Find existing subscription from normalized table
            existing_subscription = (await _db.execute(
                select(UserSubscription).where(
                    UserSubscription.user_id == user.id,
                    UserSubscription.service_id == service_data.id,
                    UserSubscription.is_active == True
                )
            )).scalars().first()
            assigned_account = None
            if existing_subscription and existing_subscription.account_id:
                for acc in available_accounts:
                    if acc.id == existing_subscription.account_id:
                        assigned_account = acc
                        break
            if not assigned_account:
                max_available_days = 0
                for account in available_accounts:
                    acc_end = account.end_date
                    if not acc_end:
                        continue
                    if isinstance(acc_end, date) and not isinstance(acc_end, datetime):
                        acc_end_dt = datetime.combine(acc_end, dt_time.min)
                    else:
                        acc_end_dt = acc_end
                    days_until_expiry = (acc_end_dt - today).days
                    if days_until_expiry >= requested_days and days_until_expiry > max_available_days:
                        max_available_days = days_until_expiry
                        assigned_account = account
                if not assigned_account:
                    raise HTTPException(status_code=400, detail="No account can satisfy requested duration")
            acc_end_date = assigned_account.end_date
            if isinstance(acc_end_date, date) and not isinstance(acc_end_date, datetime):
                acc_end_date = datetime.combine(acc_end_date, dt_time.min)
            if not acc_end_date:
                raise HTTPException(status_code=400, detail="Invalid service account end date")
            if existing_subscription:
                current_end = existing_subscription.end_date
                if isinstance(current_end, date) and not isinstance(current_end, datetime):
                    current_end = datetime.combine(current_end, dt_time.min)
                base_date = current_end if current_end and current_end > today else today
                proposed_end = base_date + timedelta(days=requested_days)
                if proposed_end > acc_end_date:
                    # Try to reassign to another account that can satisfy the proposed end date
                    reassigned = False
                    for acc in available_accounts:
                        acc_end = acc.end_date
                        if isinstance(acc_end, date) and not isinstance(acc_end, datetime):
                            acc_end_dt = datetime.combine(acc_end, dt_time.min)
                        else:
                            acc_end_dt = acc_end
                        if acc_end_dt and acc_end_dt >= proposed_end:
                            assigned_account = acc
                            reassigned = True
                            break
                    if not reassigned:
                        raise HTTPException(status_code=400, detail="No account can satisfy requested extension")
                # update existing normalized subscription
                existing_subscription.end_date = proposed_end.date()
                existing_subscription.account_id = assigned_account.id
                existing_subscription.duration_key = request.duration
                existing_subscription.total_duration_days = (existing_subscription.total_duration_days or 0) + requested_days
                # deduct credits from user
                if (user.credits or 0) < cost_to_deduct:
                    raise HTTPException(status_code=400, detail="Insufficient credits")
                user.credits = (user.credits or 0) - cost_to_deduct
                await _db.commit()
                updated_credits = user.credits or 0
                new_end_date_str = format_date(proposed_end)
                return {
                    "message": f"Extended {request.service_name} by {duration_config.get('name', request.duration)}",
                    "extension": True,
                    "new_end_date": new_end_date_str,
                    "credits": updated_credits,
                    "cost": cost_to_deduct,
                }
            else:
                new_end_date = today + timedelta(days=requested_days)
                if new_end_date > acc_end_date:
                    raise HTTPException(status_code=400, detail="Requested duration exceeds account expiry")
                # create new normalized subscription
                us = UserSubscription(
                    user_id=user.id,
                    service_id=service_data.id,
                    account_id=assigned_account.id,
                    start_date=today.date(),
                    end_date=new_end_date.date(),
                    is_active=True,
                    duration_key=request.duration,
                    total_duration_days=requested_days,
                )
                _db.add(us)
                if (user.credits or 0) < cost_to_deduct:
                    raise HTTPException(status_code=400, detail="Insufficient credits")
                user.credits = (user.credits or 0) - cost_to_deduct
                await _db.commit()
                updated_credits = user.credits or 0
                return {
                    "message": f"Purchased {duration_config.get('name', request.duration)} for {request.service_name}",
                    "extension": False,
                    "new_end_date": format_date(new_end_date),
                    "credits": updated_credits,
                    "cost": cost_to_deduct,
                }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error purchasing subscription: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")
        finally:
            if db is None:
                await _db.close()

@timeit("get_user_subscriptions")
async def get_user_subscriptions(current_user: User, db: AsyncSession  = None):
    
    async with get_or_use_session(db) as _db:
        try:
            result = await _db.execute(select(UserModel).where(UserModel.username == current_user.username))
            user_record = result.scalars().first()
            if not user_record:
                raise HTTPException(status_code=404, detail="User not found")
            # Build subscriptions from normalized table
            service_list = (await _db.execute(select(ServiceModel))).scalars().all()
            services_by_id = {s.id: s for s in service_list}
            subs_rows = (await _db.execute(select(UserSubscription).where(UserSubscription.user_id == user_record.id))).scalars().all()
            # Preload accounts for these subscriptions
            account_fk_ids = [s.account_id for s in subs_rows if s.account_id]
            accounts_by_id = {}
            if account_fk_ids:
                acc_rows = (await _db.execute(select(ServiceAccount).where(ServiceAccount.id.in_(account_fk_ids)))).scalars().all()
                accounts_by_id = {a.id: a for a in acc_rows}
            durations_map = config.get_subscription_durations()
            subscriptions = []
            for sub in subs_rows:
                svc = services_by_id.get(sub.service_id)
                service_name = svc.name if svc else "Unknown Service"
                service_image = svc.image if svc else "https://via.placeholder.com/300x200/6B7280/FFFFFF?text=Service"
                total_duration_days = sub.total_duration_days or 0
                if not total_duration_days and sub.start_date and sub.end_date:
                    total_duration_days = max(0, (sub.end_date - sub.start_date).days)
                is_active_flag = bool(sub.is_active)
                end_date_str = sub.end_date.strftime("%d/%m/%Y") if sub.end_date else ""
                acc = accounts_by_id.get(sub.account_id) if sub.account_id else None
                acct_display_id = acc.account_id if acc else None
                acct_username = acc.account_id if acc else ""
                acct_password = acc.password_hash if acc else ""
                subscriptions.append({
                    "service_name": service_name,
                    "service_image": service_image,
                    **({"account_id": acct_display_id} if is_active_flag and acct_display_id else {}),
                    **({"account_username": acct_username} if is_active_flag else {}),
                    **({"account_password": acct_password} if is_active_flag else {}),
                    "end_date": end_date_str,
                    "is_active": is_active_flag,
                    "duration": sub.duration_key or "",
                    "total_duration": total_duration_days,
                    "created_date": sub.start_date.strftime("%d/%m/%Y") if sub.start_date else "",
                    "last_extension": "",
                    "extension_duration": "",
                })
            return {"subscriptions": subscriptions}
        except Exception as e:
            logger.error(f"Error getting user subscriptions: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")
        finally:
            if db is None:
                await _db.close()

async def refresh_access_token(request: dict, db: AsyncSession  = None):
    try:
        refresh_token = request.get("refresh_token")
        if not refresh_token:
            raise HTTPException(status_code=400, detail="Refresh token required")
        # Try with provided session; if it fails due to transport, retry with a new session
        user = None
        try:
            async with get_or_use_session(db) as _db:
                result = await _db.execute(select(RefreshToken).where(RefreshToken.token == refresh_token))
                token_doc = result.scalars().first()
                if not token_doc:
                    raise HTTPException(status_code=401, detail="Invalid refresh token")
                username = token_doc.username
                result = await _db.execute(select(UserModel).where(UserModel.username == username))
                user = result.scalars().first()
        except Exception as e:
            logger.warning(f"refresh_access_token: first attempt failed ({e}); retrying with fresh session")
            from db.session import SessionLocal
            async with SessionLocal() as _db:
                result = await _db.execute(select(RefreshToken).where(RefreshToken.token == refresh_token))
                token_doc = result.scalars().first()
                if not token_doc:
                    raise HTTPException(status_code=401, detail="Invalid refresh token")
                username = token_doc.username
                result = await _db.execute(select(UserModel).where(UserModel.username == username))
                user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        access_token = create_access_token(
            data={"sub": user.username, "email": user.email, "user_id": (user.user_id or user.username), "role": user.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token}
    except Exception as e:
        logger.error(f"Error refreshing access token: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 
