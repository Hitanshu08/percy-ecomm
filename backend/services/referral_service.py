from db.session import get_or_use_session
from db.models.user import User as UserModel
from db.models.subscription import UserSubscription
from db.models.referral import ReferralCredit
from db.mongodb import get_mongo_db
from core.config import settings
from config import config
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import logging
from utils.timing import timeit

logger = logging.getLogger(__name__)

@timeit("check_and_award_referral_credit")
async def check_and_award_referral_credit(user_id: int, subscription_id: int = None, db: AsyncSession = None):
    """
    Check if this is user's first subscription and award referral credit to referrer.
    This is a one-time credit per referred user, triggered immediately upon first subscription.
    Call this AFTER creating the subscription to check if it's the first one.
    """
    try:
        # Get referral credit amount from config
        referral_credit_amount = config.get_referral_credit_amount()
        mongo = get_mongo_db()
        if settings.USE_MONGO and (mongo is not None):
            # Get user - user_id might be ObjectId string or username
            from bson import ObjectId
            try:
                user = await mongo.users.find_one({"_id": ObjectId(user_id)})
            except Exception:
                # Try finding by username instead
                user = await mongo.users.find_one({"username": str(user_id)})
            if not user:
                logger.warning(f"User {user_id} not found for referral credit check")
                return
            user_mongo_id = user["_id"]
            
            # Check if user was referred
            referred_by_user_id = user.get("referred_by_user_id")
            if not referred_by_user_id:
                # User was not referred, no credit to award
                return
            
            # Normalize referred_by_user_id - it might be stored as string representation of ObjectId
            referrer_id_for_query = referred_by_user_id
            try:
                # If it's a string that looks like ObjectId, convert it
                if isinstance(referred_by_user_id, str) and len(referred_by_user_id) == 24:
                    referrer_id_for_query = ObjectId(referred_by_user_id)
            except Exception:
                pass
            
            # Check if referral credit already awarded
            # Try multiple query formats to handle different storage formats
            existing_credit = None
            query_variants = [
                {"referrer_user_id": referrer_id_for_query, "referred_user_id": user_mongo_id},
                {"referrer_user_id": str(referrer_id_for_query), "referred_user_id": str(user_mongo_id)},
                {"referrer_user_id": ObjectId(referred_by_user_id) if isinstance(referred_by_user_id, str) and len(str(referred_by_user_id)) == 24 else referred_by_user_id, "referred_user_id": user_mongo_id},
            ]
            
            for query in query_variants:
                try:
                    existing_credit = await mongo.referral_credits.find_one(query)
                    if existing_credit:
                        break
                except Exception:
                    continue
            if existing_credit:
                # Credit already awarded for this referral
                logger.info(f"Referral credit already awarded for user {user_id} by referrer {referred_by_user_id}")
                return
            
            # Check if this is user's first subscription
            # Count all subscriptions for this user (including the one we just created)
            existing_subs = await mongo.subscriptions.find({"username": user.get("username")}).to_list(length=1000)
            if len(existing_subs) != 1:  # Not exactly 1 means this is not the first
                logger.info(f"User {user_id} has {len(existing_subs)} subscriptions, skipping referral credit (only first subscription triggers credit)")
                return
            
            # Award credit to referrer
            # Try to find referrer by ObjectId first, then by string
            referrer = None
            try:
                # If referred_by_user_id is stored as string, convert to ObjectId
                if isinstance(referred_by_user_id, str):
                    if len(referred_by_user_id) == 24:
                        # Looks like ObjectId string
                        referrer = await mongo.users.find_one({"_id": ObjectId(referred_by_user_id)})
                    else:
                        # Try as username
                        referrer = await mongo.users.find_one({"username": referred_by_user_id})
                else:
                    # Assume it's already an ObjectId
                    referrer = await mongo.users.find_one({"_id": referred_by_user_id})
            except Exception as e:
                logger.warning(f"Error finding referrer {referred_by_user_id}: {e}")
                # Try as username as fallback
                try:
                    referrer = await mongo.users.find_one({"username": str(referred_by_user_id)})
                except Exception:
                    pass
            
            if not referrer:
                logger.warning(f"Referrer {referred_by_user_id} not found")
                return
            referrer_mongo_id = referrer["_id"]
            
            # Add referral credit to referrer
            await mongo.users.update_one(
                {"_id": referrer_mongo_id},
                {"$inc": {"credits": referral_credit_amount}}
            )
            
            # Record referral credit (ensure collection exists)
            # Store both ObjectId and string format for flexibility
            referral_credit_doc = {
                "referrer_user_id": referrer_mongo_id,
                "referred_user_id": user_mongo_id,
                "subscription_id": str(subscription_id) if subscription_id else None,
                "credits_awarded": referral_credit_amount,
                "created_at": datetime.utcnow().isoformat()
            }
            try:
                await mongo.referral_credits.insert_one(referral_credit_doc)
            except Exception as e:
                logger.error(f"Error inserting referral credit record: {e}")
                # Don't fail the whole operation if recording fails
            
            logger.info(f"Awarded {referral_credit_amount} referral credit(s) to user {referrer_mongo_id} for referred user {user_mongo_id}")
            return
        
        # SQL path
        async with get_or_use_session(db) as _db:
            # Get user
            user_result = await _db.execute(select(UserModel).where(UserModel.id == user_id))
            user = user_result.scalars().first()
            if not user:
                logger.warning(f"User {user_id} not found for referral credit check")
                return
            
            # Check if user was referred
            if not user.referred_by_user_id:
                # User was not referred, no credit to award
                return
            
            # Check if referral credit already awarded
            existing_credit_result = await _db.execute(
                select(ReferralCredit).where(
                    ReferralCredit.referrer_user_id == user.referred_by_user_id,
                    ReferralCredit.referred_user_id == user_id
                )
            )
            if existing_credit_result.scalars().first():
                # Credit already awarded for this referral
                logger.info(f"Referral credit already awarded for user {user_id} by referrer {user.referred_by_user_id}")
                return
            
            # Check if this is user's first subscription
            # Count all subscriptions for this user (including the one we just created)
            existing_subs_result = await _db.execute(
                select(UserSubscription).where(UserSubscription.user_id == user_id)
            )
            existing_subs = existing_subs_result.scalars().all()
            if len(existing_subs) != 1:  # Not exactly 1 means this is not the first
                logger.info(f"User {user_id} has {len(existing_subs)} subscriptions, skipping referral credit (only first subscription triggers credit)")
                return
            
            # Get referrer
            referrer_result = await _db.execute(
                select(UserModel).where(UserModel.id == user.referred_by_user_id)
            )
            referrer = referrer_result.scalars().first()
            if not referrer:
                logger.warning(f"Referrer {user.referred_by_user_id} not found")
                return
            
            # Add referral credit to referrer
            referrer.credits = (referrer.credits or 0) + referral_credit_amount
            
            # Record referral credit
            referral_credit = ReferralCredit(
                referrer_user_id=referrer.id,
                referred_user_id=user.id,
                subscription_id=subscription_id,
                credits_awarded=referral_credit_amount
            )
            _db.add(referral_credit)
            await _db.commit()
            
            logger.info(f"Awarded {referral_credit_amount} referral credit(s) to user {referrer.id} for referred user {user.id}")
            return
    except Exception as e:
        logger.error(f"Error checking and awarding referral credit: {e}")
        # Don't raise exception - referral credit is bonus feature, shouldn't break subscription creation

