from fastapi import APIRouter, Depends, HTTPException
from schemas.user_schema import User as UserSchema, UserCreate, ChangePasswordRequest
from api.dependencies import get_current_user
from db.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from core.config import settings
from db.mongodb import get_mongo_db
from services.user_service import change_password, get_user_profile, create_user
from sqlalchemy import select, func
from db.models.user import User as UserModel
from db.models.referral import ReferralCredit
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
    
    # Get referral credits earned
    total_credits_earned = 0
    if settings.USE_MONGO:
        mdb = get_mongo_db()
        if mdb is not None:
            user = await mdb.users.find_one({"username": current_user.username})
            if user:
                user_mongo_id = user.get("_id")
                from bson import ObjectId
                query = {"referrer_user_id": user_mongo_id}
                try:
                    credits = await mdb.referral_credits.find(query).to_list(length=10000)
                    total_credits_earned = sum(int(credit.get("credits_awarded", 0)) for credit in credits)
                except Exception:
                    try:
                        query_str = {"referrer_user_id": str(user_mongo_id)}
                        credits = await mdb.referral_credits.find(query_str).to_list(length=10000)
                        total_credits_earned = sum(int(credit.get("credits_awarded", 0)) for credit in credits)
                    except Exception:
                        pass
    else:
        # SQL path
        user_result = await db.execute(select(UserModel).where(UserModel.username == current_user.username))
        user = user_result.scalars().first()
        if user:
            stats_result = await db.execute(
                select(
                    func.sum(ReferralCredit.credits_awarded).label("total_credits_earned")
                ).where(ReferralCredit.referrer_user_id == user.id)
            )
            stats = stats_result.first()
            total_credits_earned = int(stats.total_credits_earned or 0) if stats else 0
    
    return no_store_json({
        "username": current_user.username,
        "credits": current_user.credits,
        "active_subscriptions": len(active_subs),
        "total_credits_earned": total_credits_earned,
        "recent_subscriptions": recent_min
    })

@timeit()
@router.get("/me/referral-code")
async def get_my_referral_code(current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    """Get current user's referral code"""
    if settings.USE_MONGO:
        mdb = get_mongo_db()
        if mdb is None:
            raise HTTPException(status_code=500, detail="Mongo not available")
        user = await mdb.users.find_one({"username": current_user.username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        referral_code = user.get("referral_code")
        if not referral_code:
            raise HTTPException(status_code=404, detail="Referral code not found")
        return no_store_json({"referral_code": referral_code})
    
    result = await db.execute(select(UserModel).where(UserModel.username == current_user.username))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.referral_code:
        raise HTTPException(status_code=404, detail="Referral code not found")
    return no_store_json({"referral_code": user.referral_code})

@timeit()
@router.get("/me/referral-stats")
async def get_my_referral_stats(current_user: UserSchema = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    """Get current user's referral code and statistics"""
    if settings.USE_MONGO:
        mdb = get_mongo_db()
        if mdb is None:
            raise HTTPException(status_code=500, detail="Mongo not available")
        
        user = await mdb.users.find_one({"username": current_user.username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        referral_code = user.get("referral_code")
        if not referral_code:
            raise HTTPException(status_code=404, detail="Referral code not found")
        
        # Get user's MongoDB _id for querying referral credits
        user_mongo_id = user.get("_id")
        
        # Count referrals and sum credits earned
        referrals_count = 0
        total_credits_earned = 0
        
        # Query referral credits where this user is the referrer
        from bson import ObjectId
        query = {"referrer_user_id": user_mongo_id}
        
        # Try multiple query formats
        try:
            credits = await mdb.referral_credits.find(query).to_list(length=10000)
            referrals_count = len(credits)
            total_credits_earned = sum(int(credit.get("credits_awarded", 0)) for credit in credits)
        except Exception:
            # Try with string format
            try:
                query_str = {"referrer_user_id": str(user_mongo_id)}
                credits = await mdb.referral_credits.find(query_str).to_list(length=10000)
                referrals_count = len(credits)
                total_credits_earned = sum(int(credit.get("credits_awarded", 0)) for credit in credits)
            except Exception:
                pass
        
        return no_store_json({
            "referral_code": referral_code,
            "referrals_count": referrals_count,
            "total_credits_earned": total_credits_earned
        })
    
    # SQL path
    result = await db.execute(select(UserModel).where(UserModel.username == current_user.username))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.referral_code:
        raise HTTPException(status_code=404, detail="Referral code not found")
    
    # Count referrals and sum credits earned
    stats_result = await db.execute(
        select(
            func.count(ReferralCredit.id).label("referrals_count"),
            func.sum(ReferralCredit.credits_awarded).label("total_credits_earned")
        ).where(ReferralCredit.referrer_user_id == user.id)
    )
    stats = stats_result.first()
    
    referrals_count = int(stats.referrals_count or 0) if stats else 0
    total_credits_earned = int(stats.total_credits_earned or 0) if stats else 0
    
    return no_store_json({
        "referral_code": user.referral_code,
        "referrals_count": referrals_count,
        "total_credits_earned": total_credits_earned
    })
 