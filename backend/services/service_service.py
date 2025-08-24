from schemas.user_schema import User, SubscriptionPurchase
from config import config
from db.session import SessionLocal
from db.models.user import User as UserModel
from db.models.service import Service as ServiceModel
from db.models.refresh_token import RefreshToken
from core.security import create_access_token
from core.config import settings
import json
import os
from fastapi import HTTPException
from datetime import timedelta, datetime
import logging
from sqlalchemy.orm.attributes import flag_modified

logger = logging.getLogger(__name__)

def parse_date(date_string: str) -> datetime:
    """Parse date string in dd/mm/yyyy format"""
    try:
        return datetime.strptime(date_string, "%d/%m/%Y")
    except ValueError:
        # Try the old format as fallback
        return datetime.strptime(date_string, "%Y-%m-%d")

def format_date(date_obj: datetime) -> str:
    """Format datetime object to dd/mm/yyyy format"""
    return date_obj.strftime("%d/%m/%Y")

def get_services():
    """Get all available services with aggregated account information"""
    try:
        db = SessionLocal()
        services = []
        today = datetime.now()
        try:
            for service in db.query(ServiceModel).all():
                available_accounts = []
                max_days_until_expiry = 0
                max_end_date = ""
                
                for account in (service.accounts or []):
                    if account["is_active"]:
                        end_date = parse_date(account["end_date"])
                        days_until_expiry = (end_date - today).days
                        
                        if days_until_expiry > max_days_until_expiry:
                            max_days_until_expiry = days_until_expiry
                            max_end_date = account["end_date"]
                        
                        available_accounts.append({
                            "id": account["id"],
                            "days_until_expiry": days_until_expiry,
                            "end_date": account["end_date"]
                        })
                
                services.append({
                    "name": service.name,
                    "image": service.image,
                    "available_accounts": len(available_accounts),
                    "total_accounts": len(service.accounts or []),
                    "max_days_until_expiry": max_days_until_expiry,
                    "max_end_date": max_end_date,
                    "credits": service.credits or {}
                })
            return {"services": services}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting services: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def purchase_subscription(request: SubscriptionPurchase, current_user: User):
    """Purchase a subscription - assign user to a specific account"""
    try:
        # Get user from database
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == current_user.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
        finally:
            db.close()
        
        # Load durations config
        subscription_durations = config.get_subscription_durations()
        duration_config = subscription_durations.get(request.duration)
        if not duration_config:
            raise HTTPException(status_code=400, detail="Invalid subscription duration")
        requested_days = int(duration_config.get("days", 0))
        
        # Get service data
        db = SessionLocal()
        try:
            service_data = db.query(ServiceModel).filter(ServiceModel.name == request.service_name).first()
            if not service_data:
                raise HTTPException(status_code=404, detail="Service not found")
            # Determine cost: prefer per-service override, fallback to global duration cost
            service_credits_map = service_data.credits or {}
            try:
                cost_to_deduct = int(service_credits_map.get(request.duration, duration_config.get("credits_cost", 0)))
            except Exception:
                cost_to_deduct = int(duration_config.get("credits_cost", 0))
        finally:
            db.close()
        
        # Check credits
        current_credits = user.credits or 0
        if current_credits < cost_to_deduct:
            raise HTTPException(status_code=400, detail="Insufficient credits")
        
        # Check service has available accounts
        available_accounts = [acc for acc in (service_data.accounts or []) if acc.get("is_active")]
        if not available_accounts:
            raise HTTPException(status_code=400, detail="No available accounts for this service")
        
        # Helper dates
        today = datetime.now()
        
        # Find existing subscription for this service
        existing_subscription = None
        if user.services:
            for sub in user.services:
                if sub.get("service_name") == request.service_name:
                    existing_subscription = sub
                    break
        
        # Identify assigned account for extension (if any)
        assigned_account = None
        if existing_subscription and existing_subscription.get("account_id"):
            for acc in available_accounts:
                if acc.get("id") == existing_subscription.get("account_id"):
                    assigned_account = acc
                    break
        
        # If no assigned account yet (new purchase), pick one that can satisfy requested days
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
        
        # Calculate new end date respecting account expiry
        acc_end_date = parse_date(assigned_account["end_date"]) if isinstance(assigned_account.get("end_date"), str) else assigned_account.get("end_date")
        if not acc_end_date:
            raise HTTPException(status_code=400, detail="Invalid service account end date")
        
        if existing_subscription:
            # Extension: base date is later of current end or today
            current_end = parse_date(existing_subscription["end_date"]) if isinstance(existing_subscription.get("end_date"), str) else existing_subscription.get("end_date")
            base_date = current_end if current_end and current_end > today else today
            proposed_end = base_date + timedelta(days=requested_days)
            if proposed_end > acc_end_date:
                raise HTTPException(status_code=400, detail="Requested extension exceeds account expiry")
            # Persist update
            db = SessionLocal()
            try:
                db_user = db.query(UserModel).filter(UserModel.username == current_user.username).first()
                # Update in-place in JSON field
                for sub in (db_user.services or []):
                    if sub.get("service_name") == request.service_name:
                        sub["end_date"] = format_date(proposed_end)
                        sub["last_extension"] = format_date(today)
                        sub["extension_duration"] = request.duration
                        sub["total_duration"] = int(sub.get("total_duration", 0)) + requested_days
                        break
                # Deduct credits
                if (db_user.credits or 0) < cost_to_deduct:
                    raise HTTPException(status_code=400, detail="Insufficient credits")
                db_user.credits = (db_user.credits or 0) - cost_to_deduct
                # Mark JSON modified
                flag_modified(db_user, "services")
                db.flush()
                db.commit()
                db.refresh(db_user)
                updated_credits = db_user.credits or 0
                new_end_date_str = format_date(proposed_end)
            finally:
                db.close()
            return {
                "message": f"Extended {request.service_name} by {duration_config.get('name', request.duration)}",
                "extension": True,
                "new_end_date": new_end_date_str,
                "credits": updated_credits,
                "cost": cost_to_deduct,
            }
        else:
            # New assignment
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
            db = SessionLocal()
            try:
                db_user = db.query(UserModel).filter(UserModel.username == current_user.username).first()
                current_services = list(db_user.services or [])
                current_services.append(new_subscription)
                db_user.services = current_services
                # Deduct credits
                if (db_user.credits or 0) < cost_to_deduct:
                    raise HTTPException(status_code=400, detail="Insufficient credits")
                db_user.credits = (db_user.credits or 0) - cost_to_deduct
                flag_modified(db_user, "services")
                db.flush()
                db.commit()
                db.refresh(db_user)
                updated_credits = db_user.credits or 0
            finally:
                db.close()
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

