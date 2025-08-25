from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from schemas.user_schema import Token
from services.user_service import login_user
from services.service_service import refresh_access_token
from utils.responses import no_store_json

router = APIRouter()

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    return no_store_json(login_user(form_data.username, form_data.password))

@router.post("/refresh", response_model=Token)
def refresh_token(request: dict):
    return no_store_json(refresh_access_token(request))

@router.get("/health")
def health_check():
    return {"status": "ok"} 