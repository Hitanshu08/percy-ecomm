from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    referral_code: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class User(UserBase):
    user_id: str
    role: str
    services: List[Dict[str, Any]]
    credits: int
    btc_address: str

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
    service_id: Optional[str] = None  # If provided, add credits to specific subscription

class AdminRemoveCredits(BaseModel):
    username: str
    credits: int
    service_id: Optional[str] = None  # If provided, remove credits from specific subscription

class AdminRemoveSubscription(BaseModel):
    username: str
    service_id: str  # subscription's service_id (account id)

class AdminUpdateSubscriptionEndDate(BaseModel):
    username: Optional[str] = None
    service_id: Optional[str] = None
    end_date: str  # dd/mm/yyyy

class AdminUpdateSubscriptionActive(BaseModel):
    username: str
    service_id: str
    is_active: bool

class AdminAssignSubscription(BaseModel):
    username: str
    # Either provide service_id + end_date, or service_name + duration
    service_id: Optional[str] = None
    end_date: Optional[str] = None
    service_name: Optional[str] = None
    duration: Optional[str] = None

class SubscriptionPurchase(BaseModel):
    service_name: str
    duration: str

class UserLogin(BaseModel):
    username: str
    password: str 