from schemas.user_schema import User, CreditDeposit
from db.base import get_fake_users_db
from db.mongodb import get_sync_users_collection
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

def get_wallet_info(current_user: User):
    """Get wallet information for the current user"""
    try:
        users_collection = get_sync_users_collection()
        user = users_collection.find_one({"username": current_user.username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "credits": user["credits"],
            "btc_address": user["btc_address"],
            "username": user["username"]
        }
    except Exception as e:
        logger.error(f"Error getting wallet info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

def deposit_credits(current_user: User, deposit: CreditDeposit):
    """Deposit credits to user's wallet"""
    try:
        users_collection = get_sync_users_collection()
        user = users_collection.find_one({"username": current_user.username})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Add credits to user's wallet
        new_credits = user["credits"] + deposit.amount
        users_collection.update_one(
            {"username": current_user.username},
            {"$set": {"credits": new_credits}}
        )
        
        return {
            "message": f"Successfully deposited {deposit.amount} credits",
            "new_balance": new_credits,
            "deposited_amount": deposit.amount
        }
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