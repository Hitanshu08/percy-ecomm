from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Dict, Optional

SECRET_KEY = "change-me"  # replace with a secure key in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
CREDIT_RATE = 10  # credits per currency unit

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI()

# In-memory user storage
# Each user record contains:
# {
#   "username": str,
#   "hashed_password": str,
#   "services": [{"name": str, "id": str, "password": str}],
#   "credits": int,
#   "btc_address": str
# }
fake_users_db: Dict[str, Dict[str, object]] = {}

class User(BaseModel):
    username: str
    disabled: Optional[bool] = False

class UserCreate(BaseModel):
    username: str
    password: str

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
    hashed_password = get_password_hash(user.password)
    # Create default service credentials and wallet
    fake_users_db[user.username] = {
        "username": user.username,
        "hashed_password": hashed_password,
        "services": [
            {"name": "Quillbot", "id": f"{user.username}-qb", "password": "pass1"},
            {"name": "Grammarly", "id": f"{user.username}-gram", "password": "pass2"},
        ],
        "credits": 0,
        "btc_address": f"btc-{user.username}"
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
    return {"services": user.get("services", [])}


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
