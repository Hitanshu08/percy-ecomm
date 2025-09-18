from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from schemas.user_schema import Token
from services.user_service import login_user, request_password_reset, reset_password_with_otp, verify_password_reset_otp
from services.service_service import refresh_access_token
from utils.responses import no_store_json
from utils.timing import timeit

router = APIRouter()

@timeit()
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    return no_store_json(await login_user(form_data.username, form_data.password))

@timeit()
@router.post("/refresh", response_model=Token)
async def refresh_token(request: dict):
    return no_store_json(await refresh_access_token(request))

@timeit()
@router.post("/forgot-password")
async def forgot_password(payload: dict):
    email = payload.get("email", "").strip()
    return no_store_json(await request_password_reset(email))

@timeit()
@router.post("/reset-password")
async def reset_password(payload: dict):
    email = (payload.get("email") or "").strip()
    otp = (payload.get("otp") or "").strip()
    new_password = (payload.get("new_password") or "").strip()
    return no_store_json(await reset_password_with_otp(email, otp, new_password))

@timeit()
@router.post("/verify-otp")
async def verify_otp(payload: dict):
    email = (payload.get("email") or "").strip()
    otp = (payload.get("otp") or "").strip()
    return no_store_json(await verify_password_reset_otp(email, otp))

@timeit()
@router.get("/health")
async def health_check():
    return {"status": "ok"}