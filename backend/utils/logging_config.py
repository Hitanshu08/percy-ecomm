import logging
import logging.handlers
import contextvars
from pathlib import Path
from typing import Optional

from core.config import settings
from core.security import verify_token
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


def _ensure_log_dir(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)


def map_log_level(level_name: str) -> int:
    try:
        return getattr(logging, (level_name or "INFO").upper())
    except AttributeError:
        return logging.INFO


user_id_var = contextvars.ContextVar("user_id", default="-")
api_var = contextvars.ContextVar("api", default="-")


class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Inject per-request context variables
        record.user_id = user_id_var.get()
        record.api = api_var.get()
        return True


def _build_rotating_file_handler(filename: str, level: int, formatter: logging.Formatter, log_dir: Path) -> logging.Handler:
    handler = logging.handlers.TimedRotatingFileHandler(
        filename=str(log_dir / filename),
        when="midnight",
        interval=1,
        backupCount=max(int(settings.LOG_TTL_DAYS), 0),
        encoding="utf-8",
        utc=True,
    )
    try:
        handler.suffix = "%Y-%m-%d"
    except Exception:
        pass
    handler.setLevel(level)
    handler.setFormatter(formatter)
    handler.addFilter(ContextFilter())
    return handler


def _build_handlers(level: int, log_dir: Path) -> dict[str, logging.Handler]:
    formatter = logging.Formatter(
        fmt="%(levelname)s - %(asctime)s - %(user_id)s - %(api)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    app_file = _build_rotating_file_handler("app.log", level, formatter, log_dir)
    access_file = _build_rotating_file_handler("access.log", level, formatter, log_dir)
    error_file = _build_rotating_file_handler("error.log", logging.WARNING, formatter, log_dir)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(ContextFilter())

    return {
        "app": app_file,
        "access": access_file,
        "error": error_file,
        "console": console_handler,
    }


def _reset_handlers(target_logger: logging.Logger, handlers: list[logging.Handler], level: int) -> None:
    for h in list(target_logger.handlers):
        target_logger.removeHandler(h)
    for h in handlers:
        target_logger.addHandler(h)
    target_logger.setLevel(level)


def configure_logging(app_logger_name: Optional[str] = None) -> logging.Logger:
    """Configure logging with daily rotation and TTL-based retention.

    - Rotates at midnight; keeps last LOG_TTL_DAYS files
    - Applies handlers to root, app, and Uvicorn loggers
    """
    log_dir = Path(settings.LOG_DIR)
    _ensure_log_dir(log_dir)

    level = map_log_level(settings.LOG_LEVEL)
    handlers = _build_handlers(level, log_dir)

    # Root logger -> app + error + console
    root_logger = logging.getLogger()
    _reset_handlers(root_logger, [handlers["app"], handlers["error"], handlers["console"]], level)

    # App logger -> app + error + console
    app_name = app_logger_name or "percy_ecomm"
    app_logger = logging.getLogger(app_name)
    app_logger.propagate = False
    _reset_handlers(app_logger, [handlers["app"], handlers["error"], handlers["console"]], level)

    # Uvicorn/ASGI related loggers
    # uvicorn.error -> app + error + console
    for name in ("uvicorn", "uvicorn.error", "fastapi"):
        lgr = logging.getLogger(name)
        lgr.propagate = False
        _reset_handlers(lgr, [handlers["app"], handlers["error"], handlers["console"]], level)
    # uvicorn.access -> access + console
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.propagate = False
    _reset_handlers(access_logger, [handlers["access"], handlers["console"]], level)

    return app_logger


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        context_token_user = None
        context_token_api = None
        try:
            user_id = "-"
            auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1]
                payload = verify_token(token)
                if payload:
                    user_id = payload.get("user_id") or payload.get("sub") or "-"

            api = f"{request.method} {request.url.path}"
            context_token_user = user_id_var.set(user_id)
            context_token_api = api_var.set(api)
            response = await call_next(request)
            return response
        finally:
            try:
                if context_token_user is not None:
                    user_id_var.reset(context_token_user)
                else:
                    user_id_var.set("-")
                if context_token_api is not None:
                    api_var.reset(context_token_api)
                else:
                    api_var.set("-")
            except Exception:
                # Ensure context is cleared even if reset fails
                user_id_var.set("-")
                api_var.set("-")


