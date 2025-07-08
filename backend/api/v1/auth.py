from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from schemas.user_schema import Token
from services.user_service import login_user
from services.service_service import refresh_access_token

router = APIRouter()

@router.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    return login_user(form_data.username, form_data.password)

@router.post("/refresh", response_model=Token)
def refresh_token(request: dict):
    return refresh_access_token(request)

@router.get("/health")
def health_check():
    return {"status": "ok"} 