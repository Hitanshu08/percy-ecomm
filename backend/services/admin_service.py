from schemas.user_schema import AdminAssignSubscription, AdminAddCredits, User
from db.base import get_fake_users_db, get_fake_services_db
from db.mongodb import get_sync_users_collection, get_sync_services_collection
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

def assign_subscription(request: AdminAssignSubscription, current_user: User):
    """Assign subscription to user"""
    try:
        users_collection = get_sync_users_collection()
        user = users_collection.find_one({"username": request.username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if service exists
        services_collection = get_sync_services_collection()
        service_found = False
        for service in services_collection.find():
            for account in service["accounts"]:
                if account["id"] == request.service_id:
                    service_found = True
                    break
            if service_found:
                break
        
        if not service_found:
            raise HTTPException(status_code=404, detail="Service account not found")
        
        # Add subscription to user
        users_collection.update_one(
            {"username": request.username},
            {"$push": {"services": {
                "service_id": request.service_id,
                "end_date": request.end_date,
                "is_active": True
            }}}
        )
        return {"message": f"Assigned subscription to {request.username}"}
    except Exception as e:
        logger.error(f"Error assigning subscription: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def add_credits_to_user(request: AdminAddCredits, current_user: User):
    """Add credits to a user"""
    try:
        users_collection = get_sync_users_collection()
        result = users_collection.update_one(
            {"username": request.username},
            {"$inc": {"credits": request.credits}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get updated user to return current credits
        user = users_collection.find_one({"username": request.username})
        return {"message": f"Added {request.credits} credits to {request.username}", "credits": user["credits"]}
    except Exception as e:
        logger.error(f"Error adding credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_all_users(current_user: User):
    """Get all users (admin only)"""
    try:
        users_collection = get_sync_users_collection()
        users = []
        for user in users_collection.find({}, {"hashed_password": 0, "profile": 0}):
            users.append({
                "username": user["username"],
                "email": user["email"],
                "role": user["role"],
                "credits": user["credits"],
                "services": user["services"]
            })
        return {"users": users}
    except Exception as e:
        logger.error(f"Error getting all users: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_all_admin_services(current_user: User):
    """Get all services for admin"""
    try:
        services_collection = get_sync_services_collection()
        services = []
        for service in services_collection.find():
            services.append({
                "name": service["name"],
                "image": service["image"],
                "accounts": service["accounts"]
            })
        return {"services": services}
    except Exception as e:
        logger.error(f"Error getting all services: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def add_service(service_data: dict, current_user: User):
    """Add a new service"""
    try:
        service_name = service_data.get("name")
        if not service_name:
            raise HTTPException(status_code=400, detail="Service name is required")
        
        services_collection = get_sync_services_collection()
        existing_service = services_collection.find_one({"name": service_name})
        if existing_service:
            raise HTTPException(status_code=400, detail="Service already exists")
        
        services_collection.insert_one({
            "name": service_name,
            "image": service_data.get("image", ""),
            "accounts": service_data.get("accounts", [])
        })
        
        return {"message": f"Service {service_name} added successfully"}
    except Exception as e:
        logger.error(f"Error adding service: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def update_service(service_name: str, service_data: dict, current_user: User):
    """Update a service"""
    try:
        services_collection = get_sync_services_collection()
        existing_service = services_collection.find_one({"name": service_name})
        if not existing_service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        update_data = {
            "name": service_data.get("name", service_name),
            "image": service_data.get("image", existing_service["image"]),
            "accounts": service_data.get("accounts", existing_service["accounts"])
        }
        
        services_collection.update_one(
            {"name": service_name},
            {"$set": update_data}
        )
        
        return {"message": f"Service {service_name} updated successfully"}
    except Exception as e:
        logger.error(f"Error updating service: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def delete_service(service_name: str, current_user: User):
    """Delete a service"""
    try:
        services_collection = get_sync_services_collection()
        result = services_collection.delete_one({"name": service_name})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Service not found")
        
        return {"message": f"Service {service_name} deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting service: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_service_details(service_name: str, current_user: User):
    """Get detailed information about a specific service"""
    try:
        services_collection = get_sync_services_collection()
        service = services_collection.find_one({"name": service_name})
        
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        return {
            "service_name": service_name,
            "name": service["name"],
            "image": service["image"],
            "accounts": service["accounts"]
        }
    except Exception as e:
        logger.error(f"Error getting service details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 