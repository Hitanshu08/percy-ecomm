from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class User(UserBase):
    user_id: str
    role: str
    services: List[Dict[str, Any]]
    credits: int
    btc_address: str
    notifications: List[str]

    class Config:
        from_attributes = True
        extra = "ignore"

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class CreditDeposit(BaseModel):
    amount: int

class AdminAddCredits(BaseModel):
    username: str
    credits: int

class AdminAssignSubscription(BaseModel):
    username: str
    service_id: str
    end_date: str

class SubscriptionPurchase(BaseModel):
    service_name: str
    duration: str

class UserLogin(BaseModel):
    username: str
    password: str 