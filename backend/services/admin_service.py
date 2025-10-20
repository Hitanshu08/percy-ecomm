from schemas.user_schema import AdminAssignSubscription, AdminAddCredits, AdminRemoveCredits, AdminRemoveSubscription, AdminUpdateSubscriptionEndDate, User, AdminUpdateSubscriptionActive
from config import config
from db.session import get_db_session
from db.models.user import User as UserModel
from db.models.service import Service as ServiceModel
from fastapi import HTTPException
from sqlalchemy.orm.attributes import flag_modified
import logging

logger = logging.getLogger(__name__)

def assign_subscription(request: AdminAssignSubscription, current_user: User):
    """Assign subscription to user"""
    try:
        logger.info(f"Assigning subscription to user: {request.username}, service: {request.service_name}, duration: {request.duration}")
        db = get_db_session()
        try:
            user = db.query(UserModel).filter(UserModel.username == request.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            logger.info(f"Found user: {user.username}, current credits: {user.credits}, current services: {user.services}")

            # Allow two modes:
            # 1) Direct: service_id + end_date
            # 2) Derived: service_name + duration
            service_id = request.service_id
            end_date = request.end_date
            cost_to_deduct = 0
            if not service_id or not end_date:
                # Derive from service_name + duration
                if not request.service_name or not request.duration:
                    raise HTTPException(status_code=400, detail="Provide either service_id+end_date or service_name+duration")
                svc = db.query(ServiceModel).filter(ServiceModel.name == request.service_name).first()
                if not svc:
                    raise HTTPException(status_code=404, detail="Service not found")
                # pick any active account; ensure duration fits available window
                from datetime import datetime, timedelta
                from services.service_service import parse_date, format_date
                duration_cfg = config.get_subscription_durations().get(request.duration)
                if not duration_cfg:
                    raise HTTPException(status_code=400, detail="Invalid duration")
                days = duration_cfg["days"]
                # Determine credits from service.credits override, fallback to global durations credits_cost
                try:
                    svc_credits_map = (svc.credits or {})
                    cost_to_deduct = int(svc_credits_map.get(request.duration, duration_cfg.get("credits_cost", 0)))
                except Exception:
                    cost_to_deduct = duration_cfg.get("credits_cost", 0)
                today = datetime.now()
                picked_account = None
                for account in (svc.accounts or []):
                    if account.get("is_active"):
                        acc_end = parse_date(account["end_date"]) if isinstance(account.get("end_date"), str) else account.get("end_date")
                        if acc_end and (acc_end - today).days >= days:
                            picked_account = account
                            break
                if not picked_account:
                    raise HTTPException(status_code=400, detail="No account can satisfy requested duration")
                service_id = picked_account["id"]
                end_date = format_date(today + timedelta(days=days))
            else:
                # Infer cost from end_date difference if duration not provided
                from datetime import datetime
                from services.service_service import parse_date
                days = max((parse_date(end_date) - datetime.now()).days, 0)
                durations = config.get_subscription_durations()
                chosen = None
                for key, val in durations.items():
                    if val.get("days", 0) >= days:
                        if chosen is None or val["days"] < chosen["days"]:
                            chosen = val
                if chosen is None and durations:
                    max_plan = max(durations.values(), key=lambda v: v.get("days", 0))
                    per_day = max_plan["credits_cost"] / max(1, max_plan["days"])
                    cost_to_deduct = int(round(per_day * days))
                elif chosen is not None:
                    cost_to_deduct = chosen["credits_cost"]

            # Validate selected account exists and capture its service + account data
            svc_for_account = None
            picked_account_obj = None
            for service in db.query(ServiceModel).all():
                for account in (service.accounts or []):
                    if account.get("id") == service_id:
                        svc_for_account = service
                        picked_account_obj = account
                        break
                if svc_for_account:
                    break
            if not svc_for_account:
                raise HTTPException(status_code=404, detail="Service account not found")

            # Deduct credits for assignment/extension (enabled)
            deduct_enabled = True
            # if deduct_enabled:
            #     if user.credits is None:
            #         user.credits = 0
            #     if user.credits < cost_to_deduct:
            #         raise HTTPException(status_code=400, detail="Insufficient credits for assignment")
            #     user.credits -= cost_to_deduct

            # If the user already has a subscription for this service, extend it if possible
            try:
                from datetime import datetime, timedelta
                from services.service_service import parse_date, format_date
                existing_subscription = None
                # Identify if any existing subscription belongs to this same service (any account in svc_for_account)
                service_account_ids = set(acc.get("id") for acc in (svc_for_account.accounts or []))
                for sub in (user.services or []):
                    sid = sub.get("service_id")
                    aid = sub.get("account_id")
                    if sid in service_account_ids or aid in service_account_ids:
                        existing_subscription = sub
                        break
                if existing_subscription:
                    # Determine proposed new end date by extending current end or from today
                    today = datetime.now()
                    current_end = parse_date(existing_subscription.get("end_date")) if isinstance(existing_subscription.get("end_date"), str) else existing_subscription.get("end_date")
                    base_date = current_end if current_end and current_end > today else today
                    proposed_end = base_date + timedelta(days=days)
                    # Ensure the backing service account can support the proposed end date
                    account_end = parse_date(picked_account_obj.get("end_date")) if isinstance(picked_account_obj.get("end_date"), str) else picked_account_obj.get("end_date")
                    if not account_end or proposed_end > account_end:
                        raise HTTPException(status_code=400, detail="Cannot extend: requested extension exceeds service account expiry")
                    # Deduct user global credits (must be sufficient)
                    if deduct_enabled:
                        if user.credits is None:
                            user.credits = 0
                        if (user.credits or 0) < cost_to_deduct:
                            raise HTTPException(status_code=400, detail="Insufficient credits")
                        user.credits = (user.credits or 0) - cost_to_deduct
                    # Apply extension and credit top-up
                    existing_subscription["end_date"] = format_date(proposed_end)
                    # Top up subscription credits for the additional period
                    # existing_subscription["credits"] = (existing_subscription.get("credits", 0) or 0) + service_credits
                    flag_modified(user, "services")
                    db.flush()
                    db.commit()
                    db.refresh(user)
                    effective_cost = cost_to_deduct if deduct_enabled else 0
                    return {
                        "message": f"Extended subscription for {request.username}",
                        "extension": True,
                        "new_end_date": format_date(proposed_end),
                        "credits": user.credits,
                        "cost": effective_cost,
                        "service_name": request.service_name,
                        "assigned_account_id": existing_subscription.get("service_id"),
                        "account_expiry_days": days,
                        "credits_deducted": effective_cost,
                        "remaining_credits": user.credits,
                    }
            except HTTPException:
                # Do not create a duplicate subscription when extension fails
                raise
            except Exception as e:
                # Treat unknown extension errors as bad request and don't duplicate subscriptions
                logger.error(f"Unexpected error during extension: {e}")
                raise HTTPException(status_code=400, detail="Failed to extend existing subscription")

            # Handle JSON field properly - ensure it's a list
            if user.services is None:
                user.services = []
            elif not isinstance(user.services, list):
                user.services = []
            
            # Get credits for this service and duration
            # Assign per-service credits (use service model credits if set, else fallback)
            try:
                svc = db.query(ServiceModel).filter(ServiceModel.name == request.service_name).first()
                service_credits = int((svc.credits or {}).get(request.duration, config.get_service_credits_for_duration(request.service_name, request.duration)))
            except Exception:
                service_credits = config.get_service_credits_for_duration(request.service_name, request.duration)
            
            new_subscription = {
                "service_id": service_id,
                "end_date": end_date,
                "is_active": True,
                "credits": service_credits,  # Assign credits based on service and duration
            }
            
            # Deduct user global credits for new subscription
            if deduct_enabled:
                if user.credits is None:
                    user.credits = 0
                if (user.credits or 0) < cost_to_deduct:
                    raise HTTPException(status_code=400, detail="Insufficient credits")
                user.credits = (user.credits or 0) - cost_to_deduct

            # Create a new list to ensure proper JSON serialization
            updated_services = list(user.services)
            updated_services.append(new_subscription)
            user.services = updated_services
            
            logger.info(f"Updated user services: {user.services}")
            if deduct_enabled:
                logger.info(f"Deducting {cost_to_deduct} credits from user {user.username}")
            
            # Flush changes to ensure they're written to the database
            db.flush()
            db.commit()
            db.refresh(user)  # Refresh the user object to get updated data
            logger.info(f"Successfully committed subscription assignment for user {user.username}")
            logger.info(f"Final user services after refresh: {user.services}")
            
            effective_cost = cost_to_deduct if deduct_enabled else 0
            return {
                "message": f"Assigned subscription to {request.username}",
                "credits": user.credits,
                "cost": effective_cost,
                "service_name": request.service_name,
                "assigned_account_id": service_id,
                "account_expiry_days": days,
                "credits_deducted": effective_cost,
                "remaining_credits": user.credits,
            }
        finally:
            db.close()
    except Exception as e:
        # Propagate explicit HTTP errors; otherwise treat as a 400-level validation/assignment failure
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error assigning subscription: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=400, detail="Failed to assign subscription")

