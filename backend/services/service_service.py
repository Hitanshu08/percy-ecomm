from schemas.user_schema import User, SubscriptionPurchase
from config import config
from db.session import SessionLocal
from db.models.user import User as UserModel
from db.models.service import Service as ServiceModel
from db.models.refresh_token import RefreshToken
from core.security import create_access_token
from core.config import settings
from fastapi import HTTPException
from datetime import timedelta, datetime
import logging
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import time

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
        async with (db or SessionLocal()) as _db:
            user_record = None
            if current_user and getattr(current_user, "username", None):
                try:
                    result = await _db.execute(select(UserModel).where(UserModel.username == current_user.username))
                    user_record = result.scalars().first()
                except Exception:
                    user_record = None
            result = await _db.execute(select(ServiceModel))
            service_rows = result.scalars().all()
            for service in service_rows:
                available_accounts = []
                max_days_until_expiry = 0
                max_end_date = ""
                for account in (service.accounts or []):
                    if account.get("is_active"):
                        end_date = parse_date(account["end_date"]) if isinstance(account.get("end_date"), str) else account.get("end_date")
                        days_until_expiry = (end_date - today).days
                        if days_until_expiry > max_days_until_expiry:
                            max_days_until_expiry = days_until_expiry
                            max_end_date = account["end_date"]
                        available_accounts.append({
                            "id": account["id"],
                            "days_until_expiry": days_until_expiry,
                            "end_date": account["end_date"]
                        })
                user_end_date = ""
                if user_record and isinstance(user_record.services, list):
                    matched = None
                    for sub in user_record.services:
                        if sub.get("service_name") == service.name:
                            matched = sub
                            break
                    if not matched:
                        service_account_ids = set(acc.get("id") for acc in (service.accounts or []))
                        for sub in user_record.services:
                            sid = sub.get("service_id") or sub.get("account_id")
                            if sid in service_account_ids:
                                matched = sub
                                break
                    if matched:
                        user_end_date = matched.get("end_date", "")
                services.append({
                    "name": service.name,
                    "image": service.image,
                    "available_accounts": len(available_accounts),
                    "total_accounts": len(service.accounts or []),
                    "max_days_until_expiry": max_days_until_expiry,
                    "max_end_date": max_end_date,
                    "credits": service.credits or {},
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
    _db = db or SessionLocal()
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
        service_credits_map = service_data.credits or {}
        try:
            cost_to_deduct = int(service_credits_map.get(request.duration, duration_config.get("credits_cost", 0)))
        except Exception:
            cost_to_deduct = int(duration_config.get("credits_cost", 0))
        current_credits = user.credits or 0
        if current_credits < cost_to_deduct:
            raise HTTPException(status_code=400, detail="Insufficient credits")
        available_accounts = [acc for acc in (service_data.accounts or []) if acc.get("is_active")]
        if not available_accounts:
            raise HTTPException(status_code=400, detail="No available accounts for this service")
        today = datetime.now()
        existing_subscription = None
        if user.services:
            for sub in user.services:
                if sub.get("service_name") == request.service_name:
                    existing_subscription = sub
                    break
            if existing_subscription is None:
                # Fallback: match any subscription tied to this service's accounts
                service_account_ids = set(acc.get("id") for acc in available_accounts)
                for sub in user.services:
                    sid = sub.get("service_id") or sub.get("account_id")
                    if sid in service_account_ids:
                        existing_subscription = sub
                        break
        assigned_account = None
        if existing_subscription and existing_subscription.get("account_id"):
            for acc in available_accounts:
                if acc.get("id") == existing_subscription.get("account_id"):
                    assigned_account = acc
                    break
        if not assigned_account:
            max_available_days = 0
            for account in available_accounts:
                acc_end = parse_date(account["end_date"]) if isinstance(account.get("end_date"), str) else account.get("end_date")
                if not acc_end:
                    continue
                days_until_expiry = (acc_end - today).days
                if days_until_expiry >= requested_days and days_until_expiry > max_available_days:
                    max_available_days = days_until_expiry
                    assigned_account = account
            if not assigned_account:
                raise HTTPException(status_code=400, detail="No account can satisfy requested duration")
        acc_end_date = parse_date(assigned_account["end_date"]) if isinstance(assigned_account.get("end_date"), str) else assigned_account.get("end_date")
        if not acc_end_date:
            raise HTTPException(status_code=400, detail="Invalid service account end date")
        if existing_subscription:
            current_end = parse_date(existing_subscription["end_date"]) if isinstance(existing_subscription.get("end_date"), str) else existing_subscription.get("end_date")
            base_date = current_end if current_end and current_end > today else today
            proposed_end = base_date + timedelta(days=requested_days)
            if proposed_end > acc_end_date:
                # Try to reassign to another account that can satisfy the proposed end date
                reassigned = False
                for acc in available_accounts:
                    acc_end = parse_date(acc["end_date"]) if isinstance(acc.get("end_date"), str) else acc.get("end_date")
                    if acc_end and acc_end >= proposed_end:
                        assigned_account = acc
                        reassigned = True
                        break
                if not reassigned:
                    raise HTTPException(status_code=400, detail="No account can satisfy requested extension")
            result = await _db.execute(select(UserModel).where(UserModel.username == current_user.username))
            db_user = result.scalars().first()
            for sub in (db_user.services or []):
                if sub.get("service_name") == request.service_name:
                    sub["end_date"] = format_date(proposed_end)
                    # If reassigned, update backing account id
                    if assigned_account and assigned_account.get("id"):
                        sub["service_id"] = assigned_account.get("id")
                        sub["account_id"] = assigned_account.get("id")
                    sub["last_extension"] = format_date(today)
                    sub["extension_duration"] = request.duration
                    sub["total_duration"] = int(sub.get("total_duration", 0)) + requested_days
                    break
            if (db_user.credits or 0) < cost_to_deduct:
                raise HTTPException(status_code=400, detail="Insufficient credits")
            db_user.credits = (db_user.credits or 0) - cost_to_deduct
            flag_modified(db_user, "services")
            await _db.commit()
            updated_credits = db_user.credits or 0
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
            new_subscription = {
                "service_name": request.service_name,
                "service_id": assigned_account["id"],
                "end_date": format_date(new_end_date),
                "is_active": True,
                "duration": request.duration,
                "credits_cost": cost_to_deduct,
                "created_date": format_date(today),
                "account_id": assigned_account["id"],
                "total_duration": requested_days,
                "assignment_date": format_date(today)
            }
            result = await _db.execute(select(UserModel).where(UserModel.username == current_user.username))
            db_user = result.scalars().first()
            current_services = list(db_user.services or [])
            current_services.append(new_subscription)
            db_user.services = current_services
            if (db_user.credits or 0) < cost_to_deduct:
                raise HTTPException(status_code=400, detail="Insufficient credits")
            db_user.credits = (db_user.credits or 0) - cost_to_deduct
            flag_modified(db_user, "services")
            await _db.commit()
            updated_credits = db_user.credits or 0
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

async def get_user_subscriptions(current_user: User, db: AsyncSession  = None):
    
    _db = db or SessionLocal()
    try:
        result = await _db.execute(select(UserModel).where(UserModel.username == current_user.username))
        user_record = result.scalars().first()
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")
        result = await _db.execute(select(ServiceModel))
        service_list = result.scalars().all()
        account_id_to_info = {}
        service_name_to_image = {}
        for svc in service_list:
            service_name_to_image[svc.name] = svc.image
            for acc in (svc.accounts or []):
                acc_id = acc.get("id")
                if acc_id:
                    account_id_to_info[acc_id] = {"service": svc, "account": acc}
        durations_map = config.get_subscription_durations()
        subscriptions = []
        seen_service_ids = set()
        for sub in (user_record.services or []):
            account_id = sub.get("account_id") or sub.get("service_id") or "Unknown"
            sid_key = sub.get("service_id") or account_id
            if sid_key in seen_service_ids:
                continue
            seen_service_ids.add(sid_key)
            resolved = account_id_to_info.get(account_id)
            if resolved:
                svc = resolved["service"]
                acc = resolved["account"]
                service_name = svc.name
                service_image = svc.image
                account_username = acc.get("username", "")
                account_password = acc.get("password", "")
            else:
                service_name = sub.get("service_name", "Unknown Service")
                service_image = service_name_to_image.get(service_name, "https://via.placeholder.com/300x200/6B7280/FFFFFF?text=Service")
                account_username = sub.get("account_username", "")
                account_password = sub.get("account_password", "")
            total_duration_days = 0
            try:
                end_date_str = sub.get("end_date")
                end_date = parse_date(end_date_str) if isinstance(end_date_str, str) else end_date_str
                start_str = sub.get("assignment_date") or sub.get("created_date")
                start_date = parse_date(start_str) if isinstance(start_str, str) else start_str
                if not start_date:
                    duration_key = sub.get("duration")
                    if duration_key and duration_key in durations_map:
                        total_duration_days = int(durations_map[duration_key].get("days", 0))
                    else:
                        total_duration_days = 0
                elif end_date:
                    total_duration_days = max(0, (end_date - start_date).days)
            except Exception:
                total_duration_days = int(sub.get("total_duration", 0) or 0)
            is_active_flag = bool(sub.get("is_active", True))
            try:
                if end_date and (end_date - datetime.now()).days < 0 and is_active_flag:
                    db_upd = _db
                    result = await db_upd.execute(select(UserModel).where(UserModel.username == user_record.username))
                    db_user = result.scalars().first()
                    for s in (db_user.services or []):
                        sid = s.get("service_id") or s.get("account_id")
                        if sid == sid_key:
                            s["is_active"] = False
                            break
                    flag_modified(db_user, "services")
                    await db_upd.commit()
                    is_active_flag = False
            except Exception:
                pass
            subscriptions.append({
                "service_name": service_name,
                "service_image": service_image,
                **({"account_id": account_id} if is_active_flag else {}),
                **({"account_username": account_username} if is_active_flag else {}),
                **({"account_password": account_password} if is_active_flag else {}),
                "end_date": sub.get("end_date"),
                "is_active": is_active_flag,
                "duration": sub.get("duration", ""),
                "total_duration": total_duration_days,
                "created_date": sub.get("created_date", ""),
                "last_extension": sub.get("last_extension", ""),
                "extension_duration": sub.get("extension_duration", "")
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
        async with (db or SessionLocal()) as _db:
            result = await _db.execute(select(RefreshToken).where(RefreshToken.token == refresh_token))
            token_doc = result.scalars().first()
        if not token_doc:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        username = token_doc.username
        async with (db or SessionLocal()) as _db:
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
