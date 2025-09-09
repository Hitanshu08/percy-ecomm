from schemas.user_schema import AdminAssignSubscription, AdminAddCredits, AdminRemoveCredits, AdminRemoveSubscription, AdminUpdateSubscriptionEndDate, User, AdminUpdateSubscriptionActive
from config import config
from db.session import SessionLocal, get_or_use_session
from db.models.user import User as UserModel
from db.models.service import Service as ServiceModel, ServiceAccount
from db.models.subscription import ServiceDurationCredit, UserSubscription
from fastapi import HTTPException
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select, or_, func
import logging
from sqlalchemy.ext.asyncio import AsyncSession

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
    try:
        async with get_or_use_session(db) as db:
            user = (await db.execute(select(UserModel).where(UserModel.username == request.username))).scalars().first()
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
                target_service = (await db.execute(select(ServiceModel).where(ServiceModel.name == request.service_name))).scalars().first()
                if not target_service:
                    raise HTTPException(status_code=404, detail="Service not found")
                duration_cfg = config.get_subscription_durations().get(request.duration)
                if not duration_cfg:
                    raise HTTPException(status_code=400, detail="Invalid duration")
                days = int(duration_cfg.get("days", 0))
                # credits from normalized table
                sdc_rows = (await db.execute(select(ServiceDurationCredit).where(ServiceDurationCredit.service_id == target_service.id))).scalars().all()
                svc_credits_map = {r.duration_key: r.credits for r in sdc_rows}
                cost_to_deduct = int(svc_credits_map.get(request.duration, duration_cfg.get("credits_cost", 0)))
                # pick an active account that can satisfy the duration
                accounts = (await db.execute(select(ServiceAccount).where(ServiceAccount.service_id == target_service.id, ServiceAccount.is_active == True))).scalars().all()
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
                sa = (await db.execute(select(ServiceAccount).where(ServiceAccount.account_id == request.service_id))).scalars().first()
                if not sa:
                    try:
                        pk = int(request.service_id)
                        sa = (await db.execute(select(ServiceAccount).where(ServiceAccount.id == pk))).scalars().first()
                    except Exception:
                        svc = (await db.execute(select(ServiceModel).where(ServiceModel.name == request.service_id))).scalars().first()
                        if not svc:
                            raise HTTPException(status_code=404, detail="Service or account not found")
                        target_service = svc
                        # pick any active account that can support given end_date
                        accounts = (await db.execute(select(ServiceAccount).where(ServiceAccount.service_id == svc.id, ServiceAccount.is_active == True))).scalars().all()
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
                target_service = (await db.execute(select(ServiceModel).where(ServiceModel.id == sa.service_id))).scalars().first()
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
            existing = (await db.execute(select(UserSubscription).where(UserSubscription.user_id == user.id, UserSubscription.service_id == target_service.id, UserSubscription.is_active == True))).scalars().first()
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
                db.add(us)

            user.credits = (user.credits or 0) - cost_to_deduct
            await db.commit()
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
    except Exception as e:
        logger.error(f"Error assigning subscription: {e}")
        raise HTTPException(status_code=400, detail="Failed to assign subscription")

async def add_credits_to_user(request: AdminAddCredits, current_user: User, db: AsyncSession = None):
    try:
        async with get_or_use_session(db) as db:
            user = (await db.execute(select(UserModel).where(UserModel.username == request.username))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            if hasattr(request, 'service_id') and request.service_id:
                # Per-subscription credits are not supported post-normalization
                raise HTTPException(status_code=400, detail="Per-subscription credits are not supported")
            else:
                user.credits = (user.credits or 0) + request.credits
                await db.commit()
                return {"message": f"Added {request.credits} credits to {request.username}", "credits": user.credits}
    except Exception as e:
        logger.error(f"Error adding credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def remove_credits_from_user(request: AdminRemoveCredits, current_user: User, db: AsyncSession = None):
    try:
        async with get_or_use_session(db) as db:
            user = (await db.execute(select(UserModel).where(UserModel.username == request.username))).scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            if hasattr(request, 'service_id') and request.service_id:
                raise HTTPException(status_code=400, detail="Per-subscription credits are not supported")
            else:
                current = user.credits or 0
                user.credits = max(0, current - request.credits)
                await db.commit()
                return {"message": f"Removed {request.credits} credits from {request.username}", "credits": user.credits}
    except Exception as e:
        logger.error(f"Error removing credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def remove_user_subscription(request: AdminRemoveSubscription, current_user: User, db: AsyncSession = None):
    try:
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
            subs = (await db.execute(subs_q)).scalars().all()
            if not subs:
                raise HTTPException(status_code=404, detail="Subscription not found")
            removed = 0
            for s in subs:
                await db.delete(s)
                removed += 1
            await db.commit()
            return {"message": f"Removed subscription(s) for {request.username}", "removed": removed}
    except Exception as e:
        logger.error(f"Error removing user subscription: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def update_user_subscription_end_date(request: AdminUpdateSubscriptionEndDate, current_user: User, db: AsyncSession = None):
    try:
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
            target.end_date = new_end.date() if hasattr(new_end, "date") else new_end
            try:
                from datetime import datetime
                target.is_active = (datetime.combine(target.end_date, datetime.min.time()) - datetime.now()).days >= 0 if target.end_date else False
            except Exception:
                pass
            await db.commit()
            return {"message": f"Updated end date", "end_date": request.end_date}
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
            await db.commit()
            return {"message": f"Updated is_active", "is_active": request.is_active}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating subscription active flag: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def get_all_users(current_user: User, page: int = 1, size: int = 20, search: str = None, db: AsyncSession = None):
    try:
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
                # Batch count subscriptions per user for current page
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
                # Batch fetch accounts for current page of services
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
            await db.commit()
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
        async with get_or_use_session(db) as db:
            existing_service = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            if existing_service:
                raise HTTPException(status_code=400, detail="Service already exists")
            svc = ServiceModel(
                name=service_name,
                image=service_data.get("image", ""),
            )
            db.add(svc)
            await db.commit()
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
                await db.commit()
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
        async with get_or_use_session(db) as db:
            service = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            if not service:
                raise HTTPException(status_code=404, detail="Service not found")
            # Delete user_subscriptions for this service
            subs = (await db.execute(select(UserSubscription).where(UserSubscription.service_id == service.id))).scalars().all()
            removed = 0
            for s in subs:
                await db.delete(s)
                removed += 1
            # Delete service accounts for this service
            accs = (await db.execute(select(ServiceAccount).where(ServiceAccount.service_id == service.id))).scalars().all()
            for acc in accs:
                await db.delete(acc)
            await db.delete(service)
            await db.commit()
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
        async with get_or_use_session(db) as db:
            service = (await db.execute(select(ServiceModel).where(ServiceModel.name == service_name))).scalars().first()
            if not service:
                raise HTTPException(status_code=404, detail="Service not found")
            # accounts from normalized table (include fields needed for editing)
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


