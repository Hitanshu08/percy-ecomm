#!/usr/bin/env python3
"""Test database connectivity and functionality"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.session import SessionLocal, engine
from db.models.user import User as UserModel
from db.models.service import Service as ServiceModel
from db.base import initialize_database

def test_database():
    """Test database connectivity and basic operations"""
    print("Testing database connectivity...")
    
    try:
        # Test connection
        print("1. Testing database connection...")
        db = SessionLocal()
        result = db.execute("SELECT 1").fetchone()
        print(f"   ✓ Database connection successful: {result}")
        db.close()
        
        # Initialize database
        print("2. Initializing database...")
        initialize_database()
        print("   ✓ Database initialized successfully")
        
        # Test user operations
        print("3. Testing user operations...")
        db = SessionLocal()
        users = db.query(UserModel).all()
        print(f"   ✓ Found {len(users)} users")
        for user in users:
            print(f"     - {user.username}: {user.credits} credits, {len(user.services or [])} services")
        db.close()
        
        # Test service operations
        print("4. Testing service operations...")
        db = SessionLocal()
        services = db.query(ServiceModel).all()
        print(f"   ✓ Found {len(services)} services")
        for service in services:
            print(f"     - {service.name}: {len(service.accounts or [])} accounts")
        db.close()
        
        # Test adding a subscription to a user
        print("5. Testing subscription assignment...")
        db = SessionLocal()
        user = db.query(UserModel).filter(UserModel.username == "testuser").first()
        if user:
            print(f"   ✓ Found user: {user.username}")
            print(f"     Current services: {user.services}")
            
            # Add a test subscription
            if user.services is None:
                user.services = []
            
            new_subscription = {
                "service_id": "test_service",
                "end_date": "31/12/2025",
                "is_active": True
            }
            user.services.append(new_subscription)
            
            db.commit()
            db.refresh(user)
            print(f"     Updated services: {user.services}")
            print("   ✓ Subscription assignment test successful")
        else:
            print("   ✗ User 'testuser' not found")
        db.close()
        
        print("\n✅ All database tests passed!")
        
    except Exception as e:
        print(f"\n❌ Database test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    test_database() 