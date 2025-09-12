from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, DBAPIError


async def safe_commit(session, client_error_message: str = "Invalid request", server_error_message: str = "Internal server error"):
    try:
        await session.commit()
    except (IntegrityError, DBAPIError) as e:
        try:
            await session.rollback()
        finally:
            pass
        raise HTTPException(status_code=400, detail=client_error_message) from e
    except Exception as e:
        try:
            await session.rollback()
        finally:
            pass
        raise HTTPException(status_code=500, detail=server_error_message) from e


