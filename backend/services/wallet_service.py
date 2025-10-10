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
import aiohttp
import hmac
import hashlib
import base64
from typing import Dict, Any

logger = logging.getLogger(__name__)

USD_TO_CREDITS_RATE = 1  # 1 USD = 1 credit base rate

def map_bundle_to_usd_and_credits(bundle: str) -> Dict[str, int]:
    """Return the usd amount and credits for a given bundle id.
    Supported bundles: "1", "2", "5", "10", "20", "50" (USD),
    with credits 1, 2, 5, 10, 21, 52 respectively.
    """
    mapping = {
        "1": {"usd": 1, "credits": 1},
        "2": {"usd": 2, "credits": 2},
        "5": {"usd": 5, "credits": 5},
        "10": {"usd": 10, "credits": 10},
        "20": {"usd": 20, "credits": 21},
        "50": {"usd": 50, "credits": 52},
    }
    if bundle not in mapping:
        raise HTTPException(status_code=400, detail="Invalid bundle selected")
    return mapping[bundle]

async def create_payment_invoice(current_user: User, bundle: str) -> Dict[str, Any]:
    """Create a NOWPayments invoice and return the payment URL and metadata."""
    if not getattr(settings, "NOWPAYMENTS_ENABLED", True):
        raise HTTPException(status_code=503, detail="NOWPayments is temporarily disabled")
    if not settings.NOWPAYMENTS_API_KEY:
        raise HTTPException(status_code=500, detail="Payment provider not configured")
    bundle_info = map_bundle_to_usd_and_credits(bundle)
    amount_usd = bundle_info["usd"]
    credits = bundle_info["credits"]

    payload = {
        "price_amount": amount_usd,
        "price_currency": "usd",
        # Let NOWPayments auto-select optimal pay currency unless explicitly configured
        **({"pay_currency": settings.NOWPAYMENTS_PAY_CURRENCY} if getattr(settings, "NOWPAYMENTS_PAY_CURRENCY", None) else {}),
        "order_id": f"wallet_{current_user.username}_{bundle}_{amount_usd}",
        "order_description": f"Valuesubs wallet top-up: {credits} credits",
        "success_url": settings.PAYMENT_SUCCESS_URL,
        "cancel_url": settings.PAYMENT_CANCEL_URL,
        "ipn_callback_url": f"{settings.API_BASE_URL}{settings.API_V1_STR}/wallet/payment/webhook",
    }

    headers = {
        "x-api-key": settings.NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
    }

    create_url = f"{settings.NOWPAYMENTS_BASE_URL}/invoice"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(create_url, json=payload, headers=headers, timeout=30) as resp:
                data = await resp.json()
                if resp.status >= 400:
                    msg = data.get("message") or data.get("errors") or str(data)
                    logger.error(f"Payment create failed: {resp.status} {msg}")
                    raise HTTPException(status_code=502, detail="Failed to create payment")
                invoice_url = data.get("invoice_url") or data.get("payment_url")
                if not invoice_url:
                    logger.error(f"Payment create missing url: {data}")
                    raise HTTPException(status_code=502, detail="Invalid payment response")
                return {
                    "checkout_url": invoice_url,
                    "provider": "nowpayments",
                    "amount_usd": amount_usd,
                    "credits": credits,
                }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating payment invoice: {e}")
        raise HTTPException(status_code=502, detail="Payment service unavailable")

