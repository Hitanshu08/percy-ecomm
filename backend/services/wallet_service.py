from schemas.user_schema import User, CreditDeposit
from db.session import get_or_use_session
from db.models.subscription import UserSubscription
from db.models.service import Service as ServiceModel
from db.models.user import User as UserModel
from core.config import settings
from db.mongodb import get_mongo_db
from fastapi import HTTPException
import logging
from sqlalchemy import select

logger = logging.getLogger(__name__)

async def get_wallet_info(current_user: User):
    """Get wallet information for the current user including per-subscription credits"""
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            user = await mdb.users.find_one({"username": current_user.username})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            return {
                "credits": int(user.get("credits", 0)),
                "btc_address": str(user.get("btc_address", "")),
                "username": user.get("username", current_user.username),
            }
        async with get_or_use_session(None) as _db:
            result = await _db.execute(select(UserModel).where(UserModel.username == current_user.username))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            return {
                "credits": user.credits,
                "btc_address": user.btc_address,
                "username": user.username,
            }
    except Exception as e:
        logger.error(f"Error getting wallet info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def deposit_credits(current_user: User, deposit: CreditDeposit):
    """Deposit credits to user's wallet"""
    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            res = await mdb.users.update_one({"username": current_user.username}, {"$inc": {"credits": int(deposit.amount)}})
            if res.matched_count == 0:
                raise HTTPException(status_code=404, detail="User not found")
            doc = await mdb.users.find_one({"username": current_user.username}, {"credits": 1})
            new_credits = int((doc or {}).get("credits", 0))
            return {
                "message": f"Successfully deposited {deposit.amount} credits",
                "new_balance": new_credits,
                "deposited_amount": int(deposit.amount),
            }
        async with get_or_use_session(None) as _db:
            result = await _db.execute(select(UserModel).where(UserModel.username == current_user.username))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            new_credits = (user.credits or 0) + deposit.amount
            user.credits = new_credits
            await _db.commit()
            return {
                "message": f"Successfully deposited {deposit.amount} credits",
                "new_balance": new_credits,
                "deposited_amount": deposit.amount,
            }
    except Exception as e:
        logger.error(f"Error depositing credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def get_transaction_history(current_user: User):
    """Get transaction history for the current user"""
    try:
        # For now, return a placeholder transaction history
        # In a real implementation, this would query a transactions collection
        return {
            "transactions": [
                {
                    "id": "1",
                    "type": "deposit",
                    "amount": 100,
                    "timestamp": "2025-01-15T10:30:00Z",
                    "status": "completed"
                },
                {
                    "id": "2", 
                    "type": "purchase",
                    "amount": -50,
                    "timestamp": "2025-01-14T15:45:00Z",
                    "status": "completed",
                    "description": "Quillbot subscription"
                }
            ]
        }
    except Exception as e:
        logger.error(f"Error getting transaction history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 