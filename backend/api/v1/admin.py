from fastapi import APIRouter, Depends
from schemas.user_schema import AdminAssignSubscription, AdminAddCredits, AdminRemoveCredits, AdminRemoveSubscription, AdminUpdateSubscriptionEndDate, User
from api.dependencies import get_current_user, admin_required
from services.admin_service import assign_subscription, add_credits_to_user, remove_credits_from_user, remove_user_subscription, update_user_subscription_end_date, get_all_users, get_all_admin_services, add_service, update_service, delete_service, get_service_details, get_user_subscriptions_admin, update_service_credits, get_service_credits_admin
from utils.responses import no_store_json

router = APIRouter()

@router.post("/admin/assign-subscription")
def assign_sub(request: AdminAssignSubscription, current_user: User = Depends(admin_required)):
    return no_store_json(assign_subscription(request, current_user))

@router.post("/admin/add-credits")
def add_credits(request: AdminAddCredits, current_user: User = Depends(admin_required)):
    return no_store_json(add_credits_to_user(request, current_user))

@router.post("/admin/remove-credits")
def remove_credits(request: AdminRemoveCredits, current_user: User = Depends(admin_required)):
    return no_store_json(remove_credits_from_user(request, current_user))
@router.get("/admin/users")
def all_users(current_user: User = Depends(admin_required)):
    return no_store_json(get_all_users(current_user))

@router.get("/admin/services")
def all_services(current_user: User = Depends(admin_required)):
    return no_store_json(get_all_admin_services(current_user))

@router.post("/admin/services")
def add_admin_service(service_data: dict, current_user: User = Depends(admin_required)):
    return no_store_json(add_service(service_data, current_user))

@router.put("/admin/services/{service_name}")
def update_admin_service(service_name: str, service_data: dict, current_user: User = Depends(admin_required)):
    return no_store_json(update_service(service_name, service_data, current_user))

@router.delete("/admin/services/{service_name}")
def delete_admin_service(service_name: str, current_user: User = Depends(admin_required)):
    return no_store_json(delete_service(service_name, current_user))

@router.get("/admin/services/{service_name}")
def get_admin_service_details(service_name: str, current_user: User = Depends(admin_required)):
    return no_store_json(get_service_details(service_name, current_user)) 

@router.get("/admin/users/{username}/subscriptions")
def get_admin_user_subscriptions(username: str, current_user: User = Depends(admin_required)):
    return no_store_json(get_user_subscriptions_admin(username, current_user))

@router.post("/admin/users/remove-subscription")
def admin_remove_subscription(request: AdminRemoveSubscription, current_user: User = Depends(admin_required)):
    return no_store_json(remove_user_subscription(request, current_user))

@router.post("/admin/users/update-subscription-end-date")
def admin_update_subscription_end_date(request: AdminUpdateSubscriptionEndDate, current_user: User = Depends(admin_required)):
    return no_store_json(update_user_subscription_end_date(request, current_user))      

@router.get("/admin/services/{service_name}/credits")
def get_admin_service_credits(service_name: str, current_user: User = Depends(admin_required)):
    return no_store_json(get_service_credits_admin(service_name, current_user))

@router.put("/admin/services/{service_name}/credits")
def put_admin_service_credits(service_name: str, credits_map: dict, current_user: User = Depends(admin_required)):
    return no_store_json(update_service_credits(service_name, credits_map, current_user))
