from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class ServiceAccount(BaseModel):
    id: str
    password: str
    end_date: str
    is_active: bool = True

class ServiceCreate(BaseModel):
    name: str
    image: str
    accounts: List[ServiceAccount]

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    image: Optional[str] = None
    accounts: Optional[List[ServiceAccount]] = None

class Service(ServiceCreate):
    available_accounts: int
    expiring_soon_accounts: int
    total_accounts: int
    expiring_soon: List[Dict[str, Any]]
    available: List[Dict[str, Any]]

    class Config:
        from_attributes = True

class ServiceDetail(BaseModel):
    name: str
    image: str
    accounts: List[Dict[str, Any]]

class ServiceResponse(BaseModel):
    services: List[Service]
    message: Optional[str] = None

class ServiceDetailResponse(BaseModel):
    service_name: str
    accounts: List[Dict[str, Any]]
    message: Optional[str] = None 