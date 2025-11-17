from schemas.user_schema import User, SubscriptionPurchase
from config import config
from db.session import get_or_use_session
from core.config import settings
from db.mongodb import get_mongo_db
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
from services.referral_service import check_and_award_referral_credit
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import time
from utils.timing import timeit
from sqlalchemy.exc import IntegrityError, DBAPIError
from utils.db import safe_commit

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
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                return {"services": []}
            # Prefetch current user's subscriptions to compute user_end_date per service
            user_end_by_service: dict[str, str] = {}
            if current_user and getattr(current_user, "username", None):
                subs = await mdb.subscriptions.find({"username": current_user.username}).to_list(length=1000)
                # keep latest end_date per service_name
                for s in subs:
                    svc_name = s.get("service_name", "")
                    end_s = s.get("end_date")
                    if not svc_name or not end_s:
                        continue
                    try:
                        end_dt = parse_date(end_s)
                    except Exception:
                        # fallback: if no existing value, set raw string
                        if svc_name not in user_end_by_service:
                            user_end_by_service[svc_name] = end_s
                        continue
                    prev_s = user_end_by_service.get(svc_name)
                    if not prev_s:
                        user_end_by_service[svc_name] = end_dt.strftime("%d/%m/%Y")
                    else:
                        try:
                            prev_dt = parse_date(prev_s)
                            if end_dt > prev_dt:
                                user_end_by_service[svc_name] = end_dt.strftime("%d/%m/%Y")
                        except Exception:
                            user_end_by_service[svc_name] = end_dt.strftime("%d/%m/%Y")

            docs = await mdb.services.find({}, {"_id": 0, "name": 1, "image": 1, "accounts": 1, "credits": 1}).to_list(length=1000)
            services = []
            for svc in docs:
                accounts = svc.get("accounts") or []
                available_accounts = 0
                # Count only active accounts for availability
                for a in accounts:
                    if (a or {}).get("is_active", True):
                        available_accounts += 1
                
                # Filter out 7days from credits if it exists
                credits = svc.get("credits", {})
                if isinstance(credits, dict):
                    credits = {k: v for k, v in credits.items() if k != "7days"}
                
                services.append({
                    "name": svc.get("name", ""),
                    "image": svc.get("image", ""),
                    "available_accounts": available_accounts,
                    "total_accounts": len(accounts),
                    "available": available_accounts > 0,
                    "credits": credits,
                    "user_end_date": user_end_by_service.get(svc.get("name", ""), ""),
                })
            return {"services": services}
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
                # Use pre-grouped accounts (already filtered by is_active == True)
                sa_rows = accounts_by_service.get(service.id, [])
                available_accounts_count = len(sa_rows)
                
                # Get total accounts (active and inactive)
                all_accounts = (await _db.execute(select(ServiceAccount).where(ServiceAccount.service_id == service.id))).scalars().all()
                
                # Filter out 7days from credits if it exists
                service_credits = credits_by_service.get(service.id, {})
                if isinstance(service_credits, dict):
                    service_credits = {k: v for k, v in service_credits.items() if k != "7days"}
                
                user_end_date = latest_user_end_by_service.get(service.id, "")
                services.append({
                    "name": service.name,
                    "image": service.image,
                    "available_accounts": available_accounts_count,  # Count of active accounts
                    "total_accounts": len(all_accounts),  # Total accounts (active + inactive)
                    "available": available_accounts_count > 0,
                    # use batched credits map per service (without 7days)
                    "credits": service_credits,
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
    if settings.USE_MONGO:
        # MongoDB implementation
        try:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            
            from datetime import datetime, timedelta
            
            # Helper for date formatting
            def to_date(d: datetime) -> str:
                return d.strftime("%d/%m/%Y")
            
            def _parse_date(date_string: str):
                try:
                    return datetime.strptime(date_string, "%d/%m/%Y")
                except ValueError:
                    return datetime.strptime(date_string, "%Y-%m-%d")
            
            # Get user
            user = await mdb.users.find_one({"username": current_user.username})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get subscription duration config
            subscription_durations = config.get_subscription_durations()
            duration_config = subscription_durations.get(request.duration)
            if not duration_config:
                raise HTTPException(status_code=400, detail="Invalid subscription duration")
            
            requested_days = int(duration_config.get("days", 0))
            
            # Get service
            service_doc = await mdb.services.find_one({"name": request.service_name})
            if not service_doc:
                raise HTTPException(status_code=404, detail="Service not found")
            
            # Get credits cost
            svc_credits_map = service_doc.get("credits", {}) or {}
            try:
                cost_to_deduct = int(svc_credits_map.get(request.duration, duration_config.get("credits_cost", 0)))
            except Exception:
                cost_to_deduct = int(duration_config.get("credits_cost", 0))
            
            # Check credits
            current_credits = int(user.get("credits", 0))
            if current_credits < cost_to_deduct:
                raise HTTPException(status_code=400, detail="Insufficient credits")
            
            # Get available accounts
            accounts = service_doc.get("accounts", []) or []
            available_accounts = [acc for acc in accounts if (acc or {}).get("is_active", True)]
            if not available_accounts:
                raise HTTPException(status_code=400, detail="No available accounts for this service")
            
            today_dt = datetime.now()
            today_d = today_dt.date()
            today_str = to_date(today_dt)
            
            # Find existing subscription for this service (active or inactive) - extend if exists
            existing_subscription = await mdb.subscriptions.find_one({
                "username": current_user.username,
                "service_name": request.service_name
            })
            
            assigned_account = None
            account_id = None
            result = None
            is_extension = False
            
            if existing_subscription:
                # Extend existing subscription
                is_extension = True
                # Try to use the same account if it still exists
                if existing_subscription.get("account_id"):
                    account_id = existing_subscription.get("account_id")
                    for acc in available_accounts:
                        if (acc or {}).get("account_id") == account_id:
                            assigned_account = acc
                            break
                
                # If account not found or not assigned, pick any available account
                if not assigned_account:
                    if not available_accounts:
                        raise HTTPException(status_code=400, detail="No available accounts for this service")
                    assigned_account = available_accounts[0]
                    account_id = assigned_account.get("account_id")
                
                # Extend existing subscription - base date = max(existing end, today)
                try:
                    exist_end_dt = _parse_date(existing_subscription.get("end_date")) if existing_subscription.get("end_date") else today_dt
                except Exception:
                    exist_end_dt = today_dt
                base_dt = exist_end_dt if exist_end_dt > today_dt else today_dt
                new_end_dt = base_dt + timedelta(days=requested_days)
                new_end_str = to_date(new_end_dt)
                
                # Update existing subscription
                await mdb.subscriptions.update_one(
                    {"_id": existing_subscription.get("_id")},
                    {"$set": {
                        "end_date": new_end_str,
                        "account_id": account_id,
                        "is_active": True,  # Reactivate if it was inactive
                        "duration_key": request.duration,
                    }, "$inc": {"total_duration_days": int(requested_days)}}
                )
            else:
                # Create new subscription - pick any available account
                if not available_accounts:
                    raise HTTPException(status_code=400, detail="No available accounts for this service")
                assigned_account = available_accounts[0]
                account_id = assigned_account.get("account_id")
                
                proposed_end_dt = today_dt + timedelta(days=requested_days)
                new_end_str = to_date(proposed_end_dt)
                
                # Create new subscription
                new_sub = {
                    "username": current_user.username,
                    "service_name": request.service_name,
                    "account_id": account_id,
                    "start_date": today_str,
                    "end_date": new_end_str,
                    "is_active": True,
                    "duration_key": request.duration,
                    "total_duration_days": requested_days,
                }
                result = await mdb.subscriptions.insert_one(new_sub)
            
            # Deduct credits
            await mdb.users.update_one(
                {"username": current_user.username},
                {"$inc": {"credits": -int(cost_to_deduct)}}
            )
            
            # Check and award referral credit if this is user's first subscription (only for new subscriptions)
            if result:
                user_doc = await mdb.users.find_one({"username": current_user.username})
                if user_doc:
                    await check_and_award_referral_credit(user_doc.get("_id"), str(result.inserted_id), None)
            
            # Get updated credits
            updated_user = await mdb.users.find_one({"username": current_user.username})
            updated_credits = int(updated_user.get("credits", 0)) if updated_user else (current_credits - cost_to_deduct)
            
            return {
                "message": f"{'Extended' if is_extension else 'Purchased'} {duration_config.get('name', request.duration)} for {request.service_name}",
                "extension": is_extension,
                "new_end_date": new_end_str,
                "credits": updated_credits,
                "cost": cost_to_deduct,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error purchasing subscription (Mongo): {e}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
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
            # Find existing subscription for this service (active or inactive) - extend if exists
            existing_subscription = (await _db.execute(
                select(UserSubscription).where(
                    UserSubscription.user_id == user.id,
                    UserSubscription.service_id == service_data.id
                )
            )).scalars().first()
            
            assigned_account = None
            is_extension = False
            
            if existing_subscription:
                # Extend existing subscription
                is_extension = True
                # Try to use the same account if it still exists
                if existing_subscription.account_id:
                    for acc in available_accounts:
                        if acc.id == existing_subscription.account_id:
                            assigned_account = acc
                            break
                
                # If account not found or not assigned, pick any available account
                if not assigned_account:
                    if not available_accounts:
                        raise HTTPException(status_code=400, detail="No available accounts for this service")
                    assigned_account = available_accounts[0]
                
                # Extend existing subscription - base date = max(existing end, today)
                current_end_d = existing_subscription.end_date
                base_d = current_end_d if current_end_d and current_end_d > today.date() else today.date()
                new_end_date = datetime.combine(base_d, datetime.min.time()) + timedelta(days=requested_days)
                
                # Update existing subscription
                existing_subscription.end_date = new_end_date.date()
                existing_subscription.account_id = assigned_account.id
                existing_subscription.is_active = True  # Reactivate if it was inactive
                existing_subscription.duration_key = request.duration
                existing_subscription.total_duration_days = (existing_subscription.total_duration_days or 0) + requested_days
                us = existing_subscription
            else:
                # Create new subscription - pick any available account
                if not available_accounts:
                    raise HTTPException(status_code=400, detail="No available accounts for this service")
                assigned_account = available_accounts[0]
                
                new_end_date = today + timedelta(days=requested_days)
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
            await safe_commit(_db, client_error_message="Invalid subscription request", server_error_message="Internal server error")
            
            # Check and award referral credit if this is user's first subscription (only for new subscriptions)
            if not is_extension:
                await check_and_award_referral_credit(user.id, us.id, _db)
            
            updated_credits = user.credits or 0
            return {
                "message": f"{'Extended' if is_extension else 'Purchased'} {duration_config.get('name', request.duration)} for {request.service_name}",
                "extension": is_extension,
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
    if settings.USE_MONGO:
        mdb = get_mongo_db()
        if mdb is None:
            return {"subscriptions": []}
        subs = await mdb.subscriptions.find({"username": current_user.username}).to_list(length=1000)
        # Compute user's latest subscription end date per service and active flag per service
        user_end_by_service: dict[str, str] = {}
        user_active_by_service: dict[str, bool] = {}
        now_dt = datetime.now()
        for s in subs:
            svc_name = s.get("service_name", "")
            if not svc_name:
                continue
            end_s = s.get("end_date") or ""
            # track active flag based on end date (>= today)
            try:
                if end_s:
                    end_dt = parse_date(end_s)
                    if end_dt >= now_dt:
                        user_active_by_service[svc_name] = True
            except Exception:
                pass
            # track latest end date (string compare via parsed date)
            if end_s:
                try:
                    end_dt = parse_date(end_s)
                except Exception:
                    # if cannot parse, set if not present
                    if svc_name not in user_end_by_service:
                        user_end_by_service[svc_name] = end_s
                    continue
                prev_s = user_end_by_service.get(svc_name)
                if not prev_s:
                    user_end_by_service[svc_name] = end_dt.strftime("%d/%m/%Y")
                else:
                    try:
                        prev_dt = parse_date(prev_s)
                        if end_dt > prev_dt:
                            user_end_by_service[svc_name] = end_dt.strftime("%d/%m/%Y")
                    except Exception:
                        user_end_by_service[svc_name] = end_dt.strftime("%d/%m/%Y")
        service_names = sorted({s.get("service_name", "") for s in subs if s.get("service_name")})
        grouped: dict[str, dict] = {}
        today_dt = datetime.now()
        for svc_name in service_names:
            svc = await mdb.services.find_one({"name": svc_name}, {"image": 1, "accounts": 1})
            accounts = (svc or {}).get("accounts") or []
            # Determine inclusion and whether to show credentials
            user_end = user_end_by_service.get(svc_name, "")
            user_active = bool(user_active_by_service.get(svc_name, False))
            # Map all service accounts, using user's subscription end_date and is_active (not account's own dates)
            mapped_accounts = []
            for a in accounts:
                acc_id = (a or {}).get("account_id", "")
                pw = (a or {}).get("password_hash", "")
                # Use user's subscription end_date and is_active, not account's own dates
                mapped_accounts.append({
                    "account_id": acc_id,
                    **({"account_password": pw} if pw else {}),
                    "end_date": user_end,  # User's subscription end_date
                    "is_active": user_active,  # User's subscription is_active
                })
            include_service = True
            show_credentials = user_active
            if not user_active and user_end:
                try:
                    end_dt = parse_date(user_end)
                    days_since = (today_dt - end_dt).days
                    if days_since > 7:
                        include_service = False
                except Exception:
                    pass
            if not include_service:
                continue
            grouped[svc_name] = {
                "service_name": svc_name,
                "service_image": (svc or {}).get("image", ""),
                # end_date should be user's subscription end date
                "end_date": user_end_by_service.get(svc_name, ""),
                # is_active should reflect user's subscription activity
                "is_active": user_active,
                "accounts": mapped_accounts if show_credentials else [],
            }
        return {"subscriptions": list(grouped.values())}
    
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
            # Determine all services the user subscribed to
            service_ids = sorted({s.service_id for s in subs_rows})
            # Compute user's latest subscription end date per service and active flag per service
            user_end_by_service: dict[int, str] = {}
            user_active_by_service: dict[int, bool] = {}
            for s in subs_rows:
                if s.is_active:
                    # fallback to end_date check regardless of stored flag
                    pass
                if s.end_date:
                    try:
                        prev = user_end_by_service.get(s.service_id)
                        if not prev:
                            user_end_by_service[s.service_id] = s.end_date.strftime("%d/%m/%Y")
                        else:
                            # compare parsed dates
                            from datetime import datetime as _dt
                            def _parse(d: str):
                                try:
                                    return _dt.strptime(d, "%d/%m/%Y")
                                except Exception:
                                    return _dt.strptime(d, "%Y-%m-%d")
                            if s.end_date > _parse(prev):
                                user_end_by_service[s.service_id] = s.end_date.strftime("%d/%m/%Y")
                    except Exception:
                        user_end_by_service[s.service_id] = s.end_date.strftime("%d/%m/%Y")
            # recompute active flag purely from end_date >= today
            try:
                today_d = datetime.now().date()
                for s in subs_rows:
                    if s.end_date and s.end_date >= today_d:
                        user_active_by_service[s.service_id] = True
            except Exception:
                pass
            # Load ALL active accounts for those services
            accounts_by_service: dict[int, list[ServiceAccount]] = {}
            if service_ids:
                acc_rows_all = (await _db.execute(select(ServiceAccount).where(ServiceAccount.service_id.in_(service_ids), ServiceAccount.is_active == True))).scalars().all()
                for acc in acc_rows_all:
                    accounts_by_service.setdefault(acc.service_id, []).append(acc)
            durations_map = config.get_subscription_durations()
            grouped: dict[int, dict] = {}
            today_dt = datetime.now()
            for svc_id in service_ids:
                svc = services_by_id.get(svc_id)
                service_name = svc.name if svc else "Unknown Service"
                service_image = svc.image if svc else "https://via.placeholder.com/300x200/6B7280/FFFFFF?text=Service"
                # Determine inclusion and whether to show credentials
                user_end = user_end_by_service.get(svc_id, "")
                user_active = bool(user_active_by_service.get(svc_id, False))
                accs = accounts_by_service.get(svc_id, [])
                mapped_accounts = []
                for acc in accs:
                    # Use user's subscription end_date and is_active, not account's own dates
                    mapped_accounts.append({
                        "account_id": acc.account_id,
                        **({"account_password": acc.password_hash} if acc.password_hash else {}),
                        "end_date": user_end,  # User's subscription end_date
                        "is_active": user_active,  # User's subscription is_active
                    })
                include_service = True
                show_credentials = user_active
                if not user_active and user_end:
                    try:
                        end_dt = parse_date(user_end)
                        days_since = (today_dt - end_dt).days
                        if days_since > 7:
                            include_service = False
                    except Exception:
                        pass
                if not include_service:
                    continue
                grouped[svc_id] = {
                    "service_name": service_name,
                    "service_image": service_image,
                    # end_date should be user's subscription end date
                    "end_date": user_end_by_service.get(svc_id, ""),
                    # is_active should reflect user's subscription activity
                    "is_active": user_active,
                    "accounts": mapped_accounts if show_credentials else [],
                }
            return {"subscriptions": list(grouped.values())}
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
        if settings.USE_MONGO:
            # Validate against Mongo refresh_tokens
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            doc = await mdb.refresh_tokens.find_one({"token": refresh_token})
            if not doc:
                raise HTTPException(status_code=401, detail="Invalid refresh token")
            username = doc.get("username", "")
            # Try to enrich from users collection
            user_doc = await mdb.users.find_one({"username": username})
            if not user_doc:
                raise HTTPException(status_code=401, detail="Invalid refresh token")
            access_token = create_access_token(
                data={"sub": user_doc.get("username"), "email": user_doc.get("email"), "user_id": (user_doc.get("user_id") or user_doc.get("username")), "role": user_doc.get("role", "user")},
                expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            )
            return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token}
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
