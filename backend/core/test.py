from passlib.context import CryptContext


password = "adminpass"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

print(pwd_context.hash(password))