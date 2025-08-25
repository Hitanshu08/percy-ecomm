from fastapi import APIRouter, Depends
from schemas.user_schema import User, CreditDeposit
from api.dependencies import get_current_user
from services.wallet_service import get_wallet_info, deposit_credits
from utils.responses import no_store_json

router = APIRouter()

@router.get("/wallet")
def get_wallet(current_user: User = Depends(get_current_user)):
    return no_store_json(get_wallet_info(current_user))

@router.post("/wallet/deposit")
def wallet_deposit(dep: CreditDeposit, current_user: User = Depends(get_current_user)):
    return no_store_json(deposit_credits(current_user, dep)) 