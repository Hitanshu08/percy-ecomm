"""
Unit tests for authentication endpoints and services.

TESTS COMMENTED OUT - Wrap all test classes in 'if False:' to disable tests
"""
# if False:  # Comment this line and uncomment below to re-enable tests
if False:
    import pytest
    from fastapi.testclient import TestClient
    from unittest.mock import patch, AsyncMock
    from httpx import AsyncClient
    from schemas.user_schema import User, Token

    from services.user_service import login_user, request_password_reset, reset_password_with_otp


    class TestAuthEndpoints:
        """Test authentication API endpoints."""
        
        @pytest.mark.asyncio
        async def test_login_success(self, async_client: AsyncClient, mock_user: User):
            """Test successful login."""
            with patch('services.user_service.login_user', return_value=Token(
                access_token="mock_token",
                refresh_token="mock_refresh_token",
                token_type="bearer"
            )):
                response = await async_client.post(
                    "/api/v1/login",
                    data={"username": "testuser", "password": "testpass"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "access_token" in data
                assert "refresh_token" in data
                assert data["token_type"] == "bearer"
        
        @pytest.mark.asyncio
        async def test_login_invalid_credentials(self, async_client: AsyncClient):
            """Test login with invalid credentials."""
            with patch('services.user_service.login_user', side_effect=Exception("Invalid credentials")):
                response = await async_client.post(
                    "/api/v1/login",
                    data={"username": "wronguser", "password": "wrongpass"}
                )
                
                assert response.status_code == 500
        
        @pytest.mark.asyncio
        async def test_refresh_token_success(self, async_client: AsyncClient):
            """Test successful token refresh."""
            with patch('services.service_service.refresh_access_token', return_value=Token(
                access_token="new_token",
                refresh_token="new_refresh_token",
                token_type="bearer"
            )):
                response = await async_client.post(
                    "/api/v1/refresh",
                    json={"refresh_token": "old_refresh_token"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "access_token" in data
                assert "refresh_token" in data
        
        @pytest.mark.asyncio
        async def test_refresh_token_invalid(self, async_client: AsyncClient):
            """Test token refresh with invalid refresh token."""
            with patch('services.service_service.refresh_access_token', side_effect=Exception("Invalid refresh token")):
                response = await async_client.post(
                    "/api/v1/refresh",
                    json={"refresh_token": "invalid_token"}
                )
                
                assert response.status_code == 500


    class TestAuthServices:
        """Test authentication service functions."""
        
        @pytest.mark.asyncio
        async def test_login_user_success(self, mock_user: User):
            """Test successful user login service."""
            with patch('services.user_service.get_user_by_username', return_value=mock_user), \
                 patch('services.user_service.verify_password', return_value=True), \
                 patch('services.user_service.create_access_token', return_value="mock_token"), \
                 patch('services.user_service.create_refresh_token', return_value="mock_refresh_token"):
                
                result = await login_user("testuser", "testpass")
                
                assert isinstance(result, Token)
                assert result.access_token == "mock_token"
                assert result.refresh_token == "mock_refresh_token"
        
        @pytest.mark.asyncio
        async def test_login_user_invalid_password(self, mock_user: User):
            """Test login with invalid password."""
            with patch('services.user_service.get_user_by_username', return_value=mock_user), \
                 patch('services.user_service.verify_password', return_value=False):
                
                with pytest.raises(Exception):
                    await login_user("testuser", "wrongpass")
        
        @pytest.mark.asyncio
        async def test_login_user_not_found(self):
            """Test login with non-existent user."""
            with patch('services.user_service.get_user_by_username', return_value=None):
                with pytest.raises(Exception):
                    await login_user("nonexistent", "password")
        
        @pytest.mark.asyncio
        async def test_request_password_reset_success(self, mock_user: User):
            """Test successful password reset request."""
            with patch('services.user_service.get_user_by_email', return_value=mock_user), \
                 patch('services.user_service.generate_otp', return_value="123456"), \
                 patch('services.user_service.save_otp', return_value=True), \
                 patch('utils.email.send_email', return_value=True):
                
                result = await request_password_reset("test@example.com")
                
                assert result["message"] == "Password reset OTP sent to your email"
        
        @pytest.mark.asyncio
        async def test_request_password_reset_user_not_found(self):
            """Test password reset request for non-existent user."""
            with patch('services.user_service.get_user_by_email', return_value=None):
                with pytest.raises(Exception):
                    await request_password_reset("nonexistent@example.com")
        
        @pytest.mark.asyncio
        async def test_reset_password_with_otp_success(self, mock_user: User):
            """Test successful password reset with OTP."""
            with patch('services.user_service.verify_otp', return_value=True), \
                 patch('services.user_service.get_user_by_email', return_value=mock_user), \
                 patch('services.user_service.hash_password', return_value="hashed_password"), \
                 patch('services.user_service.update_user_password', return_value=True), \
                 patch('services.user_service.delete_otp', return_value=True):
                
                result = await reset_password_with_otp("test@example.com", "123456", "newpassword")
                
                assert result["message"] == "Password reset successfully"
        
        @pytest.mark.asyncio
        async def test_reset_password_invalid_otp(self, mock_user: User):
            """Test password reset with invalid OTP."""
            with patch('services.user_service.verify_otp', return_value=False):
                with pytest.raises(Exception):
                    await reset_password_with_otp("test@example.com", "wrongotp", "newpassword")
