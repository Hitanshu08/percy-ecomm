from fastapi import APIRouter, Depends
from schemas.user_schema import User as UserSchema, SubscriptionPurchase
from api.dependencies import get_current_user
from db.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from services.service_service import get_services, purchase_subscription, get_user_subscriptions, refresh_access_token
from utils.responses import no_store_json
from utils.timing import timeit

router = APIRouter()

@timeit()
@router.get("/services")
async def list_services(current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await get_services(current_user, db))

@timeit()
@router.post("/purchase-subscription")
async def purchase_sub(request: SubscriptionPurchase, current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await purchase_subscription(request, current_user, db))

@timeit()
@router.get("/subscriptions")
async def get_subscriptions(current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await get_user_subscriptions(current_user, db))

@timeit()
@router.post("/refresh")
async def refresh_token(request: dict, db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await refresh_access_token(request, db))