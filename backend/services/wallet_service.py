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
from forex_python.converter import CurrencyRates
from services.analytics_service import record_analytics_event

logger = logging.getLogger(__name__)
c = CurrencyRates()

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
            external_ref = payload.get("payment_id") or payload.get("invoice_id") or order_id
            await record_analytics_event(
                "wallet_add_credit",
                actor_username=username,
                actor_role="user",
                target_username=username,
                source="wallet",
                external_ref=f"nowpayments:{external_ref}",
                details={
                    "provider": "nowpayments",
                    "order_id": order_id,
                    "bundle": bundle,
                    "credits_added": int(credits),
                    "payment_status": str(payment_status),
                },
            )
            return {"ok": True}
        else:
            async with get_or_use_session(None) as _db:
                result = await _db.execute(select(UserModel).where(UserModel.username == username))
                user = result.scalars().first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.credits = (user.credits or 0) + int(credits)
                await _db.commit()
                external_ref = payload.get("payment_id") or payload.get("invoice_id") or order_id
                await record_analytics_event(
                    "wallet_add_credit",
                    actor_username=username,
                    actor_role="user",
                    target_username=username,
                    source="wallet",
                    external_ref=f"nowpayments:{external_ref}",
                    details={
                        "provider": "nowpayments",
                        "order_id": order_id,
                        "bundle": bundle,
                        "credits_added": int(credits),
                        "payment_status": str(payment_status),
                    },
                )
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
            await record_analytics_event(
                "wallet_add_credit",
                actor_username=username,
                actor_role="user",
                target_username=username,
                source="wallet",
                external_ref=f"paypal:{order_id}",
                details={
                    "provider": "paypal",
                    "order_id": order_id,
                    "bundle": bundle,
                    "credits_added": int(credits),
                    "new_balance": int(new_balance),
                },
            )
            return {
                "status": "success",
                "order_id": order_id,
                "credits_added": credits,
                "new_balance": new_balance,
                "message": f"Successfully added {credits} credits to your wallet"
            }

# --------------- Razorpay Integration ---------------
# Reference: https://razorpay.com/docs/api/orders/
# API Gateway: https://api.razorpay.com/v1
# Authentication: Basic Auth with key_id:key_secret
async def create_razorpay_order(current_user: User, bundle: str) -> Dict[str, Any]:
    """Create a Razorpay order and return order details
    
    Creates an order using Razorpay Orders API.
    Amount is converted from USD to INR (in paise - smallest currency unit).
    Uses forex-python for real-time exchange rates with fallback to default rate.
    Test/Live mode is determined by the API keys used (test keys for sandbox).
    
    Reference: https://razorpay.com/docs/api/orders/#create-an-order
    """
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        logger.error("Razorpay credentials missing in environment")
        raise HTTPException(status_code=500, detail="Razorpay not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env")
    
    bundle_info = map_bundle_to_usd_and_credits(bundle)
    amount_usd = bundle_info["usd"]
    credits = bundle_info["credits"]
    
    # Convert USD to INR using real-time exchange rate from forex-python
    try:
        usd_to_inr_rate = c.get_rate('USD', 'INR')
        logger.info(f"USD to INR exchange rate fetched: {usd_to_inr_rate}")
    except Exception as e:
        # Fallback to default rate if API fails (network issues, rate limit, etc.)
        logger.warning(f"Failed to fetch USD/INR rate from forex-python: {e}. Using fallback rate of 83.0")
        usd_to_inr_rate = 85.0  # Fallback rate
    
    amount_inr = int(amount_usd * usd_to_inr_rate * 100)  # Amount in paise (smallest currency unit)
    
    # Create order payload
    order_id_prefix = f"wallet_{current_user.username}_{bundle}_{amount_usd}"
    notes = {
        "username": current_user.username,
        "bundle": bundle,
        "amount_usd": str(amount_usd),
        "credits": str(credits),
        "exchange_rate": str(usd_to_inr_rate)  # Store rate used for reference
    }
    
    payload = {
        "amount": amount_inr,
        "currency": getattr(settings, "RAZORPAY_CURRENCY", "INR"),
        "receipt": order_id_prefix,
        "notes": notes
    }
    
    # Razorpay API endpoint (same URL for both sandbox and production)
    # Sandbox is determined by using test keys vs live keys
    api_base = "https://api.razorpay.com/v1"
    orders_url = f"{api_base}/orders"
    
    # Basic auth with key_id:key_secret
    key_id = settings.RAZORPAY_KEY_ID.strip().strip('"').strip("'")
    key_secret = settings.RAZORPAY_KEY_SECRET.strip().strip('"').strip("'")
    auth = aiohttp.BasicAuth(key_id, key_secret)
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(orders_url, json=payload, auth=auth, headers=headers, timeout=15) as resp:
                data = await resp.json()
                if resp.status >= 400:
                    error_msg = data.get("error", {}).get("description") or data.get("error", {}).get("reason") or str(data)
                    logger.error(f"Razorpay create order error: {resp.status} {data}")
                    raise HTTPException(status_code=502, detail=f"Razorpay order creation failed: {error_msg}")
                
                razorpay_order_id = data.get("id")
                if not razorpay_order_id:
                    logger.error(f"No order ID in Razorpay response: {data}")
                    raise HTTPException(status_code=502, detail="Invalid Razorpay order response")
                
                return {
                    "order_id": razorpay_order_id,
                    "amount": amount_inr,
                    "currency": payload["currency"],
                    "key_id": key_id,
                    "amount_usd": amount_usd,
                    "credits": credits,
                    "username": current_user.username,
                    "bundle": bundle
                }
    except aiohttp.ClientError as e:
        logger.error(f"Razorpay connection error: {e}")
        raise HTTPException(status_code=502, detail="Unable to connect to Razorpay API")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating Razorpay order: {e}")
        raise HTTPException(status_code=502, detail="Razorpay service unavailable")

