from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Dict, Optional, List
import os

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me")  # replace with a secure key in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
CREDIT_RATE = 10  # credits per currency unit

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI()

# Available services and their credentials managed centrally. Passwords are stored
# hashed to avoid exposing them in plain text.
services_db = {
    "Quillbot": {"id": "qb", "password_hash": pwd_context.hash("pass1")},
    "Grammarly": {"id": "gram", "password_hash": pwd_context.hash("pass2")},
}

# In-memory user storage
# Each user record contains:
# {
#   "username": str,
#   "user_id": str,
#   "hashed_password": str,
#   "role": str,
#   "services": [{"name": str, "id": str, "password": str}],
#   "credits": int,
#   "btc_address": str,
#   "notifications": List[str]
# }
fake_users_db: Dict[str, Dict[str, object]] = {}

# Create a default admin user
admin_password = get_password_hash("adminpass")
fake_users_db["admin"] = {
    "username": "admin",
    "user_id": "admin",
    "hashed_password": admin_password,
    "role": "admin",
    "services": [
        {"name": name, "id": cred["id"], "password_hash": cred["password_hash"]}
        for name, cred in services_db.items()
    ],
    "credits": 0,
    "btc_address": "btc-admin",
    "notifications": [],
}

class User(BaseModel):
    username: str
    user_id: str
    role: str = "user"
    disabled: Optional[bool] = False

class UserCreate(BaseModel):
    username: str
    password: str
    user_id: str

class UserInDB(User):
    hashed_password: str

class ChangePassword(BaseModel):
    old_password: str
    new_password: str

class Deposit(BaseModel):
    amount: float

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    user = fake_users_db.get(username)
    if not user or not verify_password(password, user["hashed_password"]):
        return None
    return UserInDB(**user)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def admin_required(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = fake_users_db.get(username)
    if user is None:
        raise credentials_exception
    return User(**user)

@app.post("/signup")
async def signup(user: UserCreate):
    if user.username in fake_users_db:
        raise HTTPException(status_code=400, detail="Username already registered")
    if any(u.get("user_id") == user.user_id for u in fake_users_db.values()):
        suggestions = [f"{user.user_id}{i}" for i in range(1, 4)]
        raise HTTPException(status_code=400, detail=f"user_id_exists:{','.join(suggestions)}")
    hashed_password = get_password_hash(user.password)
    # Create default service credentials and wallet
    fake_users_db[user.username] = {
        "username": user.username,
        "user_id": user.user_id,
        "hashed_password": hashed_password,
        "role": "user",
        "services": [
            {"name": name, "id": cred["id"], "password_hash": cred["password_hash"]}
            for name, cred in services_db.items()
        ],
        "credits": 0,
        "btc_address": f"btc-{user.username}",
        "notifications": [],
    }
    return {"msg": "User created"}

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username},
                                      expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/dashboard")
async def get_dashboard(current_user: User = Depends(get_current_user)):
    user = fake_users_db[current_user.username]
    return {"services": [ {"name": s["name"]} for s in user.get("services", []) ]}


@app.post("/change-password")
async def change_password(data: ChangePassword, current_user: User = Depends(get_current_user)):
    user_record = fake_users_db[current_user.username]
    if not verify_password(data.old_password, user_record["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect password")
    user_record["hashed_password"] = get_password_hash(data.new_password)
    return {"msg": "Password updated"}


@app.get("/wallet")
async def get_wallet(current_user: User = Depends(get_current_user)):
    user = fake_users_db[current_user.username]
    return {"credits": user.get("credits", 0), "btc_address": user.get("btc_address")}


@app.post("/wallet/deposit")
async def wallet_deposit(dep: Deposit, current_user: User = Depends(get_current_user)):
    user = fake_users_db[current_user.username]
    credits = int(dep.amount * CREDIT_RATE)
    user["credits"] = user.get("credits", 0) + credits
    return {"credits": user["credits"]}


@app.get("/subscriptions")
async def get_subscriptions(current_user: User = Depends(get_current_user)):
    """Return the user's active subscriptions."""
    user = fake_users_db[current_user.username]
    return {"subscriptions": [ {"name": s["name"]} for s in user.get("services", []) ]}


@app.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    user = fake_users_db[current_user.username]
    notes = user.get("notifications", [])[:]
    user["notifications"] = []
    return {"notifications": notes}


class SubscriptionRequest(BaseModel):
    username: str
    service_name: str


class ServiceUpdate(BaseModel):
    service_name: str
    new_id: str
    new_password: str


@app.post("/admin/add-subscription")
async def admin_add_subscription(req: SubscriptionRequest, user: User = Depends(admin_required)):
    target = fake_users_db.get(req.username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    cred = services_db.get(req.service_name)
    if not cred:
        raise HTTPException(status_code=404, detail="Service not found")
    if not any(s["name"] == req.service_name for s in target["services"]):
        target["services"].append({"name": req.service_name, "id": cred["id"], "password_hash": cred["password_hash"]})
        target["notifications"].append(f"Subscribed to {req.service_name}")
    return {"msg": "subscription added"}


@app.post("/admin/update-service")
async def admin_update_service(update: ServiceUpdate, user: User = Depends(admin_required)):
    if update.service_name not in services_db:
        raise HTTPException(status_code=404, detail="Service not found")
    hashed = get_password_hash(update.new_password)
    services_db[update.service_name] = {"id": update.new_id, "password_hash": hashed}
    # Update all user credentials and send notifications
    for u in fake_users_db.values():
        for svc in u.get("services", []):
            if svc["name"] == update.service_name:
                svc["id"] = update.new_id
                svc["password_hash"] = hashed
                u.setdefault("notifications", []).append(f"Credentials updated for {update.service_name}")
    return {"msg": "service updated"}
