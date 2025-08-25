from fastapi import APIRouter, Depends, HTTPException, status
from schemas.user_schema import User as UserSchema, UserCreate, ChangePasswordRequest
from api.dependencies import get_current_user
from services.user_service import change_password, get_user_profile, create_user
from services.service_service import get_user_subscriptions
from utils.responses import no_store_json

router = APIRouter()

@router.post("/signup", response_model=dict)
def signup(user: UserCreate):
    return create_user(user)

@router.get("/me", response_model=UserSchema)
def read_users_me(current_user: UserSchema = Depends(get_current_user)):
    return no_store_json(get_user_profile(current_user.username))

@router.post("/change-password")
def change_password_endpoint(data: ChangePasswordRequest, current_user: UserSchema = Depends(get_current_user)):
    return no_store_json(change_password(current_user.username, data))

@router.get("/user/subscriptions/current")
def get_user_current_subscriptions(current_user: UserSchema = Depends(get_current_user)):
    return no_store_json(get_user_subscriptions(current_user))

@router.get("/dashboard")
def get_dashboard(current_user: UserSchema = Depends(get_current_user)):
    profile = get_user_profile(current_user.username)
    subscriptions = get_user_subscriptions(current_user).get("subscriptions", [])
    active_subs = [sub for sub in subscriptions if sub.get("is_active")]
    recent_subs = sorted(subscriptions, key=lambda s: s.get("end_date", ""), reverse=True)[:5]
    return no_store_json({
        "credits": profile.get("credits"),
        "active_subscriptions": len(active_subs),
        "recent_subscriptions": recent_subs
    })
 