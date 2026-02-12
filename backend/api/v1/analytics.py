from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import admin_required_fast, get_current_user
from core.config import settings
from db.session import get_db_session
from schemas.analytics_schema import AnalyticsEventCreate
from schemas.user_schema import User
from services.analytics_service import create_analytics_event, get_admin_analytics_events
from utils.responses import no_store_json
from utils.timing import timeit

router = APIRouter()


@timeit()
@router.post("/analytics/events")
async def create_event(
    payload: AnalyticsEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if settings.USE_MONGO:
        db = None
    return no_store_json(await create_analytics_event(payload, current_user, db))


@timeit()
@router.get("/admin/analytics/events")
async def list_admin_analytics_events(
    page: int = 1,
    size: int = 20,
    event_type: str = None,
    status: str = "success",
    user_query: str = None,
    actor_username: str = None,
    target_username: str = None,
    source: str = None,
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(admin_required_fast),
    db: AsyncSession = Depends(get_db_session),
):
    if settings.USE_MONGO:
        db = None
    return no_store_json(
        await get_admin_analytics_events(
            page=page,
            size=size,
            event_type=event_type,
            status=status,
            user_query=user_query,
            actor_username=actor_username,
            target_username=target_username,
            source=source,
            start_date=start_date,
            end_date=end_date,
            db=db,
        )
    )
