#!/usr/bin/env python3
"""
Migration script to add referral codes to existing users who don't have one.

Usage:
    python add_referral_codes_to_existing_users.py

This script will:
1. Find all users without a referral_code (SQL and MongoDB)
2. Generate unique 8-character alphanumeric codes for them
3. Update the database
"""

import asyncio
import logging
import random
import string
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_or_use_session, engine, async_sessionmaker
from db.models.user import User as UserModel
from core.config import settings
from db.mongodb import get_mongo_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")


def generate_referral_code() -> str:
    """Generate a unique 8-character alphanumeric referral code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(8))


async def add_referral_codes_mongodb():
    """Add referral codes to MongoDB users who don't have one"""
    mongo = get_mongo_db()
    if mongo is None:
        logger.warning("MongoDB not available, skipping MongoDB migration")
        return 0
    
    # Find all users without referral_code using $or to avoid duplicates
    from bson import ObjectId
    cursor = mongo.users.find({
        "$or": [
            {"referral_code": {"$exists": False}},
            {"referral_code": None},
            {"referral_code": ""}
        ]
    })
    users = await cursor.to_list(length=10000)
    
    if not users:
        logger.info("No users without referral codes in MongoDB")
        return 0
    
    # Remove duplicates by _id
    seen_ids = set()
    unique_users = []
    for user in users:
        user_id = str(user["_id"])
        if user_id not in seen_ids:
            seen_ids.add(user_id)
            unique_users.append(user)
    
    logger.info(f"Found {len(unique_users)} users without referral codes in MongoDB")
    
    updated = 0
    max_attempts = 10
    
    for user in unique_users:
        # Generate unique referral code
        referral_code = generate_referral_code()
        attempts = 0
        
        # Ensure uniqueness
        while attempts < max_attempts:
            existing = await mongo.users.find_one({"referral_code": referral_code})
            if not existing:
                break
            referral_code = generate_referral_code()
            attempts += 1
        
        if attempts >= max_attempts:
            logger.error(f"Failed to generate unique referral code for user {user.get('username')} after {max_attempts} attempts")
            continue
        
        # Update user
        result = await mongo.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"referral_code": referral_code}}
        )
        
        if result.modified_count > 0:
            updated += 1
            logger.info(f"Added referral code {referral_code} to user {user.get('username')}")
    
    logger.info(f"Updated {updated} users in MongoDB with referral codes")
    return updated


async def add_referral_codes_sql():
    """Add referral codes to SQL users who don't have one"""
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    updated = 0
    max_attempts = 10
    
    async with async_session() as session:
        # Find all users without referral_code or with NULL referral_code
        result = await session.execute(
            select(UserModel).where(
                (UserModel.referral_code == None) | (UserModel.referral_code == "")
            )
        )
        users = result.scalars().all()
        
        if not users:
            logger.info("No users without referral codes in SQL database")
            return 0
        
        logger.info(f"Found {len(users)} users without referral codes in SQL database")
        
        for user in users:
            # Generate unique referral code
            referral_code = generate_referral_code()
            attempts = 0
            
            # Ensure uniqueness
            while attempts < max_attempts:
                existing_result = await session.execute(
                    select(UserModel).where(UserModel.referral_code == referral_code)
                )
                if existing_result.scalars().first() is None:
                    break
                referral_code = generate_referral_code()
                attempts += 1
            
            if attempts >= max_attempts:
                logger.error(f"Failed to generate unique referral code for user {user.username} after {max_attempts} attempts")
                continue
            
            # Update user
            user.referral_code = referral_code
            updated += 1
            logger.info(f"Added referral code {referral_code} to user {user.username}")
        
        # Commit all changes
        await session.commit()
    
    logger.info(f"Updated {updated} users in SQL database with referral codes")
    return updated


async def main():
    """Main migration function"""
    logger.info("Starting referral code migration for existing users...")
    
    sql_updated = 0
    mongo_updated = 0
    
    try:
        if not settings.USE_MONGO:
            sql_updated = await add_referral_codes_sql()
        else:
            mongo_updated = await add_referral_codes_mongodb()
        
        logger.info("=" * 50)
        logger.info("Migration Summary:")
        logger.info(f"SQL users updated: {sql_updated}")
        logger.info(f"MongoDB users updated: {mongo_updated}")
        logger.info("=" * 50)
        logger.info("Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())

