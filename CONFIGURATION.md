# Configuration Guide

This document explains the configuration system for the Percy E-commerce Platform.

## Overview

The platform uses a hybrid configuration approach:
- **Static configuration**: JSON files for app settings, API endpoints, and business logic
- **Environment variables**: For security settings, admin credentials, and environment-specific values
- **Database**: For dynamic data like admin services, user data, and runtime configurations
- **Code**: For UI settings and component-specific configurations

## Backend Configuration

### config.json
Contains static application settings:

```json
{
  "app": {
    "name": "Percy E-commerce Platform",
    "version": "1.0.0",
    "description": "Subscription-based e-commerce platform for digital services"
  },
  "cors": {
    "development": {
      "allow_origins": ["*"],
      "allow_credentials": true,
      "allow_methods": ["*"],
      "allow_headers": ["*"]
    },
    "production": {
      "allow_origins": [
        "https://yourdomain.com",
        "https://www.yourdomain.com",
        "https://app.yourdomain.com"
      ],
      "allow_credentials": true,
      "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      "allow_headers": ["*"]
    }
  },
  "credits": {
    "credit_rate": 10,
    "daily_credit_rate": 1,
    "admin_starting_credits": 100000,
    "usd_to_credits_rate": 1
  },
  "subscription_durations": {
    "7days": {
      "name": "7 Days",
      "days": 7,
      "credits_cost": 50
    },
    "1month": {
      "name": "1 Month",
      "days": 30,
      "credits_cost": 200
    },
    "3months": {
      "name": "3 Months",
      "days": 90,
      "credits_cost": 500
    },
    "6months": {
      "name": "6 Months",
      "days": 180,
      "credits_cost": 900
    },
    "1year": {
      "name": "1 Year",
      "days": 365,
      "credits_cost": 1500
    }
  },
  "api": {
    "endpoints": {
      "health": "/health",
      "signup": "/signup",
      "login": "/token",
      "me": "/me",
      "dashboard": "/dashboard",
      "change_password": "/change-password",
      "wallet": "/wallet",
      "wallet_deposit": "/wallet/deposit",
      "subscriptions": "/subscriptions",
      "notifications": "/notifications",
      "services": "/services",
      "purchase_subscription": "/purchase-subscription",
      "refresh_token": "/refresh",
      "current_subscriptions": "/user/subscriptions/current",
      "admin": {
        "services": "/admin/services",
        "users": "/admin/users",
        "add_credits": "/admin/add-credits",
        "assign_subscription": "/admin/assign-subscription"
      }
    }
  },
  "logging": {
    "level": "INFO",
    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
  }
}
```

### Environment Variables (.env)
Security and environment-specific settings:

```bash
# Security Settings
SECRET_KEY=your-super-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Admin Settings
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@percy.com
ADMIN_PASSWORD=Admin@1234
ADMIN_USER_ID=admin
ADMIN_ROLE=admin

# Environment
ENVIRONMENT=development

# Database Settings (for future use)
DATABASE_URL=sqlite:///./percy_ecomm.db

# API Settings
API_BASE_URL=https://devmens.com
```

### Database-Based Configuration
The following data is stored in the database (not in config files):
- **Admin services**: Service accounts, credentials, availability
- **User data**: Profiles, subscriptions, credits
- **Dynamic settings**: Runtime configurations that change frequently

## Frontend Configuration

### config.json
Contains static application settings:

```json
{
  "app": {
    "name": "Percy E-commerce Platform",
    "version": "1.0.0",
    "description": "Subscription-based e-commerce platform for digital services"
  },
  "api": {
    "base_url": "https://devmens.com",
    "endpoints": {
      "health": "/health",
      "signup": "/signup",
      "login": "/token",
      "me": "/me",
      "dashboard": "/dashboard",
      "change_password": "/change-password",
      "wallet": "/wallet",
      "wallet_deposit": "/wallet/deposit",
      "subscriptions": "/subscriptions",
      "notifications": "/notifications",
      "services": "/services",
      "purchase_subscription": "/purchase-subscription",
      "refresh_token": "/refresh",
      "current_subscriptions": "/user/subscriptions/current",
      "admin": {
        "services": "/admin/services",
        "users": "/admin/users",
        "add_credits": "/admin/add-credits",
        "assign_subscription": "/admin/assign-subscription"
      }
    }
  },
  "credits": {
    "credit_rate": 10,
    "daily_credit_rate": 1,
    "admin_starting_credits": 100000,
    "usd_to_credits_rate": 1
  },
  "subscription_durations": {
    "7days": {
      "name": "7 Days",
      "days": 7,
      "credits_cost": 50
    },
    "1month": {
      "name": "1 Month",
      "days": 30,
      "credits_cost": 200
    },
    "3months": {
      "name": "3 Months",
      "days": 90,
      "credits_cost": 500
    },
    "6months": {
      "name": "6 Months",
      "days": 180,
      "credits_cost": 900
    },
    "1year": {
      "name": "1 Year",
      "days": 365,
      "credits_cost": 1500
    }
  },
  "contact": {
    "telegram": "https://t.me/#CorrectingSomething"
  }
}
```