def add_credits_to_user(request: AdminAddCredits, current_user: User):
    """Add credits to a user or specific subscription"""
    try:
        db = get_db_session()
        try:
            user = db.query(UserModel).filter(UserModel.username == request.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # If service_id is provided, add credits to that specific subscription
            if hasattr(request, 'service_id') and request.service_id:
                # Find the subscription and add credits to it
                if user.services and isinstance(user.services, list):
                    subscription_found = False
                    for subscription in user.services:
                        if subscription.get("service_id") == request.service_id:
                            subscription["credits"] = (subscription.get("credits", 0) or 0) + request.credits
                            subscription_found = True
                            break
                    
                    if not subscription_found:
                        raise HTTPException(status_code=404, detail="Subscription not found")
                    
                    db.commit()
                    return {
                        "message": f"Added {request.credits} credits to subscription {request.service_id} for {request.username}",
                        # "subscription_credits": subscription.get("credits", 0)
                    }
                else:
                    raise HTTPException(status_code=400, detail="User has no subscriptions")
            else:
                # Add credits to user's global credits (legacy support)
                user.credits = (user.credits or 0) + request.credits
                db.commit()
                return {"message": f"Added {request.credits} credits to {request.username}", "credits": user.credits}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error adding credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def remove_credits_from_user(request: AdminRemoveCredits, current_user: User):
    """Remove credits from a user or specific subscription"""
    try:
        db = get_db_session()
        try:
            user = db.query(UserModel).filter(UserModel.username == request.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            if hasattr(request, 'service_id') and request.service_id:
                if user.services and isinstance(user.services, list):
                    subscription_found = False
                    for subscription in user.services:
                        if subscription.get("service_id") == request.service_id:
                            current = (subscription.get("credits", 0) or 0)
                            new_value = max(0, current - request.credits)
                            subscription["credits"] = new_value
                            subscription_found = True
                            break
                    flag_modified(user, "services")
                    if not subscription_found:
                        raise HTTPException(status_code=404, detail="Subscription not found")
                    db.commit()
                    return {
                        "message": f"Removed {request.credits} credits from subscription {request.service_id} for {request.username}",
                        # "subscription_credits": subscription.get("credits", 0)
                    }
                else:
                    raise HTTPException(status_code=400, detail="User has no subscriptions")
            else:
                # Remove from global credits
                current = user.credits or 0
                user.credits = max(0, current - request.credits)
                db.commit()
                return {"message": f"Removed {request.credits} credits from {request.username}", "credits": user.credits}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error removing credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def remove_user_subscription(request: AdminRemoveSubscription, current_user: User):
    """Remove a subscription from a user by service_id (account id)"""
    try:
        db = get_db_session()
        try:
            user = db.query(UserModel).filter(UserModel.username == request.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            before = len(user.services or [])
            if not user.services or not isinstance(user.services, list):
                raise HTTPException(status_code=400, detail="User has no subscriptions")
            # Match on either service_id or account_id to support legacy/new records
            user.services = [s for s in user.services if (s.get("service_id") != request.service_id and s.get("account_id") != request.service_id)]
            flag_modified(user, "services")
            after = len(user.services)
            if before == after:
                raise HTTPException(status_code=404, detail="Subscription not found")
            db.commit()
            return {"message": f"Removed subscription {request.service_id} from {request.username}", "removed": before - after}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error removing user subscription: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def update_user_subscription_end_date(request: AdminUpdateSubscriptionEndDate, current_user: User):
    """Update the end date of a user's subscription (expects dd/mm/yyyy)"""
    # Validate required fields
    if not request.username:
        raise HTTPException(status_code=400, detail="username field is required")
    if not request.service_id:
        raise HTTPException(status_code=400, detail="service_id field is required")
    
    try:
        db = get_db_session()
        try:
            user = db.query(UserModel).filter(UserModel.username == request.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            if not user.services or not isinstance(user.services, list):
                raise HTTPException(status_code=400, detail="User has no subscriptions")
            updated = False
            for sub in user.services:
                if sub.get("service_id") == request.service_id or sub.get("account_id") == request.service_id:
                    sub["end_date"] = request.end_date
                    # Auto-set is_active depending on date
                    try:
                        from services.service_service import parse_date
                        new_end = parse_date(request.end_date)
                        sub["is_active"] = (new_end - __import__("datetime").datetime.now()).days >= 0
                    except Exception:
                        pass
                    updated = True
                    break
            flag_modified(user, "services")
            if not updated:
                raise HTTPException(status_code=404, detail="Subscription not found")
            db.commit()
            return {"message": f"Updated end date for {request.service_id} to {request.end_date}", "end_date": request.end_date}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error updating subscription end date: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def update_user_subscription_active(request: AdminUpdateSubscriptionActive, current_user: User):
    """Admin: Update is_active flag for a user's subscription by service/account id"""
    try:
        db = get_db_session()
        try:
            user = db.query(UserModel).filter(UserModel.username == request.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            if not user.services or not isinstance(user.services, list):
                raise HTTPException(status_code=400, detail="User has no subscriptions")
            updated = False
            for sub in user.services:
                if sub.get("service_id") == request.service_id or sub.get("account_id") == request.service_id:
                    sub["is_active"] = bool(request.is_active)
                    updated = True
                    break
            if not updated:
                raise HTTPException(status_code=404, detail="Subscription not found")
            flag_modified(user, "services")
            db.commit()
            return {"message": f"Updated is_active for {request.service_id} to {request.is_active}", "is_active": request.is_active}
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating subscription active flag: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_all_users(current_user: User, page: int = 1, size: int = 20, search: str = None):
    """Get paginated users (admin only) with per-subscription credits"""
    try:
        db = get_db_session()
        try:
            q = db.query(UserModel)
            if search:
                like = f"%{search}%"
                from sqlalchemy import or_
                q = q.filter(or_(UserModel.username.ilike(like), UserModel.email.ilike(like)))
            total = q.count()
            page = max(1, int(page or 1))
            size = max(1, int(size or 20))
            items = q.offset((page - 1) * size).limit(size).all()

            users = []
            for user in items:
                users.append({
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "credits": user.credits,
                    "services": user.services or [],
                })
            total_pages = max(1, (total + size - 1) // size)
            return {"users": users, "page": page, "size": size, "total": total, "total_pages": total_pages}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting all users: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_all_admin_services(current_user: User, page: int = 1, size: int = 20, search: str = None):
    """Get paginated services for admin"""
    try:
        db = get_db_session()
        try:
            q = db.query(ServiceModel)
            if search:
                like = f"%{search}%"
                q = q.filter(ServiceModel.name.ilike(like))
            total = q.count()
            page = max(1, int(page or 1))
            size = max(1, int(size or 20))
            items = q.offset((page - 1) * size).limit(size).all()
            services = []
            for service in items:
                services.append({
                    "name": service.name,
                    "image": service.image,
                    "accounts": service.accounts or [],
                })
            total_pages = max(1, (total + size - 1) // size)
            return {"services": services, "page": page, "size": size, "total": total, "total_pages": total_pages}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting all services: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def update_service_credits(service_name: str, credits_map: dict, current_user: User):
    """Update per-duration credits for a service in config"""
    try:
        db = get_db_session()
        try:
            svc = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if not svc:
                raise HTTPException(status_code=404, detail="Service not found")
            svc.credits = credits_map or {}
            db.commit()
            return {"message": f"Updated credits for {service_name}", "service_credits": svc.credits}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error updating service credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_service_credits_admin(service_name: str, current_user: User):
    """Get per-duration credits for a service from config"""
    try:
        db = get_db_session()
        try:
            svc = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if not svc:
                raise HTTPException(status_code=404, detail="Service not found")
            return {"service_name": service_name, "credits": svc.credits or {}}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting service credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def add_service(service_data: dict, current_user: User):
    """Add a new service"""
    try:
        service_name = service_data.get("name")
        if not service_name:
            raise HTTPException(status_code=400, detail="Service name is required")
        db = get_db_session()
        try:
            existing_service = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if existing_service:
                raise HTTPException(status_code=400, detail="Service already exists")
            db.add(ServiceModel(
                name=service_name,
                image=service_data.get("image", ""),
                accounts=service_data.get("accounts", []),
                credits=service_data.get("credits", {}),
            ))
            db.commit()
            return {"message": f"Service {service_name} added successfully"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error adding service: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def update_service(service_name: str, service_data: dict, current_user: User):
    """Update a service"""
    try:
        db = get_db_session()
        try:
            existing_service = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if not existing_service:
                raise HTTPException(status_code=404, detail="Service not found")
            existing_service.name = service_data.get("name", existing_service.name)
            existing_service.image = service_data.get("image", existing_service.image)
            existing_service.accounts = service_data.get("accounts", existing_service.accounts or [])
            if "credits" in service_data:
                existing_service.credits = service_data.get("credits") or {}
            db.commit()
            return {"message": f"Service {service_name} updated successfully"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error updating service: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def delete_service(service_name: str, current_user: User):
    """Delete a service and remove it from all users' subscriptions"""
    try:
        db = get_db_session()
        try:
            service = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if not service:
                raise HTTPException(status_code=404, detail="Service not found")
            
            # Get all account IDs for this service
            service_account_ids = set()
            for account in (service.accounts or []):
                service_account_ids.add(account.get("id"))
            
            logger.info(f"Deleting service '{service_name}' with account IDs: {service_account_ids}")
            
            # Remove this service from all users' subscriptions
            users_updated = 0
            for user in db.query(UserModel).all():
                if user.services and isinstance(user.services, list):
                    original_count = len(user.services)
                    # Filter out subscriptions that belong to this service
                    user.services = [
                        sub for sub in user.services 
                        if sub.get("service_id") not in service_account_ids
                    ]
                    new_count = len(user.services)
                    if original_count != new_count:
                        users_updated += 1
                        logger.info(f"Removed {original_count - new_count} subscriptions from user {user.username}")
            
            # Delete the service
            db.delete(service)
            db.commit()
            
            return {
                "message": f"Service {service_name} deleted successfully",
                "users_updated": users_updated,
                "account_ids_removed": list(service_account_ids)
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error deleting service: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_service_details(service_name: str, current_user: User):
    """Get detailed information about a specific service"""
    try:
        db = get_db_session()
        try:
            service = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if not service:
                raise HTTPException(status_code=404, detail="Service not found")
            return {
                "service_name": service_name,
                "name": service.name,
                "image": service.image,
                "accounts": service.accounts or [],
                "credits": service.credits or {},
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting service details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 

def get_user_subscriptions_admin(username: str, current_user: User):
    """Admin: Get subscriptions for a specific user by username"""
    try:
        db = get_db_session()
        try:
            user = db.query(UserModel).filter(UserModel.username == username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            subscriptions = []
            # Resolve service and account details for each subscription
            services = {s.name: s for s in db.query(ServiceModel).all()}
            for sub in (user.services or []):
                matched = None
                for svc in services.values():
                    for acc in (svc.accounts or []):
                        if acc.get("id") == sub.get("service_id") or acc.get("id") == sub.get("account_id"):
                            matched = (svc, acc)
                            break
                    if matched:
                        break
                if matched:
                    svc, acc = matched
                    subscriptions.append({
                        "service_name": svc.name,
                        "service_image": svc.image,
                        "account_id": acc.get("id"),
                        "password": acc.get("password", ""),
                        "end_date": sub.get("end_date"),
                        "is_active": sub.get("is_active", True),
                        "credits": sub.get("credits", 0),
                    })

            return {"username": username, "credits": user.credits, "subscriptions": subscriptions}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting user subscriptions (admin): {e}")
        raise HTTPException(status_code=500, detail="Internal server error")