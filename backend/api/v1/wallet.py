from fastapi import APIRouter, Depends, Header, Request
from schemas.user_schema import User, CreditDeposit
from api.dependencies import get_current_user
from services.wallet_service import (
    get_wallet_info,
    deposit_credits,
    # create_payment_invoice,
    # handle_payment_webhook,
)
from utils.responses import no_store_json

router = APIRouter()

@router.get("/wallet")
async def get_wallet(current_user: User = Depends(get_current_user)):
    return no_store_json(await get_wallet_info(current_user))

@router.post("/wallet/deposit")
async def wallet_deposit(dep: CreditDeposit, current_user: User = Depends(get_current_user)):
    return no_store_json(await deposit_credits(current_user, dep)) 

# Temporarily disabled payments
# @router.post("/wallet/payment/create")
# async def wallet_payment_create(bundle: str, current_user: User = Depends(get_current_user)):
#     return no_store_json(await create_payment_invoice(current_user, bundle))

# @router.post("/wallet/payment/webhook")
# async def wallet_payment_webhook(request: Request, x_nowpayments_sig: str = Header(default=None)):
#     raw = await request.body()
#     result = await handle_payment_webhook(raw, {"x-nowpayments-sig": x_nowpayments_sig or ""})
#     return no_store_json(result)