def _verify_nowpayments_signature(raw_body: bytes, signature: str) -> bool:
    if not settings.NOWPAYMENTS_IPN_SECRET or not signature:
        return False
    digest = hmac.new(settings.NOWPAYMENTS_IPN_SECRET.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(digest, signature)

async def handle_payment_webhook(raw_body: bytes, headers_map: Dict[str, str]):
    """Verify webhook and credit user if payment is confirmed."""
    try:
        import json
        payload = json.loads(raw_body.decode("utf-8"))
        payment_status = payload.get("payment_status") or payload.get("status")
        price_amount = payload.get("price_amount") or payload.get("price")
        order_id = payload.get("order_id", "")

        if settings.NOWPAYMENTS_IPN_SECRET:
            signature = headers_map.get("x-nowpayments-sig") or headers_map.get("X-Nowpayments-Sig")
            if not _verify_nowpayments_signature(raw_body, signature):
                logger.warning("Invalid NOWPayments signature")
                raise HTTPException(status_code=400, detail="invalid_signature")
        else:
            # Fallback verification by querying NOWPayments API
            invoice_id = payload.get("invoice_id")
            payment_id = payload.get("payment_id")
            verified_status = None
            headers = {"x-api-key": settings.NOWPAYMENTS_API_KEY, "Accept": "application/json"}
            async with aiohttp.ClientSession() as session:
                if invoice_id:
                    inv_url = f"{settings.NOWPAYMENTS_BASE_URL}/invoice/{invoice_id}"
                    async with session.get(inv_url, headers=headers) as resp:
                        inv = await resp.json()
                        if resp.status < 400:
                            verified_status = inv.get("status") or inv.get("payment_status")
                if not verified_status and payment_id:
                    pay_url = f"{settings.NOWPAYMENTS_BASE_URL}/payment/{payment_id}"
                    async with session.get(pay_url, headers=headers) as resp:
                        pay = await resp.json()
                        if resp.status < 400:
                            verified_status = pay.get("payment_status") or pay.get("status")
            if not verified_status:
                logger.warning("Unable to verify NOWPayments status without IPN secret")
                raise HTTPException(status_code=400, detail="unable_to_verify_payment")
            payment_status = verified_status or payment_status

        parts = order_id.split("_")
        if len(parts) < 4 or parts[0] != "wallet":
            logger.warning(f"Unknown order_id format: {order_id}")
            return {"ok": True}
        _, username, bundle, _amount = parts[:4]
        bundle_info = map_bundle_to_usd_and_credits(bundle)
        credits = bundle_info["credits"]

        if str(price_amount) != str(bundle_info["usd"]):
            logger.warning(f"Amount mismatch for {order_id}: expected {bundle_info['usd']} got {price_amount}")
            raise HTTPException(status_code=400, detail="amount_mismatch")

        if payment_status not in {"finished", "confirmed"}:
            return {"ok": True}

        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                raise HTTPException(status_code=500, detail="Mongo not available")
            res = await mdb.users.update_one({"username": username}, {"$inc": {"credits": int(credits)}})
            if res.matched_count == 0:
                raise HTTPException(status_code=404, detail="User not found")
            return {"ok": True}
        else:
            async with get_or_use_session(None) as _db:
                result = await _db.execute(select(UserModel).where(UserModel.username == username))
                user = result.scalars().first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.credits = (user.credits or 0) + int(credits)
                await _db.commit()
                return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Webhook processing failed: {e}")
        raise HTTPException(status_code=500, detail="webhook_error")

# --------------- PayPal Integration ---------------
async def _paypal_get_access_token(session: aiohttp.ClientSession) -> str:
    if not settings.PAYPAL_CLIENT_ID or not settings.PAYPAL_CLIENT_SECRET:
        logger.error("PayPal credentials missing in environment")
        raise HTTPException(status_code=500, detail="PayPal not configured. Please add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env")
    
    # Validate credentials don't contain quotes or spaces
    client_id = settings.PAYPAL_CLIENT_ID.strip().strip('"').strip("'")
    client_secret = settings.PAYPAL_CLIENT_SECRET.strip().strip('"').strip("'")
    
    token_url = f"{settings.PAYPAL_API_BASE}/v1/oauth2/token"
    auth = aiohttp.BasicAuth(client_id, client_secret)
    form = {"grant_type": "client_credentials"}
    headers = {"Accept": "application/json", "Accept-Language": "en_US"}
    
    try:
        async with session.post(token_url, data=form, auth=auth, headers=headers, timeout=15) as resp:
            data = await resp.json()
            if resp.status >= 400:
                error_msg = data.get("error_description") or data.get("error") or str(data)
                logger.error(f"PayPal token error: {resp.status} {data}")
                if resp.status == 401:
                    raise HTTPException(
                        status_code=502, 
                        detail=f"PayPal authentication failed: {error_msg}. Please verify your Client ID and Secret are from a Sandbox REST App (not buyer credentials)."
                    )
                raise HTTPException(status_code=502, detail=f"PayPal error: {error_msg}")
            access_token = data.get("access_token")
            if not access_token:
                logger.error(f"No access token in PayPal response: {data}")
                raise HTTPException(status_code=502, detail="Invalid PayPal token response")
            return access_token
    except aiohttp.ClientError as e:
        logger.error(f"PayPal connection error: {e}")
        raise HTTPException(status_code=502, detail="Unable to connect to PayPal API")

async def create_paypal_order(current_user: User, bundle: str, currency: str = None) -> Dict[str, Any]:
    bundle_info = map_bundle_to_usd_and_credits(bundle)
    amount_usd = bundle_info["usd"]
    async with aiohttp.ClientSession() as session:
        token = await _paypal_get_access_token(session)
        orders_url = f"{settings.PAYPAL_API_BASE}/v2/checkout/orders"
        payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": (currency or getattr(settings, "PAYPAL_CURRENCY", "USD")),
                        "value": f"{amount_usd}",
                    },
                    "custom_id": f"wallet_{current_user.username}_{bundle}_{amount_usd}"
                }
            ],
            "application_context": {
                "return_url": settings.PAYPAL_RETURN_URL,
                "cancel_url": settings.PAYPAL_CANCEL_URL,
                "locale": "en-US",
                "shipping_preference": "NO_SHIPPING",
                "user_action": "PAY_NOW"
            }
        }
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        async with session.post(orders_url, json=payload, headers=headers) as resp:
            data = await resp.json()
            if resp.status >= 400:
                error_msg = data.get("message") or str(data)
                logger.error(f"PayPal create order error: {resp.status} {data}")
                raise HTTPException(status_code=502, detail=f"PayPal order creation failed: {error_msg}")
            approve = next((l.get("href") for l in data.get("links", []) if l.get("rel") == "approve"), None)
            if not approve:
                raise HTTPException(status_code=502, detail="paypal_no_approve_link")
            return {"order_id": data.get("id"), "approve_url": approve}

