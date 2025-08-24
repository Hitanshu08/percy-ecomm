# Database Setup Guide

This guide explains how to set up and seed your database using the new notebook-based approach.

## Prerequisites

1. **Environment Variables**: Ensure your `.env` file is properly configured with required variables:
   - `SECRET_KEY` - A secure secret key for JWT tokens
   - `ADMIN_EMAIL` - Admin user email
   - `ADMIN_PASSWORD` - Admin user password
   - `DATABASE_URL` - MySQL database connection string

2. **Dependencies**: Install required packages:
   ```bash
   pip install jupyter sqlalchemy pymysql
   ```

## Setup Process

### 1. Create Tables
The `initialize_database()` function in `db/base.py` creates the basic table structure.

### 2. Seed Data
Use the `database_setup.ipynb` notebook to populate your database with sample data:

```bash
cd backend
jupyter notebook database_setup.ipynb
```

### 3. Run the Notebook
Execute the cells in order:
1. **Import modules** - Loads required dependencies
2. **Create tables** - Creates database schema
3. **Define sample data** - Sets up sample users and services
4. **Seed users** - Creates admin and test users
5. **Seed services** - Creates Quillbot, Grammarly, and ChatGPT services
6. **Verify setup** - Confirms everything was created correctly

## Sample Data Created

### Users
- **admin**: Full access user with all services
- **testuser**: Basic user with limited services
- **premiumuser**: User with multiple service subscriptions

### Services
- **Quillbot**: Writing assistance tool
- **Grammarly**: Grammar checking tool
- **ChatGPT**: AI chat assistant

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify your `DATABASE_URL` in `.env`
   - Ensure MySQL is running and accessible

2. **Import Errors**
   - Make sure you're running from the `backend` directory
   - Check that all dependencies are installed

3. **Permission Errors**
   - Ensure your database user has CREATE and INSERT privileges

### Reset Database
If you need to start fresh, uncomment the reset cell in the notebook (⚠️ **Warning**: This deletes all data).

## Development Workflow

1. **First Time Setup**: Run the entire notebook
2. **Schema Changes**: Modify models and run table creation cell
3. **Data Updates**: Modify sample data and re-run seeding cells
4. **Testing**: Use the verification cell to check your setup

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | ✅ | JWT token secret key |
| `ADMIN_EMAIL` | ✅ | Admin user email |
| `ADMIN_PASSWORD` | ✅ | Admin user password |
| `DATABASE_URL` | ✅ | MySQL connection string |
| `DEBUG` | ❌ | Enable debug mode |
| `LOG_LEVEL` | ❌ | Logging level (INFO, DEBUG, etc.) |

## Security Notes

- Never commit your `.env` file to version control
- Use strong, unique passwords for admin accounts
- Generate secure secret keys using: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- Regularly rotate admin passwords in production 