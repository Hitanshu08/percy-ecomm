from db.session import SessionLocal
from db.models.user import User as UserModel
import re

def is_bcrypt_hash(s):
    # Bcrypt hashes start with $2b$ or $2a$ and are 60 chars long
    return isinstance(s, str) and re.match(r"^\$2[abxy]\$.{56}$", s)

def fix_password_hashes():
    from core.security import get_password_hash  # moved here to avoid circular import
    db = SessionLocal()
    updated = 0
    try:
        for user in db.query(UserModel).all():
            hashed = user.hashed_password
            if not is_bcrypt_hash(hashed):
                print(f"Fixing user: {user.username} (old hash: {hashed})")
                user.hashed_password = get_password_hash(hashed)
                updated += 1
        if updated:
            db.commit()
    finally:
        db.close()

    print(f"Updated {updated} user(s).")

if __name__ == "__main__":
    fix_password_hashes() 