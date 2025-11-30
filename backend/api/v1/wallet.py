from fastapi import APIRouter, Depends, Header, Request
from schemas.user_schema import User, CreditDeposit
from api.dependencies import get_current_user
from services.wallet_service import (
    get_wallet_info,
    deposit_credits,
    create_payment_invoice,
    handle_payment_webhook,
    create_paypal_order,
    capture_paypal_order,
    create_razorpay_order,
    verify_razorpay_payment,
    handle_razorpay_webhook,
)
from utils.responses import no_store_json

router = APIRouter()

@router.get("/wallet")
async def get_wallet(current_user: User = Depends(get_current_user)):
    return no_store_json(await get_wallet_info(current_user))

@router.post("/wallet/deposit")
async def wallet_deposit(dep: CreditDeposit, current_user: User = Depends(get_current_user)):
    return no_store_json(await deposit_credits(current_user, dep)) 

@router.post("/wallet/payment/create")
async def wallet_payment_create(bundle: str, current_user: User = Depends(get_current_user)):
    return no_store_json(await create_payment_invoice(current_user, bundle))

@router.post("/wallet/payment/webhook")
async def wallet_payment_webhook(request: Request, x_nowpayments_sig: str = Header(default=None)):
    raw = await request.body()
    result = await handle_payment_webhook(raw, {"x-nowpayments-sig": x_nowpayments_sig or ""})
    return no_store_json(result)

@router.post("/wallet/payment/paypal/create")
async def wallet_paypal_create(bundle: str, current_user: User = Depends(get_current_user)):
    return no_store_json(await create_paypal_order(current_user, bundle))

@router.post("/wallet/payment/paypal/capture")
async def wallet_paypal_capture(order_id: str):
    return no_store_json(await capture_paypal_order(order_id))

@router.post("/wallet/payment/razorpay/create")
async def wallet_razorpay_create(bundle: str, current_user: User = Depends(get_current_user)):
    return no_store_json(await create_razorpay_order(current_user, bundle))

@router.post("/wallet/payment/razorpay/verify")
async def wallet_razorpay_verify(order_id: str, payment_id: str, signature: str):
    return no_store_json(await verify_razorpay_payment(order_id, payment_id, signature))

@router.post("/wallet/payment/razorpay/webhook")
async def wallet_razorpay_webhook(request: Request, x_razorpay_signature: str = Header(default=None)):
    raw = await request.body()
    headers_map = {"x-razorpay-signature": x_razorpay_signature or ""}
    result = await handle_razorpay_webhook(raw, headers_map)
    return no_store_json(result)
