from schemas.user_schema import User, CreditDeposit
from db.session import SessionLocal
from db.models.subscription import UserSubscription
from db.models.service import Service as ServiceModel
from db.models.user import User as UserModel
from fastapi import HTTPException
import logging
from sqlalchemy import select

logger = logging.getLogger(__name__)

async def get_wallet_info(current_user: User):
    """Get wallet information for the current user including per-subscription credits"""
    try:
        async with SessionLocal() as db:
            result = await db.execute(select(UserModel).where(UserModel.username == current_user.username))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            subscription_details = []
            subs = (await db.execute(select(UserSubscription).where(UserSubscription.user_id == user.id))).scalars().all()
            for sub in subs:
                svc = (await db.execute(select(ServiceModel).where(ServiceModel.id == sub.service_id))).scalars().first()
                subscription_details.append({
                    "service_id": sub.service_id,
                    "service_name": svc.name if svc else "",
                    "is_active": bool(sub.is_active),
                    "end_date": sub.end_date.strftime("%d/%m/%Y") if sub.end_date else ""
                })
            return {
                "credits": user.credits,
                "subscription_details": subscription_details,
                "btc_address": user.btc_address,
                "username": user.username,
            }
    except Exception as e:
        logger.error(f"Error getting wallet info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def deposit_credits(current_user: User, deposit: CreditDeposit):
    """Deposit credits to user's wallet"""
    try:
        async with SessionLocal() as db:
            result = await db.execute(select(UserModel).where(UserModel.username == current_user.username))
            user = result.scalars().first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            new_credits = (user.credits or 0) + deposit.amount
            user.credits = new_credits
            await db.commit()
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