def get_user_subscriptions(current_user: User):
    """Get user's subscriptions with detailed account assignment information"""
    try:
        # Load user
        db = SessionLocal()
        try:
            user_record = db.query(UserModel).filter(UserModel.username == current_user.username).first()
        finally:
            db.close()
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Preload services and build account lookup by account id
        db = SessionLocal()
        try:
            service_list = db.query(ServiceModel).all()
        finally:
            db.close()
        account_id_to_info = {}
        service_name_to_image = {}
        for svc in service_list:
            service_name_to_image[svc.name] = svc.image
            for acc in (svc.accounts or []):
                acc_id = acc.get("id")
                if acc_id:
                    account_id_to_info[acc_id] = {"service": svc, "account": acc}
        
        # Load duration map for fallback computation
        durations_map = config.get_subscription_durations()
        
        subscriptions = []
        seen_service_ids = set()
        
        for sub in (user_record.services or []):
            # Determine account id (prefer explicit account_id, fallback to legacy service_id)
            account_id = sub.get("account_id") or sub.get("service_id") or "Unknown"
            # Avoid duplicate entries by service_id string
            sid_key = sub.get("service_id") or account_id
            if sid_key in seen_service_ids:
                continue
            seen_service_ids.add(sid_key)
            
            # Resolve service and account details
            resolved = account_id_to_info.get(account_id)
            if resolved:
                svc = resolved["service"]
                acc = resolved["account"]
                service_name = svc.name
                service_image = svc.image
                account_username = acc.get("username", "")
                account_password = acc.get("password", "")
            else:
                # Fallback using service_name if available
                service_name = sub.get("service_name", "Unknown Service")
                service_image = service_name_to_image.get(service_name, "https://via.placeholder.com/300x200/6B7280/FFFFFF?text=Service")
                account_username = sub.get("account_username", "")
                account_password = sub.get("account_password", "")
            
            # Compute total_duration from dates with sensible fallbacks
            total_duration_days = 0
            try:
                end_date_str = sub.get("end_date")
                end_date = parse_date(end_date_str) if isinstance(end_date_str, str) else end_date_str
                start_str = sub.get("assignment_date") or sub.get("created_date")
                start_date = parse_date(start_str) if isinstance(start_str, str) else start_str
                if not start_date:
                    # Fallback: use configured duration days if possible
                    duration_key = sub.get("duration")
                    if duration_key and duration_key in durations_map:
                        total_duration_days = int(durations_map[duration_key].get("days", 0))
                    else:
                        total_duration_days = 0
                elif end_date:
                    total_duration_days = max(0, (end_date - start_date).days)
            except Exception:
                # Last resort: keep any stored value if present, else 0
                total_duration_days = int(sub.get("total_duration", 0) or 0)
            
            subscriptions.append({
                "service_name": service_name,
                "service_image": service_image,
                "account_id": account_id,
                "account_username": account_username,
                "account_password": account_password,
                "end_date": sub.get("end_date"),
                "is_active": sub.get("is_active", True),
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

def refresh_access_token(request: dict):
    """Refresh access token"""
    try:
        refresh_token = request.get("refresh_token")
        if not refresh_token:
            raise HTTPException(status_code=400, detail="Refresh token required")
        
        # Find user by refresh token
        # Check token in DB
        db = SessionLocal()
        try:
            token_doc = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
        finally:
            db.close()
        
        if not token_doc:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        username = token_doc.username
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == username).first()
        finally:
            db.close()
        
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
