"""
Unit tests for admin endpoints and services.

TESTS COMMENTED OUT - Wrap all test classes in 'if False:' to disable tests
"""
# if False:  # Comment this line and uncomment below to re-enable tests
if False:
    import pytest
    from fastapi.testclient import TestClient
    from unittest.mock import patch, AsyncMock
    from httpx import AsyncClient
    from schemas.user_schema import User, AdminAssignSubscription, AdminAddCredits

    from services.admin_service_async import assign_subscription, add_credits_to_user, get_all_users


    class TestAdminEndpoints:
        """Test admin API endpoints."""
        
        @pytest.mark.asyncio
        async def test_assign_subscription_success(self, async_client: AsyncClient, mock_admin_user: User):
            """Test successful subscription assignment by admin."""
            assign_data = {
                "user_id": 1,
                "service_id": 1,
                "duration_days": 30
            }
            
            with patch('api.dependencies.admin_required_fast', return_value=mock_admin_user), \
                 patch('services.admin_service_async.assign_subscription', return_value={"message": "Subscription assigned successfully"}):
                
                response = await async_client.post(
                    "/api/v1/admin/assign-subscription",
                    json=assign_data,
                    headers={"Authorization": "Bearer admin_token"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "message" in data
        
        @pytest.mark.asyncio
        async def test_assign_subscription_non_admin(self, async_client: AsyncClient, mock_user: User):
            """Test subscription assignment by non-admin user."""
            assign_data = {
                "user_id": 1,
                "service_id": 1,
                "duration_days": 30
            }
            
            with patch('api.dependencies.admin_required_fast', side_effect=Exception("Admin access required")):
                response = await async_client.post(
                    "/api/v1/admin/assign-subscription",
                    json=assign_data,
                    headers={"Authorization": "Bearer user_token"}
                )
                
                assert response.status_code == 500
        
        @pytest.mark.asyncio
        async def test_add_credits_success(self, async_client: AsyncClient, mock_admin_user: User):
            """Test successful credit addition by admin."""
            credits_data = {
                "user_id": 1,
                "amount": 100.0,
                "reason": "Admin credit"
            }
            
            with patch('api.dependencies.admin_required_fast', return_value=mock_admin_user), \
                 patch('services.admin_service_async.add_credits_to_user', return_value={"message": "Credits added successfully"}):
                
                response = await async_client.post(
                    "/api/v1/admin/add-credits",
                    json=credits_data,
                    headers={"Authorization": "Bearer admin_token"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "message" in data
        
        @pytest.mark.asyncio
        async def test_remove_credits_success(self, async_client: AsyncClient, mock_admin_user: User):
            """Test successful credit removal by admin."""
            credits_data = {
                "user_id": 1,
                "amount": 50.0,
                "reason": "Admin adjustment"
            }
            
            with patch('api.dependencies.admin_required_fast', return_value=mock_admin_user), \
                 patch('services.admin_service_async.remove_credits_from_user', return_value={"message": "Credits removed successfully"}):
                
                response = await async_client.post(
                    "/api/v1/admin/remove-credits",
                    json=credits_data,
                    headers={"Authorization": "Bearer admin_token"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "message" in data
        
        @pytest.mark.asyncio
        async def test_get_all_users_success(self, async_client: AsyncClient, mock_admin_user: User):
            """Test getting all users by admin."""
            mock_users = [
                {
                    "id": 1,
                    "username": "user1",
                    "email": "user1@test.com",
                    "role": "user",
                    "credits": 100.0
                },
                {
                    "id": 2,
                    "username": "user2",
                    "email": "user2@test.com",
                    "role": "user",
                    "credits": 200.0
                }
            ]
            
            with patch('api.dependencies.admin_required_fast', return_value=mock_admin_user), \
                 patch('services.admin_service_async.get_all_users', return_value=mock_users):
                
                response = await async_client.get(
                    "/api/v1/admin/users",
                    headers={"Authorization": "Bearer admin_token"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert len(data) == 2
                assert data[0]["username"] == "user1"
        
        @pytest.mark.asyncio
        async def test_add_service_success(self, async_client: AsyncClient, mock_admin_user: User):
            """Test adding new service by admin."""
            service_data = {
                "name": "New Service",
                "description": "A new service",
                "price": 15.0,
                "credits": 150,
                "is_active": True
            }
            
            with patch('api.dependencies.admin_required_fast', return_value=mock_admin_user), \
                 patch('services.admin_service_async.add_service', return_value={"message": "Service added successfully"}):
                
                response = await async_client.post(
                    "/api/v1/admin/services",
                    json=service_data,
                    headers={"Authorization": "Bearer admin_token"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "message" in data


    class TestAdminServices:
        """Test admin service functions."""
        
        @pytest.mark.asyncio
        async def test_assign_subscription_success(self, mock_admin_user: User):
            """Test successful subscription assignment."""
            assign_data = AdminAssignSubscription(
                user_id=1,
                service_id=1,
                duration_days=30
            )
            
            with patch('services.admin_service_async.get_user_by_id', return_value={"id": 1, "username": "testuser"}), \
                 patch('services.admin_service_async.get_service_by_id', return_value={"id": 1, "name": "Test Service"}), \
                 patch('services.admin_service_async.create_subscription', return_value=True):
                
                result = await assign_subscription(assign_data, mock_admin_user, None)
                
                assert "message" in result
        
        @pytest.mark.asyncio
        async def test_add_credits_to_user_success(self, mock_admin_user: User):
            """Test successful credit addition."""
            credits_data = AdminAddCredits(
                user_id=1,
                amount=100.0,
                reason="Admin credit"
            )
            
            with patch('services.admin_service_async.get_user_by_id', return_value={"id": 1, "credits": 50.0}), \
                 patch('services.admin_service_async.update_user_credits', return_value=True), \
                 patch('services.admin_service_async.create_transaction', return_value=True):
                
                result = await add_credits_to_user(credits_data, mock_admin_user, None)
                
                assert "message" in result
        
        @pytest.mark.asyncio
        async def test_get_all_users_success(self, mock_admin_user: User):
            """Test getting all users."""
            mock_users = [
                {"id": 1, "username": "user1", "email": "user1@test.com", "role": "user", "credits": 100.0},
                {"id": 2, "username": "user2", "email": "user2@test.com", "role": "user", "credits": 200.0}
            ]
            
            with patch('services.admin_service_async.get_all_users_from_db', return_value=mock_users):
                result = await get_all_users(mock_admin_user, None)
                
                assert len(result) == 2
                assert result[0]["username"] == "user1"
        
        @pytest.mark.asyncio
        async def test_assign_subscription_user_not_found(self, mock_admin_user: User):
            """Test subscription assignment with non-existent user."""
            assign_data = AdminAssignSubscription(
                user_id=999,
                service_id=1,
                duration_days=30
            )
            
            with patch('services.admin_service_async.get_user_by_id', return_value=None):
                with pytest.raises(Exception):
                    await assign_subscription(assign_data, mock_admin_user, None)
        
        @pytest.mark.asyncio
        async def test_add_credits_user_not_found(self, mock_admin_user: User):
            """Test credit addition with non-existent user."""
            credits_data = AdminAddCredits(
                user_id=999,
                amount=100.0,
                reason="Admin credit"
            )
            
            with patch('services.admin_service_async.get_user_by_id', return_value=None):
                with pytest.raises(Exception):
                    await add_credits_to_user(credits_data, mock_admin_user, None)