async def create_razorpay_payment_link(current_user: User, bundle: str) -> Dict[str, Any]:
    """Create a Razorpay Payment Link - doesn't require domain registration
    
    Creates a payment link that redirects to Razorpay-hosted payment page.
    This method bypasses the website domain check requirement.
    
    Reference: https://razorpay.com/docs/api/payment-links/
    """
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        logger.error("Razorpay credentials missing in environment")
        raise HTTPException(status_code=500, detail="Razorpay not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env")
    
    bundle_info = map_bundle_to_usd_and_credits(bundle)
    amount_usd = bundle_info["usd"]
    credits = bundle_info["credits"]
    
    # Convert USD to INR using real-time exchange rate from forex-python
    try:
        usd_to_inr_rate = c.get_rate('USD', 'INR')
        logger.info(f"USD to INR exchange rate fetched: {usd_to_inr_rate}")
    except Exception as e:
        logger.warning(f"Failed to fetch USD/INR rate from forex-python: {e}. Using fallback rate of 85.0")
        usd_to_inr_rate = 85.0
    
    amount_inr = int(amount_usd * usd_to_inr_rate * 100)  # Amount in paise
    
    # Get return URLs - use FRONTEND_URL if available, otherwise use configured URLs
    frontend_url = getattr(settings, "FRONTEND_URL", None)
    if frontend_url:
        return_url = f"{frontend_url}/wallet?razorpay=success"
    else:
        return_url = getattr(settings, "RAZORPAY_RETURN_URL", "http://localhost:5173/wallet?razorpay=success")
    
    # Create payment link payload
    payload = {
        "amount": amount_inr,
        "currency": getattr(settings, "RAZORPAY_CURRENCY", "INR"),
        "description": f"Wallet top-up: {credits} credits",
        "customer": {
            "name": current_user.username,
            "email": current_user.email or "",
            "contact": ""  # Optional: add phone if available
        },
        "notify": {
            "sms": False,
            "email": False
        },
        "reminder_enable": False,
        "callback_url": return_url,
        "callback_method": "get",
        "notes": {
            "username": current_user.username,
            "bundle": bundle,
            "amount_usd": str(amount_usd),
            "credits": str(credits),
            "exchange_rate": str(usd_to_inr_rate)
        }
    }
    
    api_base = "https://api.razorpay.com/v1"
    payment_links_url = f"{api_base}/payment_links"
    
    key_id = settings.RAZORPAY_KEY_ID.strip().strip('"').strip("'")
    key_secret = settings.RAZORPAY_KEY_SECRET.strip().strip('"').strip("'")
    auth = aiohttp.BasicAuth(key_id, key_secret)
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(payment_links_url, json=payload, auth=auth, headers=headers, timeout=15) as resp:
                data = await resp.json()
                if resp.status >= 400:
                    error_msg = data.get("error", {}).get("description") or data.get("error", {}).get("reason") or str(data)
                    logger.error(f"Razorpay create payment link error: {resp.status} {data}")
                    raise HTTPException(status_code=502, detail=f"Razorpay payment link creation failed: {error_msg}")
                
                short_url = data.get("short_url")
                if not short_url:
                    logger.error(f"No short_url in Razorpay response: {data}")
                    raise HTTPException(status_code=502, detail="Invalid Razorpay payment link response")
                
                return {
                    "payment_link_id": data.get("id"),
                    "short_url": short_url,
                    "amount": amount_inr,
                    "currency": payload["currency"],
                    "amount_usd": amount_usd,
                    "credits": credits,
                    "username": current_user.username,
                    "bundle": bundle
                }
    except aiohttp.ClientError as e:
        logger.error(f"Razorpay connection error: {e}")
        raise HTTPException(status_code=502, detail="Unable to connect to Razorpay API")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating Razorpay payment link: {e}")
        raise HTTPException(status_code=502, detail="Razorpay service unavailable")
    except aiohttp.ClientError as e:
        logger.error(f"Razorpay connection error: {e}")
        raise HTTPException(status_code=502, detail="Unable to connect to Razorpay API")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating Razorpay order: {e}")
        raise HTTPException(status_code=502, detail="Razorpay service unavailable")

