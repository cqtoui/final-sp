import os

from fastapi import Request
from fastapi.responses import JSONResponse


PUBLIC_PATHS = {
    "/",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


def get_api_key() -> str:
    return os.environ.get("SAFEGUARD_API_KEY", "").strip()


def is_public_path(path: str) -> bool:
    return path in PUBLIC_PATHS or path.startswith("/docs")


def extract_api_key(request: Request) -> str:
    header_key = request.headers.get("X-API-Key", "").strip()
    if header_key:
        return header_key

    return request.query_params.get("api_key", "").strip()


async def api_key_middleware(request: Request, call_next):
    if request.method == "OPTIONS" or is_public_path(request.url.path):
        return await call_next(request)

    expected = get_api_key()
    if not expected:
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Set SAFEGUARD_API_KEY in your .env file."
            },
        )

    if extract_api_key(request) != expected:
        return JSONResponse(
            status_code=401,
            content={
                "detail": "Invalid or missing API key.",
            },
        )

    return await call_next(request)
