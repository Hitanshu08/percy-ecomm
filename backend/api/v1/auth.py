from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from schemas.user_schema import Token
from services.user_service import login_user
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
@router.get("/health")
async def health_check():
    return {"status": "ok"}