def _verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay payment signature using HMAC SHA256
    
    Signature format: HMAC SHA256 of (order_id|payment_id) using key_secret
    Reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/verify-payment-signature/
    """
    if not settings.RAZORPAY_KEY_SECRET or not signature:
        return False
    
    key_secret = settings.RAZORPAY_KEY_SECRET.strip().strip('"').strip("'")
    message = f"{order_id}|{payment_id}"
    generated_signature = hmac.new(
        key_secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(generated_signature, signature)

async def verify_razorpay_payment_link(payment_link_id: str, payment_id: str) -> Dict[str, Any]:
    """Verify Razorpay Payment Link payment and credit user's wallet
    
    Payment Links don't use order_id, so we get payment details from payment_link_id.
    Reference: https://razorpay.com/docs/api/payment-links/
    """
    api_base = "https://api.razorpay.com/v1"
    key_id = settings.RAZORPAY_KEY_ID.strip().strip('"').strip("'")
    key_secret = settings.RAZORPAY_KEY_SECRET.strip().strip('"').strip("'")
    auth = aiohttp.BasicAuth(key_id, key_secret)
    
    try:
        async with aiohttp.ClientSession() as session:
            headers = {"Content-Type": "application/json"}
            
            # Get payment details
            payment_url = f"{api_base}/payments/{payment_id}"
            async with session.get(payment_url, auth=auth, headers=headers, timeout=15) as resp:
                payment_data = await resp.json()
                if resp.status >= 400:
                    logger.error(f"Razorpay get payment error: {resp.status} {payment_data}")
                    raise HTTPException(status_code=502, detail="Failed to retrieve payment details")
                
                payment_status = payment_data.get("status")
                if payment_status != "captured" and payment_status != "authorized":
                    logger.warning(f"Razorpay payment {payment_id} not captured: {payment_status}")
                    return {
                        "status": payment_status,
                        "payment_link_id": payment_link_id,
                        "payment_id": payment_id,
                        "message": f"Payment status: {payment_status}"
                    }
            
            # Get payment link details to extract notes
            payment_link_url = f"{api_base}/payment_links/{payment_link_id}"
            async with session.get(payment_link_url, auth=auth, headers=headers, timeout=15) as link_resp:
                link_data = await link_resp.json()
                if link_resp.status >= 400:
                    logger.error(f"Razorpay get payment link error: {link_resp.status} {link_data}")
                    raise HTTPException(status_code=502, detail="Failed to retrieve payment link details")
                
                notes = link_data.get("notes", {})
                username = notes.get("username", "")
                bundle = notes.get("bundle", "")
                
                if not username or not bundle:
                    logger.error(f"Invalid payment link notes: {notes}")
                    raise HTTPException(status_code=400, detail="Invalid payment link format")
                
                bundle_info = map_bundle_to_usd_and_credits(bundle)
                credits = bundle_info["credits"]
                
                # Credit the user
                if settings.USE_MONGO:
                    mdb = get_mongo_db()
                    if mdb is None:
                        raise HTTPException(status_code=500, detail="Mongo not available")
                    res = await mdb.users.update_one({"username": username}, {"$inc": {"credits": int(credits)}})
                    if res.matched_count == 0:
                        logger.error(f"User {username} not found for Razorpay credit")
                        raise HTTPException(status_code=404, detail="User not found")
                    doc = await mdb.users.find_one({"username": username}, {"credits": 1})
                    new_balance = int((doc or {}).get("credits", 0))
                else:
                    async with get_or_use_session(None) as _db:
                        result = await _db.execute(select(UserModel).where(UserModel.username == username))
                        user = result.scalars().first()
                        if not user:
                            logger.error(f"User {username} not found for Razorpay credit")
                            raise HTTPException(status_code=404, detail="User not found")
                        user.credits = (user.credits or 0) + int(credits)
                        new_balance = user.credits
                        await _db.commit()
                
                logger.info(f"Razorpay Payment Link: Credited {credits} credits to user {username}, new balance: {new_balance}")
                await record_analytics_event(
                    "wallet_add_credit",
                    actor_username=username,
                    actor_role="user",
                    target_username=username,
                    source="wallet",
                    external_ref=f"razorpay:{payment_id}",
                    details={
                        "provider": "razorpay",
                        "payment_link_id": payment_link_id,
                        "payment_id": payment_id,
                        "bundle": bundle,
                        "credits_added": int(credits),
                        "new_balance": int(new_balance),
                    },
                )
                return {
                    "status": "success",
                    "payment_link_id": payment_link_id,
                    "payment_id": payment_id,
                    "credits_added": credits,
                    "new_balance": new_balance,
                    "message": f"Successfully added {credits} credits to your wallet"
                }
    except aiohttp.ClientError as e:
        logger.error(f"Razorpay connection error: {e}")
        raise HTTPException(status_code=502, detail="Unable to connect to Razorpay API")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error verifying Razorpay payment link: {e}")
        raise HTTPException(status_code=502, detail="Razorpay verification failed")

async def verify_razorpay_payment(order_id: str, payment_id: str, signature: str) -> Dict[str, Any]:
    """Verify Razorpay payment and credit user's wallet
    
    Verifies payment signature and status, then credits the user's wallet.
    Reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/verify-payment-signature/
    """
    if not _verify_razorpay_signature(order_id, payment_id, signature):
        logger.warning(f"Invalid Razorpay signature for order {order_id}")
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    
    # Get order details from Razorpay to verify
    api_base = "https://api.razorpay.com/v1"
    key_id = settings.RAZORPAY_KEY_ID.strip().strip('"').strip("'")
    key_secret = settings.RAZORPAY_KEY_SECRET.strip().strip('"').strip("'")
    auth = aiohttp.BasicAuth(key_id, key_secret)
    
    try:
        async with aiohttp.ClientSession() as session:
            # Get payment details
            payment_url = f"{api_base}/payments/{payment_id}"
            headers = {"Content-Type": "application/json"}
            
            async with session.get(payment_url, auth=auth, headers=headers, timeout=15) as resp:
                payment_data = await resp.json()
                if resp.status >= 400:
                    logger.error(f"Razorpay get payment error: {resp.status} {payment_data}")
                    raise HTTPException(status_code=502, detail="Failed to retrieve payment details")
                
                payment_status = payment_data.get("status")
                if payment_status != "captured" and payment_status != "authorized":
                    logger.warning(f"Razorpay payment {payment_id} not captured: {payment_status}")
                    return {
                        "status": payment_status,
                        "order_id": order_id,
                        "payment_id": payment_id,
                        "message": f"Payment status: {payment_status}"
                    }
                
                # Get order details to extract notes
                order_url = f"{api_base}/orders/{order_id}"
                async with session.get(order_url, auth=auth, headers=headers, timeout=15) as order_resp:
                    order_data = await order_resp.json()
                    if order_resp.status >= 400:
                        logger.error(f"Razorpay get order error: {order_resp.status} {order_data}")
                        raise HTTPException(status_code=502, detail="Failed to retrieve order details")
                    
                    notes = order_data.get("notes", {})
                    username = notes.get("username", "")
                    bundle = notes.get("bundle", "")
                    
                    if not username or not bundle:
                        logger.error(f"Invalid order notes: {notes}")
                        raise HTTPException(status_code=400, detail="Invalid order format")
                    
                    bundle_info = map_bundle_to_usd_and_credits(bundle)
                    credits = bundle_info["credits"]
                    
                    # Credit the user
                    if settings.USE_MONGO:
                        mdb = get_mongo_db()
                        if mdb is None:
                            raise HTTPException(status_code=500, detail="Mongo not available")
                        res = await mdb.users.update_one({"username": username}, {"$inc": {"credits": int(credits)}})
                        if res.matched_count == 0:
                            logger.error(f"User {username} not found for Razorpay credit")
                            raise HTTPException(status_code=404, detail="User not found")
                        doc = await mdb.users.find_one({"username": username}, {"credits": 1})
                        new_balance = int((doc or {}).get("credits", 0))
                    else:
                        async with get_or_use_session(None) as _db:
                            result = await _db.execute(select(UserModel).where(UserModel.username == username))
                            user = result.scalars().first()
                            if not user:
                                logger.error(f"User {username} not found for Razorpay credit")
                                raise HTTPException(status_code=404, detail="User not found")
                            user.credits = (user.credits or 0) + int(credits)
                            new_balance = user.credits
                            await _db.commit()
                    
                    logger.info(f"Razorpay: Credited {credits} credits to user {username}, new balance: {new_balance}")
                    await record_analytics_event(
                        "wallet_add_credit",
                        actor_username=username,
                        actor_role="user",
                        target_username=username,
                        source="wallet",
                        external_ref=f"razorpay:{payment_id}",
                        details={
                            "provider": "razorpay",
                            "order_id": order_id,
                            "payment_id": payment_id,
                            "bundle": bundle,
                            "credits_added": int(credits),
                            "new_balance": int(new_balance),
                        },
                    )
                    return {
                        "status": "success",
                        "order_id": order_id,
                        "payment_id": payment_id,
                        "credits_added": credits,
                        "new_balance": new_balance,
                        "message": f"Successfully added {credits} credits to your wallet"
                    }
    except aiohttp.ClientError as e:
        logger.error(f"Razorpay connection error: {e}")
        raise HTTPException(status_code=502, detail="Unable to connect to Razorpay API")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error verifying Razorpay payment: {e}")
        raise HTTPException(status_code=502, detail="Razorpay verification failed")

async def handle_razorpay_webhook(raw_body: bytes, headers_map: Dict[str, str]) -> Dict[str, Any]:
    """Handle Razorpay webhook for payment events
    
    Processes webhook events from Razorpay, particularly payment.captured events.
    Webhook signature is verified using HMAC SHA256.
    
    Reference: https://razorpay.com/docs/webhooks/
    """
    try:
        import json
        payload = json.loads(raw_body.decode("utf-8"))
        
        # Verify webhook signature
        webhook_signature = headers_map.get("x-razorpay-signature") or headers_map.get("X-Razorpay-Signature")
        if not webhook_signature or not settings.RAZORPAY_WEBHOOK_SECRET:
            logger.warning("Razorpay webhook signature missing or secret not configured")
            # Continue without signature verification if secret not set (for development)
            if settings.RAZORPAY_WEBHOOK_SECRET:
                raise HTTPException(status_code=400, detail="invalid_signature")
        else:
            # Verify webhook signature
            key_secret = settings.RAZORPAY_WEBHOOK_SECRET.strip().strip('"').strip("'")
            generated_signature = hmac.new(
                key_secret.encode('utf-8'),
                raw_body,
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(generated_signature, webhook_signature):
                logger.warning("Invalid Razorpay webhook signature")
                raise HTTPException(status_code=400, detail="invalid_signature")
        
        event = payload.get("event")
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        payment_link_entity = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
        
        # Handle Payment Link events
        if event == "payment_link.paid":
            payment_link_id = payment_link_entity.get("id")
            payment_id = payment_entity.get("id") if payment_entity else None
            
            if payment_link_id and payment_id:
                api_base = "https://api.razorpay.com/v1"
                key_id = settings.RAZORPAY_KEY_ID.strip().strip('"').strip("'")
                key_secret = settings.RAZORPAY_KEY_SECRET.strip().strip('"').strip("'")
                auth = aiohttp.BasicAuth(key_id, key_secret)
                
                async with aiohttp.ClientSession() as session:
                    payment_link_url = f"{api_base}/payment_links/{payment_link_id}"
                    headers = {"Content-Type": "application/json"}
                    
                    async with session.get(payment_link_url, auth=auth, headers=headers, timeout=15) as resp:
                        link_data = await resp.json()
                        if resp.status < 400:
                            notes = link_data.get("notes", {})
                            username = notes.get("username", "")
                            bundle = notes.get("bundle", "")
                            
                            if username and bundle:
                                bundle_info = map_bundle_to_usd_and_credits(bundle)
                                credits = bundle_info["credits"]
                                
                                # Credit the user
                                if settings.USE_MONGO:
                                    mdb = get_mongo_db()
                                    if mdb:
                                        await mdb.users.update_one({"username": username}, {"$inc": {"credits": int(credits)}})
                                else:
                                    async with get_or_use_session(None) as _db:
                                        result = await _db.execute(select(UserModel).where(UserModel.username == username))
                                        user = result.scalars().first()
                                        if user:
                                            user.credits = (user.credits or 0) + int(credits)
                                            await _db.commit()
                                
                                logger.info(f"Razorpay Payment Link webhook: Credited {credits} credits to user {username}")
                                await record_analytics_event(
                                    "wallet_add_credit",
                                    actor_username=username,
                                    actor_role="user",
                                    target_username=username,
                                    source="wallet_webhook",
                                    external_ref=f"razorpay:{payment_id}",
                                    details={
                                        "provider": "razorpay",
                                        "payment_link_id": payment_link_id,
                                        "payment_id": payment_id,
                                        "bundle": bundle,
                                        "credits_added": int(credits),
                                    },
                                )
        
        # Handle standard payment events
        if event == "payment.captured":
            payment_id = payment_entity.get("id")
            order_id = payment_entity.get("order_id")
            status = payment_entity.get("status")
            
            if status == "captured" and payment_id and order_id:
                # Get order details
                api_base = "https://api.razorpay.com/v1"
                key_id = settings.RAZORPAY_KEY_ID.strip().strip('"').strip("'")
                key_secret = settings.RAZORPAY_KEY_SECRET.strip().strip('"').strip("'")
                auth = aiohttp.BasicAuth(key_id, key_secret)
                
                async with aiohttp.ClientSession() as session:
                    order_url = f"{api_base}/orders/{order_id}"
                    headers = {"Content-Type": "application/json"}
                    
                    async with session.get(order_url, auth=auth, headers=headers, timeout=15) as resp:
                        order_data = await resp.json()
                        if resp.status < 400:
                            notes = order_data.get("notes", {})
                            username = notes.get("username", "")
                            bundle = notes.get("bundle", "")
                            
                            if username and bundle:
                                bundle_info = map_bundle_to_usd_and_credits(bundle)
                                credits = bundle_info["credits"]
                                
                                # Credit the user
                                if settings.USE_MONGO:
                                    mdb = get_mongo_db()
                                    if mdb:
                                        await mdb.users.update_one({"username": username}, {"$inc": {"credits": int(credits)}})
                                else:
                                    async with get_or_use_session(None) as _db:
                                        result = await _db.execute(select(UserModel).where(UserModel.username == username))
                                        user = result.scalars().first()
                                        if user:
                                            user.credits = (user.credits or 0) + int(credits)
                                            await _db.commit()
                                
                                logger.info(f"Razorpay webhook: Credited {credits} credits to user {username}")
                                await record_analytics_event(
                                    "wallet_add_credit",
                                    actor_username=username,
                                    actor_role="user",
                                    target_username=username,
                                    source="wallet_webhook",
                                    external_ref=f"razorpay:{payment_id}",
                                    details={
                                        "provider": "razorpay",
                                        "order_id": order_id,
                                        "payment_id": payment_id,
                                        "bundle": bundle,
                                        "credits_added": int(credits),
                                    },
                                )
        
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Razorpay webhook processing failed: {e}")
        raise HTTPException(status_code=500, detail="webhook_error")

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
            await record_analytics_event(
                "wallet_add_credit",
                actor_username=current_user.username,
                actor_role=getattr(current_user, "role", "user"),
                target_username=current_user.username,
                source="wallet",
                details={
                    "provider": "manual",
                    "credits_added": int(deposit.amount),
                    "new_balance": int(new_credits),
                },
            )
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
            await record_analytics_event(
                "wallet_add_credit",
                actor_username=current_user.username,
                actor_role=getattr(current_user, "role", "user"),
                target_username=current_user.username,
                source="wallet",
                details={
                    "provider": "manual",
                    "credits_added": int(deposit.amount),
                    "new_balance": int(new_credits),
                },
            )
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