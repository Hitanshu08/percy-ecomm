from fastapi import APIRouter, Depends
from schemas.user_schema import AdminAssignSubscription, AdminAddCredits, AdminRemoveCredits, AdminRemoveSubscription, AdminUpdateSubscriptionEndDate, AdminUpdateSubscriptionActive, User
from api.dependencies import admin_required
from db.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from services.admin_service_async import assign_subscription, add_credits_to_user, remove_credits_from_user, remove_user_subscription, update_user_subscription_end_date, update_user_subscription_active, get_all_users, get_all_admin_services, add_service, update_service, delete_service, get_service_details, get_user_subscriptions_admin, update_service_credits, get_service_credits_admin
from utils.responses import no_store_json
from utils.timing import timeit

router = APIRouter()

@timeit()
@router.post("/admin/assign-subscription")
async def assign_sub(request: AdminAssignSubscription, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await assign_subscription(request, current_user, db))

@timeit()
@router.post("/admin/add-credits")
async def add_credits(request: AdminAddCredits, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await add_credits_to_user(request, current_user, db))

@timeit()
@router.post("/admin/remove-credits")
async def remove_credits(request: AdminRemoveCredits, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await remove_credits_from_user(request, current_user, db))
@timeit()
@router.get("/admin/users")
async def all_users(page: int = 1, size: int = 20, search: str = None, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await get_all_users(current_user, page=page, size=size, search=search, db=db))

@timeit()
@router.get("/admin/services")
async def all_services(page: int = 1, size: int = 20, search: str = None, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await get_all_admin_services(current_user, page=page, size=size, search=search, db=db))

@timeit()
@router.post("/admin/services")
async def add_admin_service(service_data: dict, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await add_service(service_data, current_user, db))

@timeit()
@router.put("/admin/services/{service_name}")
async def update_admin_service(service_name: str, service_data: dict, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await update_service(service_name, service_data, current_user, db))

@timeit()
@router.delete("/admin/services/{service_name}")
async def delete_admin_service(service_name: str, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await delete_service(service_name, current_user, db))

@timeit()
@router.get("/admin/services/{service_name}")
async def get_admin_service_details(service_name: str, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await get_service_details(service_name, current_user, db)) 

@timeit()
@router.get("/admin/users/{username}/subscriptions")
async def get_admin_user_subscriptions(username: str, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await get_user_subscriptions_admin(username, current_user, db))

@timeit()
@router.post("/admin/users/remove-subscription")
async def admin_remove_subscription(request: AdminRemoveSubscription, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await remove_user_subscription(request, current_user, db))

@timeit()
@router.post("/admin/users/update-subscription-end-date")
async def admin_update_subscription_end_date(request: AdminUpdateSubscriptionEndDate, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await update_user_subscription_end_date(request, current_user, db))      

@timeit()
@router.post("/admin/users/update-subscription-active")
async def admin_update_subscription_active(request: AdminUpdateSubscriptionActive, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await update_user_subscription_active(request, current_user, db))

@timeit()
@router.get("/admin/services/{service_name}/credits")
async def get_admin_service_credits(service_name: str, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await get_service_credits_admin(service_name, current_user, db))

@timeit()
@router.put("/admin/services/{service_name}/credits")
async def put_admin_service_credits(service_name: str, credits_map: dict, current_user: User = Depends(admin_required), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await update_service_credits(service_name, credits_map, current_user, db))
