from schemas.user_schema import User, CreditDeposit
from db.session import SessionLocal
from db.models.user import User as UserModel
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

def get_wallet_info(current_user: User):
    """Get wallet information for the current user including per-subscription credits"""
    try:
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == current_user.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Calculate total credits from all subscriptions
            subscription_credits = 0
            subscription_details = []
            
            if user.services and isinstance(user.services, list):
                for subscription in user.services:
                    subscription_credit = subscription.get("credits", 0) or 0
                    subscription_credits += subscription_credit
                    subscription_details.append({
                        "service_id": subscription.get("service_id"),
                        "credits": subscription_credit,
                        "is_active": subscription.get("is_active", True),
                        "end_date": subscription.get("end_date")
                    })
            
            return {
                "global_credits": user.credits,
                "subscription_credits": subscription_credits,
                "total_credits": (user.credits or 0) + subscription_credits,
                "subscription_details": subscription_details,
                "btc_address": user.btc_address,
                "username": user.username,
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error getting wallet info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def deposit_credits(current_user: User, deposit: CreditDeposit):
    """Deposit credits to user's wallet"""
    try:
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.username == current_user.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            new_credits = (user.credits or 0) + deposit.amount
            user.credits = new_credits
            db.commit()
            return {
                "message": f"Successfully deposited {deposit.amount} credits",
                "new_balance": new_credits,
                "deposited_amount": deposit.amount,
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error depositing credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def get_transaction_history(current_user: User):
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