from schemas.user_schema import AdminAssignSubscription, AdminAddCredits, User
from config import config
from db.session import SessionLocal
from db.models.user import User as UserModel
from db.models.service import Service as ServiceModel
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

def assign_subscription(request: AdminAssignSubscription, current_user: User):
    """Assign subscription to user"""
    try:
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == request.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

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
                cost_to_deduct = duration_cfg["credits_cost"]
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

            # Validate selected account exists
            service_found = False
            for service in db.query(ServiceModel).all():
                for account in (service.accounts or []):
                    if account.get("id") == service_id:
                        service_found = True
                        break
                if service_found:
                    break
            if not service_found:
                raise HTTPException(status_code=404, detail="Service account not found")

            # Deduct credits
            if user.credits is None:
                user.credits = 0
            if user.credits < cost_to_deduct:
                raise HTTPException(status_code=400, detail="Insufficient credits for assignment")
            user.credits -= cost_to_deduct

            current_services = user.services or []
            current_services.append({
                "service_id": service_id,
                "end_date": end_date,
                "is_active": True,
            })
            user.services = current_services
            db.commit()
            return {"message": f"Assigned subscription to {request.username}", "credits": user.credits, "cost": cost_to_deduct}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error assigning subscription: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def add_credits_to_user(request: AdminAddCredits, current_user: User):
    """Add credits to a user"""
    try:
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == request.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            user.credits = (user.credits or 0) + request.credits
            db.commit()
            return {"message": f"Added {request.credits} credits to {request.username}", "credits": user.credits}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error adding credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_all_users(current_user: User):
    """Get all users (admin only)"""
    try:
        db = SessionLocal()
        try:
            users = []
            for user in db.query(UserModel).all():
                users.append({
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "credits": user.credits,
                    "services": user.services or [],
                })
            return {"users": users}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting all users: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_all_admin_services(current_user: User):
    """Get all services for admin"""
    try:
        db = SessionLocal()
        try:
            services = []
            for service in db.query(ServiceModel).all():
                services.append({
                    "name": service.name,
                    "image": service.image,
                    "accounts": service.accounts or [],
                })
            return {"services": services}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting all services: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def add_service(service_data: dict, current_user: User):
    """Add a new service"""
    try:
        service_name = service_data.get("name")
        if not service_name:
            raise HTTPException(status_code=400, detail="Service name is required")
        db = SessionLocal()
        try:
            existing_service = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if existing_service:
                raise HTTPException(status_code=400, detail="Service already exists")
            db.add(ServiceModel(
                name=service_name,
                image=service_data.get("image", ""),
                accounts=service_data.get("accounts", []),
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
        db = SessionLocal()
        try:
            existing_service = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if not existing_service:
                raise HTTPException(status_code=404, detail="Service not found")
            existing_service.name = service_data.get("name", existing_service.name)
            existing_service.image = service_data.get("image", existing_service.image)
            existing_service.accounts = service_data.get("accounts", existing_service.accounts or [])
            db.commit()
            return {"message": f"Service {service_name} updated successfully"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error updating service: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def delete_service(service_name: str, current_user: User):
    """Delete a service"""
    try:
        db = SessionLocal()
        try:
            service = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if not service:
                raise HTTPException(status_code=404, detail="Service not found")
            db.delete(service)
            db.commit()
            return {"message": f"Service {service_name} deleted successfully"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error deleting service: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_service_details(service_name: str, current_user: User):
    """Get detailed information about a specific service"""
    try:
        db = SessionLocal()
        try:
            service = db.query(ServiceModel).filter(ServiceModel.name == service_name).first()
            if not service:
                raise HTTPException(status_code=404, detail="Service not found")
            return {
                "service_name": service_name,
                "name": service.name,
                "image": service.image,
                "accounts": service.accounts or [],
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting service details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 

def get_user_subscriptions_admin(username: str, current_user: User):
    """Admin: Get subscriptions for a specific user by username"""
    try:
        db = SessionLocal()
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
                        if acc.get("id") == sub.get("service_id"):
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
                    })

            return {"username": username, "credits": user.credits, "subscriptions": subscriptions}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting user subscriptions (admin): {e}")
        raise HTTPException(status_code=500, detail="Internal server error")