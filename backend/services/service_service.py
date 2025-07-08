from schemas.user_schema import User, SubscriptionPurchase
from db.base import get_fake_users_db, get_fake_services_db
from db.mongodb import get_sync_users_collection, get_sync_services_collection, get_sync_refresh_tokens_collection
from core.security import create_access_token
from core.config import settings
from fastapi import HTTPException
from datetime import timedelta, datetime
import logging

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
    """Get all available services with detailed account information"""
    try:
        services_collection = get_sync_services_collection()
        services = []
        today = datetime.now()
        
        for service in services_collection.find():
            available_accounts = []
            
            for account in service["accounts"]:
                if account["is_active"]:
                    end_date = parse_date(account["end_date"])
                    days_until_expiry = (end_date - today).days
                    
                    available_accounts.append({
                        "id": account["id"],
                        "days_until_expiry": days_until_expiry,
                        "end_date": account["end_date"]
                    })
            
            services.append({
                "name": service["name"],
                "image": service["image"],
                "available_accounts": len(available_accounts),
                "total_accounts": len(service["accounts"]),
                "available": available_accounts
            })
        
        return {"services": services}
    except Exception as e:
        logger.error(f"Error getting services: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def purchase_subscription(request: SubscriptionPurchase, current_user: User):
    """Purchase a subscription or extend existing one"""
    try:
        users_collection = get_sync_users_collection()
        user = users_collection.find_one({"username": current_user.username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get subscription cost from config
        from core.config import config
        subscription_durations = config.get_subscription_durations()
        duration_config = subscription_durations.get(request.duration)
        
        if not duration_config:
            raise HTTPException(status_code=400, detail="Invalid subscription duration")
        
        cost = duration_config["credits_cost"]
        
        if user["credits"] < cost:
            raise HTTPException(status_code=400, detail="Insufficient credits")
        
        # Check if user already has a subscription for this service
        existing_subscription = None
        for service in user["services"]:
            # Try to match service by checking if the service_id corresponds to the requested service
            service_name = request.service_name
            services_collection = get_sync_services_collection()
            service_data = services_collection.find_one({"name": service_name})
            
            if service_data:
                # Check if any account in this service matches the user's service_id
                for account in service_data["accounts"]:
                    if account["id"] == service["service_id"]:
                        existing_subscription = service
                        break
                if existing_subscription:
                    break
        
        if existing_subscription:
            # User has existing subscription - check if extension is possible
            services_collection = get_sync_services_collection()
            service_data = services_collection.find_one({"name": request.service_name})
            if not service_data:
                raise HTTPException(status_code=404, detail="Service not found")
            
            # Check if there are accounts that can extend the subscription
            current_end_date = parse_date(existing_subscription["end_date"])
            today = datetime.now()
            
            # Find the latest possible end date from available accounts
            max_possible_end_date = current_end_date
            has_extendable_accounts = False
            
            for account in service_data["accounts"]:
                if account["is_active"]:
                    account_end_date = parse_date(account["end_date"])
                    if account_end_date > current_end_date:
                        has_extendable_accounts = True
                        if account_end_date > max_possible_end_date:
                            max_possible_end_date = account_end_date
            
            if not has_extendable_accounts:
                raise HTTPException(status_code=400, detail="No accounts available that can extend your subscription beyond its current end date")
            
            # Calculate maximum additional days possible
            max_additional_days = (max_possible_end_date - current_end_date).days
            requested_days = duration_config["days"]
            
            if requested_days > max_additional_days:
                raise HTTPException(status_code=400, detail=f"Requested duration ({requested_days} days) exceeds maximum possible extension ({max_additional_days} days)")
            
            # Extend the subscription
            new_end_date = current_end_date + timedelta(days=requested_days)
            new_end_date_str = format_date(new_end_date)
            
            # Update user's subscription
            users_collection.update_one(
                {"username": current_user.username, "services.service_id": existing_subscription["service_id"]},
                {"$set": {"services.$.end_date": new_end_date_str}}
            )
            
            # Deduct credits
            users_collection.update_one(
                {"username": current_user.username},
                {"$inc": {"credits": -cost}}
            )
            
            return {
                "message": f"Extended subscription by {duration_config['name']}",
                "credits": user["credits"] - cost,
                "cost": cost,
                "extension": True,
                "new_end_date": new_end_date_str
            }
        else:
            # New subscription - check if service has available accounts
            services_collection = get_sync_services_collection()
            service_data = services_collection.find_one({"name": request.service_name})
            if not service_data:
                raise HTTPException(status_code=404, detail="Service not found")
            
            # Check if there are any available accounts
            available_accounts = [acc for acc in service_data["accounts"] if acc["is_active"]]
            if not available_accounts:
                raise HTTPException(status_code=400, detail="No available accounts for this service")
            
            # Check if any account can support the requested duration
            today = datetime.now()
            max_available_days = 0
            
            for account in available_accounts:
                account_end_date = parse_date(account["end_date"])
                days_until_expiry = (account_end_date - today).days
                if days_until_expiry > max_available_days:
                    max_available_days = days_until_expiry
            
            if duration_config["days"] > max_available_days:
                raise HTTPException(status_code=400, detail=f"Requested duration ({duration_config['days']} days) exceeds maximum available days ({max_available_days} days)")
            
            # Deduct credits
            users_collection.update_one(
                {"username": current_user.username},
                {"$inc": {"credits": -cost}}
            )
            
            # Add new subscription
            users_collection.update_one(
                {"username": current_user.username},
                {"$push": {"services": {
                    "service_id": f"service_{request.duration}",
                    "end_date": "31/12/2025",
                    "is_active": True
                }}}
            )
            
            return {
                "message": f"Purchased {duration_config['name']} subscription",
                "credits": user["credits"] - cost,
                "cost": cost,
                "extension": False
            }
    except Exception as e:
        logger.error(f"Error purchasing subscription: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_user_subscriptions(current_user: User):
    """Get user's subscriptions with detailed information"""
    try:
        users_collection = get_sync_users_collection()
        user_record = users_collection.find_one({"username": current_user.username})
        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")
        
        subscriptions = []
        seen_service_ids = set()  # To avoid duplicates
        
        for service in user_record.get("services", []):
            # Skip if we've already seen this service_id
            if service["service_id"] in seen_service_ids:
                continue
            seen_service_ids.add(service["service_id"])
            
            # Find service details from services collection
            service_name = "Unknown Service"
            service_image = "https://via.placeholder.com/300x200/6B7280/FFFFFF?text=Service"
            account_id = service["service_id"]
            password = "password123"  # Default password
            
            # Try to find matching service in services collection
            services_collection = get_sync_services_collection()
            for service_doc in services_collection.find():
                for account in service_doc["accounts"]:
                    if account["id"] == service["service_id"]:
                        service_name = service_doc["name"]
                        service_image = service_doc["image"]
                        password = account["password"]
                        break
                if service_name != "Unknown Service":
                    break
            
            subscriptions.append({
                "service_name": service_name,
                "service_image": service_image,
                "account_id": account_id,
                "password": password,
                "end_date": service["end_date"],
                "is_active": service["is_active"]
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
        tokens_collection = get_sync_refresh_tokens_collection()
        token_doc = tokens_collection.find_one({"refresh_token": refresh_token})
        
        if not token_doc:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        username = token_doc["username"]
        users_collection = get_sync_users_collection()
        user = users_collection.find_one({"username": username})
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        access_token = create_access_token(
            data={"sub": user["username"], "email": user["email"], "user_id": user["user_id"], "role": user["role"]},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token}
    except Exception as e:
        logger.error(f"Error refreshing access token: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 