# Percy E-commerce Backend

A FastAPI-based backend for the Percy E-commerce subscription platform.

## Features

- User authentication and authorization
- Subscription management
- Credit system
- Admin panel
- MongoDB database integration
- RESTful API endpoints

## Prerequisites

- Python 3.8+
- MongoDB (local or cloud instance)
- pip

## Installation

1. Clone the repository and navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up MongoDB:
   - Install MongoDB locally or use MongoDB Atlas
   - Create a database named `percy_ecomm`

5. Configure environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

## Configuration

The application uses environment variables for configuration. Key settings:

- `MONGODB_URL`: MongoDB connection string (default: `mongodb://localhost:27017`)
- `MONGODB_DATABASE`: Database name (default: `percy_ecomm`)
- `SECRET_KEY`: JWT secret key
- `ADMIN_PASSWORD`: Admin user password

## Running the Application

1. Start the development server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. The API will be available at `http://localhost:8000`

3. API documentation will be available at `http://localhost:8000/docs`

## Database

The application uses MongoDB with the following collections:

- `users`: User accounts and profiles
- `services`: Available services and accounts
- `refresh_tokens`: JWT refresh tokens

Sample data is automatically initialized on startup.

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token

### Users
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `POST /users/change-password` - Change password

### Services
- `GET /services` - Get available services
- `POST /services/purchase` - Purchase subscription
- `GET /users/subscriptions` - Get user subscriptions

### Wallet
- `GET /wallet` - Get wallet information
- `POST /wallet/deposit` - Deposit credits

### Admin (Admin only)
- `GET /admin/users` - Get all users
- `GET /admin/services` - Get all services
- `POST /admin/assign-subscription` - Assign subscription to user
- `POST /admin/add-credits` - Add credits to user

## Development

The application follows a modular structure:

- `api/v1/`: API route handlers
- `core/`: Core configuration and security
- `db/`: Database connection and models
- `schemas/`: Pydantic models for request/response validation
- `services/`: Business logic layer

## Testing

To test the API:

1. Start the server
2. Visit `http://localhost:8000/docs` for interactive API documentation
3. Use the provided sample data for testing:
   - Admin: `admin` / `adminpass123`
   - Test user: `testuser` / `userpass123`
   - Premium user: `premiumuser` / `premium123`
