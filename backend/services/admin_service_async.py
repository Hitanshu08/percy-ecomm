from schemas.user_schema import AdminAssignSubscription, AdminAddCredits, AdminRemoveCredits, AdminRemoveSubscription, AdminUpdateSubscriptionEndDate, User, AdminUpdateSubscriptionActive
from config import config
from db.session import SessionLocal, get_or_use_session
from db.models.user import User as UserModel
from db.models.service import Service as ServiceModel, ServiceAccount
from db.models.subscription import ServiceDurationCredit, UserSubscription
from fastapi import HTTPException
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select, or_, func
from sqlalchemy.exc import IntegrityError, DBAPIError
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from db.mongodb import get_mongo_db
from utils.db import safe_commit

logger = logging.getLogger(__name__)

def _parse_date(date_string: str):
    from datetime import datetime
    try:
        return datetime.strptime(date_string, "%d/%m/%Y")
    except ValueError:
        return datetime.strptime(date_string, "%Y-%m-%d")

def _format_date(date_obj):
    return date_obj.strftime("%d/%m/%Y")

async def assign_subscription(request: AdminAssignSubscription, current_user: User, db: AsyncSession = None):
    if settings.USE_MONGO:
        # MongoDB implementation
        try:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")

            from datetime import datetime, timedelta

            # Helpers for date-only strings
            def to_date(d: datetime) -> str:
                return d.strftime("%d/%m/%Y")

            user = await mdb.users.find_one({"username": request.username})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            today_dt = datetime.now()
            today_d = today_dt.date()
            today_str = to_date(today_dt)

            assigned_account = None
            service_doc = None
            days = 0
            cost_to_deduct = 0

            if request.service_name and request.duration:
                service_doc = await mdb.services.find_one({"name": request.service_name})
                if not service_doc:
                    raise HTTPException(status_code=404, detail="Service not found")
                duration_cfg = config.get_subscription_durations().get(request.duration)
                if not duration_cfg:
                    raise HTTPException(status_code=400, detail="Invalid duration")
                try:
                    days = int(duration_cfg.get("days", 0))
                except Exception:
                    days = 0
                svc_credits_map = service_doc.get("credits", {}) or {}
                try:
                    cost_to_deduct = int(svc_credits_map.get(request.duration, duration_cfg.get("credits_cost", 0)))
                except Exception:
                    cost_to_deduct = int(duration_cfg.get("credits_cost", 0))
                # choose active account that can last the duration
                for acc in (service_doc.get("accounts") or []):
                    if not (acc or {}).get("is_active", True):
                        continue
                    end_s = (acc or {}).get("end_date")
                    if not end_s:
                        continue
                    try:
                        acc_end_dt = _parse_date(end_s)
                        acc_end_d = acc_end_dt.date() if hasattr(acc_end_dt, "date") else acc_end_dt
                    except Exception:
                        continue
                    if (acc_end_d - today_d).days >= days:
                        assigned_account = acc
                        break
                if not assigned_account:
                    raise HTTPException(status_code=400, detail="No account can satisfy requested duration")
                proposed_end_dt = today_dt + timedelta(days=days)
            elif request.service_id and request.end_date:
                # resolve by account_id or service name
                acc_id = str(request.service_id)
                # Try match by account_id
                service_doc = await mdb.services.find_one({"accounts.account_id": acc_id})
                if not service_doc:
                    # fallback to service name
                    service_doc = await mdb.services.find_one({"name": acc_id})
                    if not service_doc:
                        raise HTTPException(status_code=404, detail="Service or account not found")
                # Determine assigned account
                for acc in (service_doc.get("accounts") or []):
                    if (acc or {}).get("account_id") == acc_id:
                        assigned_account = acc
                        break
                # Parse requested end date; ensure account can support
                try:
                    new_end_dt = _parse_date(request.end_date)
                except Exception:
                    raise HTTPException(status_code=400, detail="Invalid end date format")
                new_end_d = new_end_dt.date() if hasattr(new_end_dt, "date") else new_end_dt
                days = max(0, (new_end_d - today_d).days)
                durations = config.get_subscription_durations()
                chosen = None
                for _, val in durations.items():
                    try:
                        if int(val.get("days", 0)) >= days and (chosen is None or int(val["days"]) < int(chosen["days"])):
                            chosen = val
                    except Exception:
                        continue
                if chosen is None and durations:
                    # estimate per-day from the largest plan
                    max_plan = max(durations.values(), key=lambda v: int(v.get("days", 0)))
                    try:
                        per_day = float(max_plan.get("credits_cost", 0)) / max(1, int(max_plan.get("days", 1)))
                        cost_to_deduct = int(round(per_day * days))
                    except Exception:
                        cost_to_deduct = 0
                else:
                    try:
                        cost_to_deduct = int(chosen.get("credits_cost", 0)) if chosen else 0
                    except Exception:
                        cost_to_deduct = 0
                # If account chosen explicitly, ensure it can sustain
                if assigned_account and (assigned_account.get("end_date")):
                    try:
                        acc_end_dt = _parse_date(assigned_account.get("end_date"))
                        acc_end_d = acc_end_dt.date() if hasattr(acc_end_dt, "date") else acc_end_dt
                        if new_end_d > acc_end_d:
                            raise HTTPException(status_code=400, detail="Requested end date exceeds account expiry")
                    except HTTPException:
                        raise
                    except Exception:
                        pass
                else:
                    # pick any account in the service that can satisfy end date
                    picked = None
                    for acc in (service_doc.get("accounts") or []):
                        if not (acc or {}).get("is_active", True):
                            continue
                        end_s = (acc or {}).get("end_date")
                        if not end_s:
                            continue
                        try:
                            acc_end_dt = _parse_date(end_s)
                            acc_end_d = acc_end_dt.date() if hasattr(acc_end_dt, "date") else acc_end_dt
                            if acc_end_d >= new_end_d:
                                picked = acc
                                break
                        except Exception:
                            continue
                    if not picked:
                        raise HTTPException(status_code=400, detail="No account can satisfy requested end date")
                    assigned_account = picked
                proposed_end_dt = new_end_dt
            else:
                raise HTTPException(status_code=400, detail="Provide either service_id+end_date or service_name+duration")

            # Credits check
            current_credits = int(user.get("credits", 0))
            if current_credits < int(cost_to_deduct):
                raise HTTPException(status_code=400, detail="Insufficient credits")

            service_name = service_doc.get("name", request.service_name or "")
            account_id = (assigned_account or {}).get("account_id")

            # Extend or create subscription
            existing = await mdb.subscriptions.find_one({"username": request.username, "service_name": service_name, "is_active": True})
            if existing:
                # base date = max(existing end, today)
                try:
                    exist_end_dt = _parse_date(existing.get("end_date")) if existing.get("end_date") else today_dt
                except Exception:
                    exist_end_dt = today_dt
                base_dt = exist_end_dt if exist_end_dt > today_dt else today_dt
                new_end_dt2 = base_dt + timedelta(days=days)
                # Ensure account can sustain
                try:
                    acc_end_dt = _parse_date((assigned_account or {}).get("end_date")) if (assigned_account or {}).get("end_date") else None
                    if acc_end_dt and new_end_dt2.date() > (acc_end_dt.date() if hasattr(acc_end_dt, "date") else acc_end_dt):
                        # try to find another account
                        found = None
                        for acc in (service_doc.get("accounts") or []):
                            if not (acc or {}).get("is_active", True):
                                continue
                            end_s = (acc or {}).get("end_date")
                            if not end_s:
                                continue
                            try:
                                acc_end_dt2 = _parse_date(end_s)
                                if acc_end_dt2 and acc_end_dt2 >= new_end_dt2:
                                    found = acc
                                    break
                            except Exception:
                                continue
                        if not found:
                            raise HTTPException(status_code=400, detail="No account can satisfy requested extension")
                        assigned_account = found
                        account_id = found.get("account_id")
                except HTTPException:
                    raise
                except Exception:
                    pass
                await mdb.subscriptions.update_one(
                    {"_id": existing.get("_id")},
                    {"$set": {
                        "end_date": to_date(new_end_dt2),
                        "account_id": account_id,
                        "duration_key": request.duration or existing.get("duration_key", ""),
                    }, "$inc": {"total_duration_days": int(days)}}
                )
                new_end_str = to_date(new_end_dt2)
            else:
                # create new sub
                new_end_str = to_date(proposed_end_dt)
                if assigned_account and assigned_account.get("end_date"):
                    try:
                        acc_end_dt = _parse_date(assigned_account.get("end_date"))
                        if proposed_end_dt.date() > (acc_end_dt.date() if hasattr(acc_end_dt, "date") else acc_end_dt):
                            raise HTTPException(status_code=400, detail="Requested duration exceeds account expiry")
                    except HTTPException:
                        raise
                    except Exception:
                        pass
                await mdb.subscriptions.insert_one({
                    "username": request.username,
                    "service_name": service_name,
                    "account_id": account_id,
                    "start_date": today_str,
                    "end_date": new_end_str,
                    "is_active": True,
                    "duration_key": request.duration or "",
                    "total_duration_days": int(days),
                })

            # Deduct credits
            await mdb.users.update_one({"username": request.username}, {"$inc": {"credits": -int(cost_to_deduct)}})

            return {
                "message": f"Assigned subscription to {request.username}",
                "credits": max(0, current_credits - int(cost_to_deduct)),
                "cost": int(cost_to_deduct),
                "service_name": service_name,
                "assigned_account_id": account_id,
                "account_expiry_days": int(days),
                "credits_deducted": int(cost_to_deduct),
                "remaining_credits": max(0, current_credits - int(cost_to_deduct)),
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error assigning subscription (Mongo): {e}")
            raise HTTPException(status_code=500, detail="Failed to assign subscription")
    async with get_or_use_session(db) as session:
        try:
            user = (await session.execute(select(UserModel).where(UserModel.username == request.username))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            from datetime import datetime, timedelta

            assigned_account = None
            target_service = None
            days = 0
            cost_to_deduct = 0

            today_dt = datetime.now()
            today_d = today_dt.date()

            if request.service_name and request.duration:
                target_service = (await session.execute(select(ServiceModel).where(ServiceModel.name == request.service_name))).scalars().first()
                if not target_service:
                    raise HTTPException(status_code=404, detail="Service not found")
                duration_cfg = config.get_subscription_durations().get(request.duration)
                if not duration_cfg:
                    raise HTTPException(status_code=400, detail="Invalid duration")
                days = int(duration_cfg.get("days", 0))
                # credits from normalized table
                sdc_rows = (await session.execute(select(ServiceDurationCredit).where(ServiceDurationCredit.service_id == target_service.id))).scalars().all()
                svc_credits_map = {r.duration_key: r.credits for r in sdc_rows}
                cost_to_deduct = int(svc_credits_map.get(request.duration, duration_cfg.get("credits_cost", 0)))
                # pick an active account that can satisfy the duration
                accounts = (await session.execute(select(ServiceAccount).where(ServiceAccount.service_id == target_service.id, ServiceAccount.is_active == True))).scalars().all()
                for acc in accounts:
                    if not acc.end_date:
                        continue
                    acc_end_d = acc.end_date.date() if hasattr(acc.end_date, "date") else acc.end_date
                    if (acc_end_d - today_d).days >= days:
                        assigned_account = acc
                        break
                if not assigned_account:
                    raise HTTPException(status_code=400, detail="No account can satisfy requested duration")
                proposed_end_d = today_d + timedelta(days=days)
            elif request.service_id and request.end_date:
                # resolve account by external id or internal pk or service name
                sa = (await session.execute(select(ServiceAccount).where(ServiceAccount.account_id == request.service_id))).scalars().first()
                if not sa:
                    try:
                        pk = int(request.service_id)
                        sa = (await session.execute(select(ServiceAccount).where(ServiceAccount.id == pk))).scalars().first()
                    except Exception:
                        svc = (await session.execute(select(ServiceModel).where(ServiceModel.name == request.service_id))).scalars().first()
                        if not svc:
                            raise HTTPException(status_code=404, detail="Service or account not found")
                        target_service = svc
                        # pick any active account that can support given end_date
                        accounts = (await session.execute(select(ServiceAccount).where(ServiceAccount.service_id == svc.id, ServiceAccount.is_active == True))).scalars().all()
                        new_end_dt = _parse_date(request.end_date)
                        new_end_d = new_end_dt.date() if hasattr(new_end_dt, "date") else new_end_dt
                        for acc in accounts:
                            if acc.end_date:
                                acc_end_d = acc.end_date.date() if hasattr(acc.end_date, "date") else acc.end_date
                                if acc_end_d >= new_end_d:
                                    assigned_account = acc
                                    break
                        if not assigned_account:
                            raise HTTPException(status_code=400, detail="No account can satisfy requested end date")
                        sa = assigned_account
                if not sa:
                    raise HTTPException(status_code=404, detail="Account not found")
                assigned_account = sa
                target_service = (await session.execute(select(ServiceModel).where(ServiceModel.id == sa.service_id))).scalars().first()
                new_end_dt = _parse_date(request.end_date)
                new_end_d = new_end_dt.date() if hasattr(new_end_dt, "date") else new_end_dt
                days = max(0, (new_end_d - today_d).days)
                durations = config.get_subscription_durations()
                chosen = None
                for _, val in durations.items():
                    if val.get("days", 0) >= days and (chosen is None or val["days"] < chosen["days"]):
                        chosen = val
                if chosen is None and durations:
                    max_plan = max(durations.values(), key=lambda v: v.get("days", 0))
                    per_day = max_plan["credits_cost"] / max(1, max_plan["days"])
                    cost_to_deduct = int(round(per_day * days))
                else:
                    cost_to_deduct = int(chosen.get("credits_cost", 0)) if chosen else 0
                proposed_end_d = new_end_d
            else:
                raise HTTPException(status_code=400, detail="Provide either service_id+end_date or service_name+duration")

            # Check and deduct credits
            if (user.credits or 0) < cost_to_deduct:
                raise HTTPException(status_code=400, detail="Insufficient credits")

            # Find existing active subscription for this service
            existing = (await session.execute(select(UserSubscription).where(UserSubscription.user_id == user.id, UserSubscription.service_id == target_service.id, UserSubscription.is_active == True))).scalars().first()
            if existing:
                current_end_d = existing.end_date
                base_d = current_end_d if current_end_d and current_end_d > today_d else today_d
                proposed_end_d = base_d + timedelta(days=days)
                # ensure account can sustain
                if not assigned_account.end_date:
                    raise HTTPException(status_code=400, detail="Requested extension exceeds account expiry")
                acc_end_d = assigned_account.end_date.date() if hasattr(assigned_account.end_date, "date") else assigned_account.end_date
                if proposed_end_d > acc_end_d:
                    raise HTTPException(status_code=400, detail="Requested extension exceeds account expiry")
                existing.end_date = proposed_end_d
                existing.account_id = assigned_account.id
                existing.duration_key = request.duration or existing.duration_key
                existing.total_duration_days = (existing.total_duration_days or 0) + days
            else:
                if not assigned_account.end_date:
                    raise HTTPException(status_code=400, detail="Requested duration exceeds account expiry")
                acc_end_d = assigned_account.end_date.date() if hasattr(assigned_account.end_date, "date") else assigned_account.end_date
                if proposed_end_d > acc_end_d:
                    raise HTTPException(status_code=400, detail="Requested duration exceeds account expiry")
                us = UserSubscription(
                    user_id=user.id,
                    service_id=target_service.id,
                    account_id=assigned_account.id,
                    start_date=today_d,
                    end_date=proposed_end_d,
                    is_active=True,
                    duration_key=request.duration or "",
                    total_duration_days=days,
                )
                session.add(us)

            user.credits = (user.credits or 0) - cost_to_deduct

            # Commit with precise error handling
            try:
                await session.commit()
            except (IntegrityError, DBAPIError) as e:
                await session.rollback()
                raise HTTPException(status_code=400, detail="Invalid subscription request") from e

            return {
                "message": f"Assigned subscription to {request.username}",
                "credits": user.credits,
                "cost": cost_to_deduct,
                "service_name": target_service.name if target_service else request.service_name,
                "assigned_account_id": assigned_account.account_id,
                "account_expiry_days": days,
                "credits_deducted": cost_to_deduct,
                "remaining_credits": user.credits,
            }

        except HTTPException:
            # Surface the HTTP error
            raise
        except Exception as e:
            try:
                if session is not None:
                    await session.rollback()
            finally:
                pass
            logger.exception("Error assigning subscription")
            raise HTTPException(status_code=500, detail="Failed to assign subscription") from e

async def add_credits_to_user(request: AdminAddCredits, current_user: User, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            res = await mdb.users.update_one({"username": request.username}, {"$inc": {"credits": int(request.credits)}})
            if res.matched_count == 0:
                raise HTTPException(status_code=404, detail="User not found")
            doc = await mdb.users.find_one({"username": request.username}, {"credits": 1})
            return {"message": f"Added {request.credits} credits to {request.username}", "credits": int((doc or {}).get("credits", 0))}
        async with get_or_use_session(db) as db:
            user = (await db.execute(select(UserModel).where(UserModel.username == request.username))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            if hasattr(request, 'service_id') and request.service_id:
                raise HTTPException(status_code=400, detail="Per-subscription credits are not supported")
                user.credits = (user.credits or 0) + request.credits
                await db.commit()
                return {"message": f"Added {request.credits} credits to {request.username}", "credits": user.credits}
    except Exception as e:
        logger.error(f"Error adding credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def remove_credits_from_user(request: AdminRemoveCredits, current_user: User, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            doc = await mdb.users.find_one({"username": request.username}, {"credits": 1})
            if not doc:
                raise HTTPException(status_code=404, detail="User not found")
            current = int(doc.get("credits", 0))
            new_val = max(0, current - int(request.credits))
            await mdb.users.update_one({"username": request.username}, {"$set": {"credits": new_val}})
            return {"message": f"Removed {request.credits} credits from {request.username}", "credits": new_val}
        async with get_or_use_session(db) as db:
            user = (await db.execute(select(UserModel).where(UserModel.username == request.username))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            if hasattr(request, 'service_id') and request.service_id:
                raise HTTPException(status_code=400, detail="Per-subscription credits are not supported")
                current = user.credits or 0
                user.credits = max(0, current - request.credits)
                await db.commit()
                return {"message": f"Removed {request.credits} credits from {request.username}", "credits": user.credits}
    except Exception as e:
        logger.error(f"Error removing credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def remove_user_subscription(request: AdminRemoveSubscription, current_user: User, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            q_user = {"username": request.username}
            q_or = [{"account_id": request.service_id}, {"service_name": request.service_id}]
            res = await mdb.subscriptions.delete_many({"$and": [q_user, {"$or": q_or}]})
            if res.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Subscription not found")
            return {"message": f"Removed subscription(s) for {request.username}", "removed": int(res.deleted_count)}
        async with get_or_use_session(db) as db:
            user = (await db.execute(select(UserModel).where(UserModel.username == request.username))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            # Resolve account by external account_id first
            sa = (await db.execute(select(ServiceAccount).where(ServiceAccount.account_id == request.service_id))).scalars().first()
            sa_id = sa.id if sa else None
            subs_q = select(UserSubscription).where(UserSubscription.user_id == user.id)
            if sa_id:
                subs_q = subs_q.where(UserSubscription.account_id == sa_id)
            else:
                # try interpreting request.service_id as internal account pk
                try:
                    account_pk = int(request.service_id)
                    subs_q = subs_q.where(UserSubscription.account_id == account_pk)
                except Exception:
                    # fall back to matching by service name via service lookup
                    svc = (await db.execute(select(ServiceModel).where(ServiceModel.name == request.service_id))).scalars().first()
                    if svc:
                        subs_q = subs_q.where(UserSubscription.service_id == svc.id)
            subs = (await db.execute(subs_q.with_only_columns(UserSubscription.id))).scalars().all()
            if not subs:
                raise HTTPException(status_code=404, detail="Subscription not found")
            removed = len(subs)
            await db.execute(UserSubscription.__table__.delete().where(UserSubscription.id.in_(subs)))
            await safe_commit(db, client_error_message="Invalid service delete request", server_error_message="Internal server error")
            return {"message": f"Removed subscription(s) for {request.username}", "removed": removed}
    except Exception as e:
        logger.error(f"Error removing user subscription: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def update_user_subscription_end_date(request: AdminUpdateSubscriptionEndDate, current_user: User, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            # Normalize to date-only string dd/mm/YYYY
            try:
                new_end_dt = _parse_date(request.end_date)
                new_end_str = _format_date(new_end_dt)
            except Exception:
                new_end_str = request.end_date
            q_user = {"username": request.username}
            q_or = [{"account_id": request.service_id}, {"service_name": request.service_id}]
            res = await mdb.subscriptions.update_one({"$and": [q_user, {"$or": q_or}]}, {"$set": {"end_date": new_end_str}})
            if res.matched_count == 0:
                raise HTTPException(status_code=404, detail="Subscription not found")
            return {"message": "Updated end date", "end_date": new_end_str}
        async with get_or_use_session(db) as db:
            user = (await db.execute(select(UserModel).where(UserModel.username == request.username))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            # Resolve account and subscription
            sa = (await db.execute(select(ServiceAccount).where(ServiceAccount.account_id == request.service_id))).scalars().first()
            sa_id = sa.id if sa else None
            subs_q = select(UserSubscription).where(UserSubscription.user_id == user.id)
            if sa_id:
                subs_q = subs_q.where(UserSubscription.account_id == sa_id)
            else:
                # try internal account id or match by service name
                try:
                    account_pk = int(request.service_id)
                    subs_q = subs_q.where(UserSubscription.account_id == account_pk)
                except Exception:
                    svc = (await db.execute(select(ServiceModel).where(ServiceModel.name == request.service_id))).scalars().first()
                    if svc:
                        subs_q = subs_q.where(UserSubscription.service_id == svc.id)
            subs = (await db.execute(subs_q)).scalars().all()
            if not subs:
                raise HTTPException(status_code=404, detail="Subscription not found")
            # pick one to update: prefer active or latest end_date
            target = None
            active = [s for s in subs if s.is_active]
            target = active[0] if active else max(subs, key=lambda s: (s.end_date or _parse_date("01/01/1900")))
            new_end = _parse_date(request.end_date)
            # keep date-only
            target.end_date = new_end.date() if hasattr(new_end, "date") else new_end
            try:
                from datetime import datetime
                target.is_active = (datetime.combine(target.end_date, datetime.min.time()) - datetime.now()).days >= 0 if target.end_date else False
            except Exception:
                pass
            await safe_commit(db, client_error_message="Invalid remove subscription request", server_error_message="Internal server error")
            return {"message": "Updated end date", "end_date": _format_date(new_end)}
    except Exception as e:
        logger.error(f"Error updating subscription end date: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def update_user_subscription_active(request: AdminUpdateSubscriptionActive, current_user: User, db: AsyncSession = None):
    try:
        async with get_or_use_session(db) as db:
            user = (await db.execute(select(UserModel).where(UserModel.username == request.username))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            sa = (await db.execute(select(ServiceAccount).where(ServiceAccount.account_id == request.service_id))).scalars().first()
            sa_id = sa.id if sa else None
            subs_q = select(UserSubscription).where(UserSubscription.user_id == user.id)
            if sa_id:
                subs_q = subs_q.where(UserSubscription.account_id == sa_id)
            else:
                try:
                    account_pk = int(request.service_id)
                    subs_q = subs_q.where(UserSubscription.account_id == account_pk)
                except Exception:
                    svc = (await db.execute(select(ServiceModel).where(ServiceModel.name == request.service_id))).scalars().first()
                    if svc:
                        subs_q = subs_q.where(UserSubscription.service_id == svc.id)
            subs = (await db.execute(subs_q)).scalars().all()
            if not subs:
                raise HTTPException(status_code=404, detail="Subscription not found")
            for s in subs:
                s.is_active = bool(request.is_active)
            await safe_commit(db, client_error_message="Invalid end date update", server_error_message="Internal server error")
            return {"message": f"Updated is_active", "is_active": request.is_active}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating subscription active flag: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def get_all_users(current_user: User, page: int = 1, size: int = 20, search: str = None, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            page = max(1, int(page or 1))
            size = max(1, int(size or 20))
            filter_q = {}
            if search and search.strip():
                rx = {"$regex": search.strip(), "$options": "i"}
                filter_q = {"$or": [{"username": rx}, {"email": rx}]}
            total = await mdb.users.count_documents(filter_q)
            cursor = (
                mdb.users.find(filter_q, {"_id": 0, "username": 1, "email": 1, "role": 1, "credits": 1})
                .sort("username", 1)
                .skip((page - 1) * size)
                .limit(size)
            )
            items = await cursor.to_list(length=size)
            usernames = [u["username"] for u in items]
            subs_counts = {}
            if usernames:
                pipeline = [
                    {"$match": {"username": {"$in": usernames}}},
                    {"$group": {"_id": "$username", "count": {"$sum": 1}}},
                ]
                async for row in mdb.subscriptions.aggregate(pipeline):
                    subs_counts[row["_id"]] = int(row.get("count", 0))
            users = []
            for u in items:
                users.append({
                    "username": u.get("username", ""),
                    "email": u.get("email", ""),
                    "role": u.get("role", "user"),
                    "credits": int(u.get("credits", 0)),
                    "services_count": int(subs_counts.get(u.get("username", ""), 0)),
                })
            total_pages = max(1, (total + size - 1) // size)
            return {"users": users, "page": page, "size": size, "total": total, "total_pages": total_pages}
        # SQL fallback
        async with get_or_use_session(db) as db:
            filters = None
            if search:
                like = f"%{search}%"
                filters = or_(UserModel.username.ilike(like), UserModel.email.ilike(like))
            if filters is not None:
                total = (await db.execute(select(func.count(UserModel.id)).where(filters))).scalar() or 0
                q = select(UserModel).where(filters)
            else:
                total = (await db.execute(select(func.count(UserModel.id)))).scalar() or 0
                q = select(UserModel)
            page = max(1, int(page or 1))
            size = max(1, int(size or 20))
            result = await db.execute(q.offset((page - 1) * size).limit(size))
            items = result.scalars().all()
            users = []
            if items:
                user_ids = [u.id for u in items]
                counts_rows = await db.execute(
                    select(UserSubscription.user_id, func.count(UserSubscription.id))
                    .where(UserSubscription.user_id.in_(user_ids))
                    .group_by(UserSubscription.user_id)
                )
                counts_map = {row[0]: int(row[1]) for row in counts_rows.all()}
            else:
                counts_map = {}
            for user in items:
                subs_count = counts_map.get(user.id, 0)
                users.append({
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "credits": user.credits,
                    "services_count": int(subs_count),
                })
            total_pages = max(1, (total + size - 1) // size)
            return {"users": users, "page": page, "size": size, "total": total, "total_pages": total_pages}
    except Exception as e:
        logger.error(f"Error getting all users: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def get_all_admin_services(current_user: User, page: int = 1, size: int = 20, search: str = None, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            page = max(1, int(page or 1))
            size = max(1, int(size or 20))
            filter_q = {}
            if search and search.strip():
                filter_q = {"name": {"$regex": search.strip(), "$options": "i"}}
            total = await mdb.services.count_documents(filter_q)
            cursor = (
                mdb.services.find(filter_q, {"_id": 0, "name": 1, "image": 1, "accounts": 1})
                .sort("name", 1)
                .skip((page - 1) * size)
                .limit(size)
            )
            items = await cursor.to_list(length=size)
            services = []
            for svc in items:
                accounts = svc.get("accounts") or []
                sanitized = [{"id": a.get("account_id"), "is_active": bool(a.get("is_active", True))} for a in accounts]
                services.append({
                    "name": svc.get("name", ""),
                    "image": svc.get("image", ""),
                    "accounts": sanitized,
                })
            total_pages = max(1, (total + size - 1) // size)
            return {"services": services, "page": page, "size": size, "total": total, "total_pages": total_pages}
        # SQL fallback
        async with get_or_use_session(db) as db:
            filters = None
            if search:
                like = f"%{search}%"
                filters = ServiceModel.name.ilike(like)
            if filters is not None:
                total = (await db.execute(select(func.count(ServiceModel.id)).where(filters))).scalar() or 0
                q = select(ServiceModel).where(filters)
            else:
                total = (await db.execute(select(func.count(ServiceModel.id)))).scalar() or 0
                q = select(ServiceModel)
            page = max(1, int(page or 1))
            size = max(1, int(size or 20))
            result = await db.execute(q.offset((page - 1) * size).limit(size))
            items = result.scalars().all()
            services = []
            if items:
                service_ids = [s.id for s in items]
                acc_rows_result = await db.execute(
                    select(ServiceAccount).where(ServiceAccount.service_id.in_(service_ids))
                )
                acc_rows = acc_rows_result.scalars().all()
                accounts_by_service: dict[int, list[ServiceAccount]] = {}
                for acc in acc_rows:
                    accounts_by_service.setdefault(acc.service_id, []).append(acc)
            else:
                accounts_by_service = {}
            for service in items:
                acc_rows = accounts_by_service.get(service.id, [])
                sanitized_accounts = [{"id": acc.account_id, "is_active": bool(acc.is_active)} for acc in acc_rows]
                services.append({
                    "name": service.name,
                    "image": service.image,
                    "accounts": sanitized_accounts,
                })
            total_pages = max(1, (total + size - 1) // size)
            return {"services": services, "page": page, "size": size, "total": total, "total_pages": total_pages}
    except Exception as e:
        logger.error(f"Error getting all services: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def update_service_credits(service_name: str, credits_map: dict, current_user: User, db: AsyncSession = None):
    try:
        async with get_or_use_session(db) as db:
            svc = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            if not svc:
                raise HTTPException(status_code=404, detail="Service not found")
            # Upsert rows in ServiceDurationCredit
            existing_rows = (await db.execute(select(ServiceDurationCredit).where(ServiceDurationCredit.service_id == svc.id))).scalars().all()
            existing_map = {row.duration_key: row for row in existing_rows}
            # Update or insert
            for duration_key, credits in (credits_map or {}).items():
                try:
                    val = int(credits)
                except Exception:
                    val = 0
                if duration_key in existing_map:
                    existing_map[duration_key].credits = val
                else:
                    db.add(ServiceDurationCredit(service_id=svc.id, duration_key=duration_key, credits=val))
            # Delete any durations not present anymore
            to_delete = [row for key, row in existing_map.items() if key not in (credits_map or {})]
            for row in to_delete:
                await db.delete(row)
            await safe_commit(db, client_error_message="Invalid active flag update", server_error_message="Internal server error")
            # Return updated map
            updated_rows = (await db.execute(select(ServiceDurationCredit).where(ServiceDurationCredit.service_id == svc.id))).scalars().all()
            return {"message": f"Updated credits for {service_name}", "service_credits": {r.duration_key: r.credits for r in updated_rows}}
    except Exception as e:
        logger.error(f"Error updating service credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def get_service_credits_admin(service_name: str, current_user: User, db: AsyncSession = None):
    try:
        async with get_or_use_session(db) as db:
            svc = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            if not svc:
                raise HTTPException(status_code=404, detail="Service not found")
            rows = (await db.execute(select(ServiceDurationCredit).where(ServiceDurationCredit.service_id == svc.id))).scalars().all()
            return {"service_name": service_name, "credits": {r.duration_key: r.credits for r in rows}}
    except Exception as e:
        logger.error(f"Error getting service credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def add_service(service_data: dict, current_user: User, db: AsyncSession = None):
    try:
        service_name = service_data.get("name")
        if not service_name:
            raise HTTPException(status_code=400, detail="Service name is required")
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            existing_service = await mdb.services.find_one({"name": service_name})
            if existing_service:
                raise HTTPException(status_code=400, detail="Service already exists")
            # Build service document
            accounts = []
            for acc in (service_data.get("accounts") or []):
                accounts.append({
                    "account_id": acc.get("id", ""),
                    "password_hash": acc.get("password", "") or "",
                    "end_date": acc.get("end_date", "") or "",
                    "is_active": bool(acc.get("is_active", True)),
                })
            credits_in = service_data.get("credits") or {}
            credits = {}
            for k, v in credits_in.items():
                try:
                    credits[k] = int(v)
                except Exception:
                    credits[k] = 0
            doc = {
                "name": service_name,
                "image": service_data.get("image", ""),
                "accounts": accounts,
                "credits": credits,
                "is_active": True,
            }
            await mdb.services.insert_one(doc)
            return {"message": f"Service {service_name} added successfully"}
        async with get_or_use_session(db) as db:
            existing_service = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            if existing_service:
                raise HTTPException(status_code=400, detail="Service already exists")
            svc = ServiceModel(
                name=service_name,
                image=service_data.get("image", ""),
            )
            db.add(svc)
            await safe_commit(db, client_error_message="Invalid add service request", server_error_message="Internal server error")
            # We need the service id
            svc = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            # Create accounts in normalized table
            accounts = (service_data.get("accounts") or [])
            for acc in accounts:
                try:
                    end_d = _parse_date(acc.get("end_date")) if acc.get("end_date") else None
                except Exception:
                    end_d = None
                db.add(ServiceAccount(
                    service_id=svc.id,
                    account_id=acc.get("id", ""),
                    password_hash=acc.get("password", "") or "",
                    end_date=end_d,
                    is_active=bool(acc.get("is_active", True)),
                ))
            # Create credits in normalized table
            credits = (service_data.get("credits") or {})
            for duration_key, credits_val in credits.items():
                try:
                    val = int(credits_val)
                except Exception:
                    val = 0
                db.add(ServiceDurationCredit(
                    service_id=svc.id,
                    duration_key=duration_key,
                    credits=val,
                ))
            await db.commit()
            return {"message": f"Service {service_name} added successfully"}
    except Exception as e:
        logger.error(f"Error adding service: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def update_service(service_name: str, service_data: dict, current_user: User, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            svc = await mdb.services.find_one({"name": service_name})
            if not svc:
                raise HTTPException(status_code=404, detail="Service not found")

            update_doc = {}
            # Basic fields
            if "name" in service_data:
                update_doc["name"] = service_data.get("name") or svc.get("name")
            if "image" in service_data:
                update_doc["image"] = service_data.get("image", "")

            # Accounts upsert
            if "accounts" in service_data:
                incoming_accounts = service_data.get("accounts") or []
                current_accounts = svc.get("accounts") or []
                by_ext = { (a or {}).get("account_id"): (a or {}) for a in current_accounts }
                incoming_ext_ids = set()
                merged_accounts = []
                for acc in incoming_accounts:
                    ext_id = acc.get("id", "")
                    incoming_ext_ids.add(ext_id)
                    existing = by_ext.get(ext_id, {})
                    merged = {
                        "account_id": ext_id,
                        "password_hash": acc.get("password", existing.get("password_hash", "")) or "",
                        "end_date": acc.get("end_date", existing.get("end_date", "")) or "",
                        "is_active": bool(acc.get("is_active", existing.get("is_active", True))),
                    }
                    merged_accounts.append(merged)
                # Keep existing accounts that are not in incoming only if you want to retain; spec suggests remove
                update_doc["accounts"] = merged_accounts

            # Credits upsert/replace
            if "credits" in service_data:
                credits_map = service_data.get("credits") or {}
                sanitized = {}
                for k, v in credits_map.items():
                    try:
                        sanitized[k] = int(v)
                    except Exception:
                        sanitized[k] = 0
                update_doc["credits"] = sanitized

            if update_doc:
                await mdb.services.update_one({"_id": svc["_id"]}, {"$set": update_doc})
            return {"message": f"Service {update_doc.get('name', service_name)} updated successfully"}

        async with get_or_use_session(db) as db:
            existing_service = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            if not existing_service:
                raise HTTPException(status_code=404, detail="Service not found")
            existing_service.name = service_data.get("name", existing_service.name)
            existing_service.image = service_data.get("image", existing_service.image)
            await db.commit()
            # Upsert accounts in normalized table
            incoming_accounts = service_data.get("accounts")
            if incoming_accounts is not None:
                # Map existing by external account_id
                current_acc_rows = (await db.execute(select(ServiceAccount).where(ServiceAccount.service_id == existing_service.id))).scalars().all()
                current_by_ext = {a.account_id: a for a in current_acc_rows}
                incoming_ext_ids = set()
                for acc in incoming_accounts:
                    ext_id = acc.get("id", "")
                    incoming_ext_ids.add(ext_id)
                    try:
                        end_d = _parse_date(acc.get("end_date")) if acc.get("end_date") else None
                    except Exception:
                        end_d = None
                    if ext_id in current_by_ext:
                        row = current_by_ext[ext_id]
                        row.password_hash = acc.get("password", "") or ""
                        row.end_date = end_d
                        row.is_active = bool(acc.get("is_active", True))
                    else:
                        db.add(ServiceAccount(
                            service_id=existing_service.id,
                            account_id=ext_id,
                            password_hash=acc.get("password", "") or "",
                            end_date=end_d,
                            is_active=bool(acc.get("is_active", True)),
                        ))
                # Delete accounts not present anymore
                for ext_id, row in current_by_ext.items():
                    if ext_id not in incoming_ext_ids:
                        await db.delete(row)
                await safe_commit(db, client_error_message="Invalid update service request", server_error_message="Internal server error")
            # Upsert credits in normalized table if provided
            if "credits" in service_data:
                credits_map = service_data.get("credits") or {}
                current_rows = (await db.execute(select(ServiceDurationCredit).where(ServiceDurationCredit.service_id == existing_service.id))).scalars().all()
                by_key = {r.duration_key: r for r in current_rows}
                for key, val in credits_map.items():
                    try:
                        ival = int(val)
                    except Exception:
                        ival = 0
                    if key in by_key:
                        by_key[key].credits = ival
                    else:
                        db.add(ServiceDurationCredit(service_id=existing_service.id, duration_key=key, credits=ival))
                for key, row in by_key.items():
                    if key not in credits_map:
                        await db.delete(row)
                await db.commit()
            return {"message": f"Service {service_name} updated successfully"}
    except Exception as e:
        logger.error(f"Error updating service: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def delete_service(service_name: str, current_user: User, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            svc = await mdb.services.find_one({"name": service_name})
            if not svc:
                raise HTTPException(status_code=404, detail="Service not found")
            # Delete user subscriptions for this service name
            subs_res = await mdb.subscriptions.delete_many({"service_name": service_name})
            # Delete the service document
            await mdb.services.delete_one({"_id": svc["_id"]})
            return {
                "message": f"Service {service_name} deleted successfully",
                "users_updated": int(subs_res.deleted_count or 0),
                "account_ids_removed": []
            }
        async with get_or_use_session(db) as db:
            service = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            if not service:
                raise HTTPException(status_code=404, detail="Service not found")
            # Delete user_subscriptions for this service
            # Bulk delete subscriptions for this service
            subs = (await db.execute(select(UserSubscription.id).where(UserSubscription.service_id == service.id))).scalars().all()
            removed = len(subs)
            if subs:
                await db.execute(
                    UserSubscription.__table__.delete().where(UserSubscription.id.in_(subs))
                )
            # Delete service accounts for this service
            # Bulk delete service accounts
            await db.execute(ServiceAccount.__table__.delete().where(ServiceAccount.service_id == service.id))
            await db.delete(service)
            await safe_commit(db, client_error_message="Invalid credits update", server_error_message="Internal server error")
            return {
                "message": f"Service {service_name} deleted successfully",
                "users_updated": removed,
                "account_ids_removed": []
            }
    except Exception as e:
        logger.error(f"Error deleting service: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def get_service_details(service_name: str, current_user: User, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            svc = await mdb.services.find_one({"name": service_name})
            if not svc:
                raise HTTPException(status_code=404, detail="Service not found")
            def _fmt_date_str(s):
                return s or ""
            accounts = [{
                "id": (a or {}).get("account_id", ""),
                "password": (a or {}).get("password_hash", ""),
                "end_date": _fmt_date_str((a or {}).get("end_date", "")),
                "is_active": bool((a or {}).get("is_active", True))
            } for a in (svc.get("accounts") or [])]
            credits = svc.get("credits", {})
            return {
                "service_name": service_name,
                "name": svc.get("name", service_name),
                "image": svc.get("image", ""),
                "accounts": accounts,
                "credits": credits,
            }
        async with get_or_use_session(db) as db:
            service = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            if not service:
                raise HTTPException(status_code=404, detail="Service not found")
            acc_rows = (await db.execute(select(ServiceAccount).where(ServiceAccount.service_id == service.id))).scalars().all()
            def _fmt_date(d):
                try:
                    return d.strftime("%d/%m/%Y") if d else ""
                except Exception:
                    return ""
            accounts = [{
                "id": acc.account_id,
                "password": acc.password_hash or "",
                "end_date": _fmt_date(acc.end_date),
                "is_active": bool(acc.is_active)
            } for acc in acc_rows]
            credits_rows = (await db.execute(select(ServiceDurationCredit).where(ServiceDurationCredit.service_id == service.id))).scalars().all()
            credits = {r.duration_key: r.credits for r in credits_rows}
            return {
                "service_name": service_name,
                "name": service.name,
                "image": service.image,
                "accounts": accounts,
                "credits": credits,
            }
    except Exception as e:
        logger.error(f"Error getting service details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 

async def get_user_subscriptions_admin(username: str, current_user: User, db: AsyncSession = None):
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            user = await mdb.users.find_one({"username": username})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            subs_cursor = mdb.subscriptions.find({"username": username})
            subs = await subs_cursor.to_list(length=1000)
            subscriptions = []
            for s in subs:
                svc_name = s.get("service_name", "")
                svc = await mdb.services.find_one({"name": svc_name}, {"image": 1, "accounts": 1})
                image = (svc or {}).get("image", "")
                acc_id = s.get("account_id")
                acc_pw = ""
                if svc and acc_id:
                    for a in (svc.get("accounts") or []):
                        if (a or {}).get("account_id") == acc_id:
                            acc_pw = (a or {}).get("password_hash", "")
                            break
                subscriptions.append({
                    "service_name": svc_name,
                    "service_image": image,
                    "account_id": acc_id,
                    "password": acc_pw,
                    "end_date": s.get("end_date", ""),
                    "is_active": bool(s.get("is_active", True)),
                    "credits": int(s.get("total_duration_days", 0)),
                })
            return {"username": username, "credits": int(user.get("credits", 0)), "subscriptions": subscriptions}
        # SQL fallback
        async with get_or_use_session(db) as db:
            user = (await db.execute(select(UserModel).where(UserModel.username == username))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            subscriptions = []
            services_by_id = {s.id: s for s in (await db.execute(select(ServiceModel))).scalars().all()}
            subs = (await db.execute(select(UserSubscription).where(UserSubscription.user_id == user.id))).scalars().all()
            # preload accounts
            acc_ids = [s.account_id for s in subs if s.account_id]
            acc_map = {}
            if acc_ids:
                acc_rows = (await db.execute(select(ServiceAccount).where(ServiceAccount.id.in_(acc_ids)))).scalars().all()
                acc_map = {a.id: a for a in acc_rows}
            for sub in subs:
                svc = services_by_id.get(sub.service_id)
                acc = acc_map.get(sub.account_id) if sub.account_id else None
                subscriptions.append({
                    "service_name": svc.name if svc else "",
                    "service_image": svc.image if svc else "",
                    "account_id": acc.account_id if acc else None,
                    "password": acc.password_hash if acc else "",
                    "end_date": sub.end_date.strftime("%d/%m/%Y") if sub.end_date else "",
                    "is_active": bool(sub.is_active),
                    "credits": sub.total_duration_days or 0,
                })
            return {"username": username, "credits": user.credits, "subscriptions": subscriptions}
    except Exception as e:
        logger.error(f"Error getting user subscriptions (admin): {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


