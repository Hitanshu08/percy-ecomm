from fastapi import APIRouter, Depends
from schemas.user_schema import User as UserSchema, UserCreate, ChangePasswordRequest
from api.dependencies import get_current_user
from db.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from db.mongodb import get_mongo_db
from services.user_service import change_password, get_user_profile, create_user
from sqlalchemy import select
from db.models.user import User as UserModel
from services.service_service import get_user_subscriptions
from utils.responses import no_store_json
from utils.timing import timeit

router = APIRouter()

@timeit()
@router.post("/signup", response_model=dict)
async def signup(user: UserCreate, db: AsyncSession = Depends(get_db_session)):
    if settings.USE_MONGO:
        db = None
    return await create_user(user, db)

@timeit()
@router.get("/check-username")
async def check_username(username: str, db: AsyncSession = Depends(get_db_session)):
    if settings.USE_MONGO:
        mdb = get_mongo_db()
        if mdb is None:
            return {"available": False}
        exists = await mdb.users.find_one({"username": username})
        return {"available": not bool(exists)}
    result = await db.execute(select(UserModel).where(UserModel.username == username))
    exists = result.scalars().first() is not None
    return {"available": not exists}

@timeit()
@router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: UserSchema = Depends(get_current_user)):
    # Avoid redundant DB call; dependency already validated user. Convert to dict for JSONResponse.
    data = current_user.model_dump()
    # Remove fields not needed in response
    data.pop("services", None)
    data.pop("btc_address", None)
    return no_store_json(data)

@timeit()
@router.post("/change-password")
async def change_password_endpoint(data: ChangePasswordRequest, current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    if settings.USE_MONGO:
        db = None
    return no_store_json(await change_password(current_user.username, data, db))

@timeit()
@router.get("/user/subscriptions/current")
async def get_user_current_subscriptions(current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    if settings.USE_MONGO:
        db = None
    return no_store_json(await get_user_subscriptions(current_user, db))

@timeit("get_dashboard")
@router.get("/dashboard")
async def get_dashboard(current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    # Use JWT data for credits; fetch only subscriptions
    if settings.USE_MONGO:
        db = None
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
        "credits": current_user.credits,
        "active_subscriptions": len(active_subs),
        "recent_subscriptions": recent_min
    })
 