async def capture_paypal_order(order_id: str) -> Dict[str, Any]:
    """Capture PayPal order and credit user's wallet"""
    async with aiohttp.ClientSession() as session:
        token = await _paypal_get_access_token(session)
        
        # First, get order details to retrieve custom_id before capture
        details_url = f"{settings.PAYPAL_API_BASE}/v2/checkout/orders/{order_id}"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        async with session.get(details_url, headers=headers) as details_resp:
            details_data = await details_resp.json()
            if details_resp.status >= 400:
                logger.error(f"PayPal get order error: {details_resp.status} {details_data}")
                raise HTTPException(status_code=502, detail="Failed to retrieve order details")
            
            # Extract custom_id from order details
            purchase_units = details_data.get("purchase_units", [])
            if not purchase_units:
                logger.error(f"No purchase units in order details: {details_data}")
                raise HTTPException(status_code=502, detail="Invalid order structure")
            
            custom_id = purchase_units[0].get("custom_id", "")
            logger.info(f"PayPal order {order_id} custom_id: {custom_id}")
            
            # custom_id format: wallet_<username>_<bundle>_<amount>
            parts = custom_id.split("_")
            if len(parts) < 4 or parts[0] != "wallet":
                logger.error(f"Invalid custom_id format: {custom_id}")
                raise HTTPException(status_code=400, detail="Invalid order format")
            
            _, username, bundle, _amount = parts[:4]
            bundle_info = map_bundle_to_usd_and_credits(bundle)
            credits = bundle_info["credits"]
        
        # Now capture the payment
        capture_url = f"{settings.PAYPAL_API_BASE}/v2/checkout/orders/{order_id}/capture"
        async with session.post(capture_url, headers=headers) as resp:
            data = await resp.json()
            if resp.status >= 400:
                error_msg = data.get("message") or str(data)
                logger.error(f"PayPal capture error: {resp.status} {data}")
                raise HTTPException(status_code=502, detail=f"PayPal capture failed: {error_msg}")
            
            # Verify capture status
            status = data.get("status")
            if status != "COMPLETED":
                logger.warning(f"PayPal order {order_id} not completed: {status}")
                return {
                    "status": status,
                    "order_id": order_id,
                    "message": f"Payment status: {status}"
                }
            
            # Credit the user
            if settings.USE_MONGO:
                mdb = get_mongo_db()
                if mdb is None:
                    raise HTTPException(status_code=500, detail="Mongo not available")
                res = await mdb.users.update_one({"username": username}, {"$inc": {"credits": int(credits)}})
                if res.matched_count == 0:
                    logger.error(f"User {username} not found for PayPal credit")
                    raise HTTPException(status_code=404, detail="User not found")
                doc = await mdb.users.find_one({"username": username}, {"credits": 1})
                new_balance = int((doc or {}).get("credits", 0))
            else:
                async with get_or_use_session(None) as _db:
                    result = await _db.execute(select(UserModel).where(UserModel.username == username))
                    user = result.scalars().first()
                    if not user:
                        logger.error(f"User {username} not found for PayPal credit")
                        raise HTTPException(status_code=404, detail="User not found")
                    user.credits = (user.credits or 0) + int(credits)
                    new_balance = user.credits
                    await _db.commit()
            
            logger.info(f"PayPal: Credited {credits} credits to user {username}, new balance: {new_balance}")
            return {
                "status": "success",
                "order_id": order_id,
                "credits_added": credits,
                "new_balance": new_balance,
                "message": f"Successfully added {credits} credits to your wallet"
            }

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