from fastapi import APIRouter, Depends, HTTPException, status
from schemas.user_schema import User as UserSchema, UserCreate, ChangePasswordRequest
from api.dependencies import get_current_user
from db.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
from services.user_service import change_password, get_user_profile, create_user
from services.service_service import get_user_subscriptions
from utils.responses import no_store_json

router = APIRouter()

@router.post("/signup", response_model=dict)
async def signup(user: UserCreate, db: AsyncSession = Depends(get_db_session)):
    return await create_user(user, db)

@router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await get_user_profile(current_user.username, db))

@router.post("/change-password")
async def change_password_endpoint(data: ChangePasswordRequest, current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await change_password(current_user.username, data, db))

@router.get("/user/subscriptions/current")
async def get_user_current_subscriptions(current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    return no_store_json(await get_user_subscriptions(current_user, db))

@router.get("/dashboard")
async def get_dashboard(current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    # Reuse the same session for both calls (sequential to avoid concurrent session use)
    profile = await get_user_profile(current_user.username, db)
    subs_resp = await get_user_subscriptions(current_user, db)
    subscriptions = subs_resp.get("subscriptions", [])
    active_subs = [sub for sub in subscriptions if sub.get("is_active")]
    recent_subs = sorted(subscriptions, key=lambda s: s.get("end_date", ""), reverse=True)[:5]

    recent_min = [
        {
            "service_name": sub.get("service_name"),
            "service_image": sub.get("service_image"),
            "account_id": sub.get("account_id") or sub.get("service_id"),
            "end_date": sub.get("end_date"),
            "is_active": sub.get("is_active"),
        }
        for sub in recent_subs
    ]

    return no_store_json({
        "credits": profile.get("credits"),
        "active_subscriptions": len(active_subs),
        "recent_subscriptions": recent_min
    })
 