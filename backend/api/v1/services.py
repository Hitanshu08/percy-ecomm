from fastapi import APIRouter, Depends
from schemas.user_schema import User as UserSchema, SubscriptionPurchase
from api.dependencies import get_current_user
from services.service_service import get_services, purchase_subscription, get_user_subscriptions, refresh_access_token

router = APIRouter()

@router.get("/services")
def list_services():
    return get_services()

@router.post("/purchase-subscription")
def purchase_sub(request: SubscriptionPurchase, current_user: UserSchema = Depends(get_current_user)):
    return purchase_subscription(request, current_user)

@router.get("/subscriptions")
def get_subscriptions(current_user: UserSchema = Depends(get_current_user)):
    return get_user_subscriptions(current_user)

@router.post("/refresh")
def refresh_token(request: dict):
    return refresh_access_token(request) 