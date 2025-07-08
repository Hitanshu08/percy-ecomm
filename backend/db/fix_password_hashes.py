from db.mongodb import get_sync_users_collection
import re

def is_bcrypt_hash(s):
    # Bcrypt hashes start with $2b$ or $2a$ and are 60 chars long
    return isinstance(s, str) and re.match(r"^\$2[abxy]\$.{56}$", s)

def fix_password_hashes():
    from core.security import get_password_hash  # moved here to avoid circular import
    users_collection = get_sync_users_collection()
    users = list(users_collection.find({}))
    updated = 0

    for user in users:
        hashed = user.get("hashed_password")
        if not is_bcrypt_hash(hashed):
            print(f"Fixing user: {user['username']} (old hash: {hashed})")
            new_hash = get_password_hash(hashed)
            users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"hashed_password": new_hash}}
            )
            updated += 1

    print(f"Updated {updated} user(s).")

if __name__ == "__main__":
    fix_password_hashes() 