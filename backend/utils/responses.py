from fastapi.responses import JSONResponse

NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

def no_store_json(data, status_code: int = 200):
    """Return JSONResponse with no-store caching headers."""
    return JSONResponse(content=data, status_code=status_code, headers=NO_STORE_HEADERS)


