from fastapi import APIRouter, Depends
from schemas.user_schema import AdminAssignSubscription, AdminAddCredits, User
from api.dependencies import get_current_user, admin_required
from services.admin_service import assign_subscription, add_credits_to_user, get_all_users, get_all_admin_services, add_service, update_service, delete_service, get_service_details, get_user_subscriptions_admin

router = APIRouter()

@router.post("/admin/assign-subscription")
def assign_sub(request: AdminAssignSubscription, current_user: User = Depends(admin_required)):
    return assign_subscription(request, current_user)

@router.post("/admin/add-credits")
def add_credits(request: AdminAddCredits, current_user: User = Depends(admin_required)):
    return add_credits_to_user(request, current_user)

@router.get("/admin/users")
def all_users(current_user: User = Depends(admin_required)):
    return get_all_users(current_user)

@router.get("/admin/services")
def all_services(current_user: User = Depends(admin_required)):
    return get_all_admin_services(current_user)

@router.post("/admin/services")
def add_admin_service(service_data: dict, current_user: User = Depends(admin_required)):
    return add_service(service_data, current_user)

@router.put("/admin/services/{service_name}")
def update_admin_service(service_name: str, service_data: dict, current_user: User = Depends(admin_required)):
    return update_service(service_name, service_data, current_user)

@router.delete("/admin/services/{service_name}")
def delete_admin_service(service_name: str, current_user: User = Depends(admin_required)):
    return delete_service(service_name, current_user)

@router.get("/admin/services/{service_name}")
def get_admin_service_details(service_name: str, current_user: User = Depends(admin_required)):
    return get_service_details(service_name, current_user) 

@router.get("/admin/users/{username}/subscriptions")
def get_admin_user_subscriptions(username: str, current_user: User = Depends(admin_required)):
    return get_user_subscriptions_admin(username, current_user)
