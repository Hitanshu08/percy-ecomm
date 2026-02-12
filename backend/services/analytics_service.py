from datetime import datetime, time
from typing import Any, Dict, Optional
import logging

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.models.analytics_event import AnalyticsEvent
from db.models.user import User as UserModel
from db.mongodb import get_mongo_db
from db.session import get_or_use_session
from schemas.analytics_schema import AnalyticsEventCreate
from schemas.user_schema import User

logger = logging.getLogger(__name__)


def _json_safe_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _json_safe_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe_value(v) for v in value]
    return str(value)


def _normalize_details(details: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(details, dict):
        return {}
    return {str(k): _json_safe_value(v) for k, v in details.items()}


def _normalize_event_type(event_type: str) -> str:
    return (event_type or "").strip().lower().replace(" ", "_")


def _parse_date_filter(value: Optional[str], *, end_of_day: bool = False) -> Optional[datetime]:
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        # yyyy-mm-dd from date picker
        if len(value) == 10 and value[4] == "-" and value[7] == "-":
            base = datetime.strptime(value, "%Y-%m-%d")
            return datetime.combine(base.date(), time.max if end_of_day else time.min)
        # ISO datetime fallback
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if end_of_day and dt.time() == time.min:
            return datetime.combine(dt.date(), time.max)
        return dt
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date filter: {value}")


async def record_analytics_event(
    event_type: str,
    *,
    status: str = "success",
    actor_username: Optional[str] = None,
    actor_role: Optional[str] = None,
    target_username: Optional[str] = None,
    source: Optional[str] = None,
    external_ref: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    db: AsyncSession = None,
) -> bool:
    """
    Best-effort analytics recorder.
    Returns True when event is stored, False when skipped/fails.
    """
    normalized_event = _normalize_event_type(event_type)
    if not normalized_event:
        return False

    normalized_status = (status or "success").strip().lower()
    payload_details = _normalize_details(details)
    created_at = datetime.utcnow()

    try:
        if settings.USE_MONGO:
            mdb = get_mongo_db()
            if mdb is None:
                return False
            if external_ref:
                existing = await mdb.analytics_events.find_one(
                    {
                        "event_type": normalized_event,
                        "status": normalized_status,
                        "external_ref": external_ref,
                    },
                    {"_id": 1},
                )
                if existing:
                    return False

            await mdb.analytics_events.insert_one(
                {
                    "event_type": normalized_event,
                    "status": normalized_status,
                    "actor_username": actor_username or "",
                    "actor_role": actor_role or "",
                    "target_username": target_username or "",
                    "source": source or "",
                    "external_ref": external_ref or "",
                    "details": payload_details,
                    "created_at": created_at,
                }
            )
            return True

        async with get_or_use_session(db) as _db:
            if _db is None:
                return False

            if external_ref:
                dedupe_stmt = select(AnalyticsEvent.id).where(
                    AnalyticsEvent.event_type == normalized_event,
                    AnalyticsEvent.status == normalized_status,
                    AnalyticsEvent.external_ref == external_ref,
                )
                exists = (await _db.execute(dedupe_stmt.limit(1))).scalar_one_or_none()
                if exists:
                    return False

            _db.add(
                AnalyticsEvent(
                    event_type=normalized_event,
                    status=normalized_status,
                    actor_username=actor_username,
                    actor_role=actor_role,
                    target_username=target_username,
                    source=source,
                    external_ref=external_ref,
                    details=payload_details,
                )
            )
            await _db.commit()
            return True
    except Exception as e:
        # Analytics should not break core user flows.
        logger.warning(f"Failed to record analytics event '{normalized_event}': {e}")
        return False


async def create_analytics_event(
    payload: AnalyticsEventCreate,
    current_user: User,
    db: AsyncSession = None,
) -> Dict[str, Any]:
    stored = await record_analytics_event(
        payload.event_type,
        status=payload.status,
        actor_username=current_user.username,
        actor_role=current_user.role,
        target_username=payload.target_username or current_user.username,
        source=payload.source or "api",
        external_ref=payload.external_ref,
        details=payload.details,
        db=db,
    )
    return {"ok": bool(stored), "message": "analytics_event_recorded" if stored else "analytics_event_skipped"}


async def get_admin_analytics_events(
    *,
    page: int = 1,
    size: int = 20,
    event_type: Optional[str] = None,
    status: Optional[str] = "success",
    user_query: Optional[str] = None,
    actor_username: Optional[str] = None,
    target_username: Optional[str] = None,
    source: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = None,
) -> Dict[str, Any]:
    page = max(1, int(page or 1))
    size = min(200, max(1, int(size or 20)))
    normalized_event = _normalize_event_type(event_type) if event_type else None
    normalized_status = (status or "").strip().lower() if status else None
    normalized_user_query = (user_query or "").strip()
    start_dt = _parse_date_filter(start_date, end_of_day=False)
    end_dt = _parse_date_filter(end_date, end_of_day=True)

    if settings.USE_MONGO:
        mdb = get_mongo_db()
        if mdb is None:
            raise HTTPException(status_code=500, detail="Mongo not available")

        and_conditions = []
        if normalized_event:
            and_conditions.append({"event_type": normalized_event})
        if normalized_status:
            and_conditions.append({"status": normalized_status})
        if source and source.strip():
            and_conditions.append({"source": source.strip()})
        if actor_username and actor_username.strip():
            and_conditions.append({"actor_username": {"$regex": actor_username.strip(), "$options": "i"}})
        if target_username and target_username.strip():
            and_conditions.append({"target_username": {"$regex": target_username.strip(), "$options": "i"}})
        if normalized_user_query:
            or_conditions = [
                {"actor_username": {"$regex": normalized_user_query, "$options": "i"}},
                {"target_username": {"$regex": normalized_user_query, "$options": "i"}},
            ]
            try:
                user_docs = await mdb.users.find(
                    {"email": {"$regex": normalized_user_query, "$options": "i"}},
                    {"_id": 0, "username": 1},
                ).to_list(length=500)
                usernames_from_email = [doc.get("username", "") for doc in user_docs if doc.get("username")]
                if usernames_from_email:
                    or_conditions.append({"actor_username": {"$in": usernames_from_email}})
                    or_conditions.append({"target_username": {"$in": usernames_from_email}})
            except Exception as e:
                logger.warning(f"Email-based analytics filter lookup failed: {e}")
            and_conditions.append({"$or": or_conditions})
        if start_dt or end_dt:
            date_q: Dict[str, Any] = {}
            if start_dt:
                date_q["$gte"] = start_dt
            if end_dt:
                date_q["$lte"] = end_dt
            and_conditions.append({"created_at": date_q})

        if not and_conditions:
            query: Dict[str, Any] = {}
        elif len(and_conditions) == 1:
            query = and_conditions[0]
        else:
            query = {"$and": and_conditions}

        total = await mdb.analytics_events.count_documents(query)
        cursor = (
            mdb.analytics_events.find(query)
            .sort("created_at", -1)
            .skip((page - 1) * size)
            .limit(size)
        )
        docs = await cursor.to_list(length=size)

        events = []
        for d in docs:
            created_at = d.get("created_at")
            events.append(
                {
                    "id": str(d.get("_id", "")),
                    "event_type": d.get("event_type", ""),
                    "status": d.get("status", ""),
                    "actor_username": d.get("actor_username", ""),
                    "actor_role": d.get("actor_role", ""),
                    "target_username": d.get("target_username", ""),
                    "source": d.get("source", ""),
                    "external_ref": d.get("external_ref", ""),
                    "details": d.get("details", {}) if isinstance(d.get("details"), dict) else {},
                    "created_at": created_at.isoformat() if isinstance(created_at, datetime) else str(created_at or ""),
                }
            )

        by_type: Dict[str, int] = {}
        pipeline = [
            {"$match": query},
            {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        async for row in mdb.analytics_events.aggregate(pipeline):
            key = str(row.get("_id", "") or "")
            by_type[key] = int(row.get("count", 0))

        total_pages = max(1, (total + size - 1) // size)
        return {
            "events": events,
            "page": page,
            "size": size,
            "total": int(total),
            "total_pages": int(total_pages),
            "summary": {"by_type": by_type},
        }

    async with get_or_use_session(db) as _db:
        if _db is None:
            raise HTTPException(status_code=500, detail="Database not available")

        conditions = []
        if normalized_event:
            conditions.append(AnalyticsEvent.event_type == normalized_event)
        if normalized_status:
            conditions.append(AnalyticsEvent.status == normalized_status)
        if source and source.strip():
            conditions.append(AnalyticsEvent.source == source.strip())
        if actor_username and actor_username.strip():
            conditions.append(AnalyticsEvent.actor_username.ilike(f"%{actor_username.strip()}%"))
        if target_username and target_username.strip():
            conditions.append(AnalyticsEvent.target_username.ilike(f"%{target_username.strip()}%"))
        if normalized_user_query:
            like_expr = f"%{normalized_user_query}%"
            username_rows = (
                await _db.execute(
                    select(UserModel.username).where(
                        or_(
                            UserModel.username.ilike(like_expr),
                            UserModel.email.ilike(like_expr),
                        )
                    ).limit(500)
                )
            ).all()
            matched_usernames = [str(row[0]) for row in username_rows if row and row[0]]
            user_or_conditions = [
                AnalyticsEvent.actor_username.ilike(like_expr),
                AnalyticsEvent.target_username.ilike(like_expr),
            ]
            if matched_usernames:
                user_or_conditions.append(AnalyticsEvent.actor_username.in_(matched_usernames))
                user_or_conditions.append(AnalyticsEvent.target_username.in_(matched_usernames))
            conditions.append(or_(*user_or_conditions))
        if start_dt:
            conditions.append(AnalyticsEvent.created_at >= start_dt)
        if end_dt:
            conditions.append(AnalyticsEvent.created_at <= end_dt)

        base_where = and_(*conditions) if conditions else None

        count_stmt = select(func.count(AnalyticsEvent.id))
        if base_where is not None:
            count_stmt = count_stmt.where(base_where)
        total = int((await _db.execute(count_stmt)).scalar() or 0)

        events_stmt = select(AnalyticsEvent).order_by(AnalyticsEvent.created_at.desc())
        if base_where is not None:
            events_stmt = events_stmt.where(base_where)
        events_stmt = events_stmt.offset((page - 1) * size).limit(size)
        rows = (await _db.execute(events_stmt)).scalars().all()

        events = []
        for row in rows:
            events.append(
                {
                    "id": row.id,
                    "event_type": row.event_type,
                    "status": row.status,
                    "actor_username": row.actor_username or "",
                    "actor_role": row.actor_role or "",
                    "target_username": row.target_username or "",
                    "source": row.source or "",
                    "external_ref": row.external_ref or "",
                    "details": row.details if isinstance(row.details, dict) else {},
                    "created_at": row.created_at.isoformat() if row.created_at else "",
                }
            )

        summary_stmt = select(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id)).group_by(AnalyticsEvent.event_type)
        if base_where is not None:
            summary_stmt = summary_stmt.where(base_where)
        summary_rows = (await _db.execute(summary_stmt)).all()
        by_type = {str(r[0] or ""): int(r[1] or 0) for r in summary_rows}

        total_pages = max(1, (total + size - 1) // size)
        return {
            "events": events,
            "page": page,
            "size": size,
            "total": total,
            "total_pages": int(total_pages),
            "summary": {"by_type": by_type},
        }