### Environment Variables (.env)
Environment-specific settings:

```bash
# API Configuration
VITE_API_BASE_URL=https://devmens.com

# Environment
VITE_ENVIRONMENT=development

# Debug Mode
VITE_DEBUG=false
```

### Code-Based Configuration
UI settings are defined directly in the code:
- **Theme settings**: Colors, fonts, spacing
- **Navigation**: Menu items, routing
- **Component settings**: Form validation, pagination
- **Feature flags**: UI feature toggles

## Configuration Usage

### Backend Usage

```python
from config import config

# Get specific configuration
cors_config = config.get_cors_config("development")
credits_config = config.get_credits_config()
subscription_durations = config.get_subscription_durations()

# Get nested configuration
credit_rate = config.get("credits.credit_rate", 10)
api_endpoint = config.get("api.endpoints.login", "/token")

# Environment variables
import os
secret_key = os.environ.get("SECRET_KEY", "default")
admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@1234")
```

### Frontend Usage

```typescript
import config from './config';

// Get specific configuration
const appConfig = config.getAppConfig();
const apiConfig = config.getApiConfig();
const creditsConfig = config.getCreditsConfig();

// Get API URL
const loginUrl = config.getApiUrl('/token');

// Get nested configuration
const creditRate = config.get('credits.credit_rate', 10);
const telegramUrl = config.get('contact.telegram', '');

// Environment variables
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const isProduction = import.meta.env.VITE_ENVIRONMENT === 'production';
```

## Security Best Practices

1. **Never commit sensitive data** to version control
2. **Use environment variables** for all secrets and credentials
3. **Rotate secrets regularly** in production
4. **Use strong, unique passwords** for admin accounts
5. **Validate environment variables** on application startup
6. **Use HTTPS** in production environments
7. **Implement proper CORS** policies for production

## Environment Setup

### Development
1. Copy `env.example` to `.env`
2. Update values as needed
3. Ensure database is properly configured
4. Start the application

### Production
1. Set all required environment variables
2. Use strong, unique secrets
3. Configure proper CORS origins
4. Set up database with proper credentials
5. Use HTTPS endpoints
6. Enable proper logging

## Configuration Management

### Adding New Configuration
1. **Static settings**: Add to appropriate `config.json`
2. **Environment-specific**: Add to `.env` files
3. **Dynamic data**: Store in database
4. **UI settings**: Define in component code

### Updating Configuration
1. **Development**: Update local `.env` file
2. **Production**: Update environment variables
3. **Database**: Use admin interface or direct database access
4. **Code**: Update and redeploy

### Validation
- Backend validates configuration on startup
- Frontend validates required environment variables
- Database connections are tested
- API endpoints are verified

## Troubleshooting

### Common Issues
1. **Missing environment variables**: Check `.env` file and environment
2. **Database connection errors**: Verify database URL and credentials
3. **CORS errors**: Check CORS configuration for your environment
4. **API endpoint errors**: Verify API base URL configuration

### Debug Mode
Enable debug mode to see detailed configuration information:
```bash
# Backend
export DEBUG=true

# Frontend
VITE_DEBUG=true
```

## Migration Guide

### From Previous Versions
1. **Admin services**: Now stored in database, not config files
2. **Security settings**: Moved to environment variables
3. **UI settings**: Moved to code
4. **Single config**: Removed production-specific config files

### Database Migration
When implementing database storage:
1. Create database schema for services and admin data
2. Migrate existing config data to database
3. Update application code to use database queries
4. Remove config-based service management

This configuration system provides flexibility, security, and maintainability while keeping sensitive data separate from application code. 