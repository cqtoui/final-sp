import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth import api_key_middleware
from app.routes.records import router as records_router
from app.routes.scan import router as scan_router
from app.routes.workers import router as workers_router


BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env")

UPLOAD_DIR = BACKEND_ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def should_preload_models() -> bool:
    return os.environ.get(
        "SAFEGUARD_SKIP_MODEL_PRELOAD",
        "",
    ).strip().lower() not in {
        "1",
        "true",
        "yes",
    }


def preload_runtime_models() -> None:
    if not should_preload_models():
        print("Model preload skipped.")
        return

    try:
        from app.services.safety_detector import load_model, resolve_model_path

        load_model()
        print("YOLO model loaded:", resolve_model_path())
    except Exception as error:
        print(
            "YOLO preload failed:",
            f"{type(error).__name__}: {error}",
        )

    try:
        from app.services.face_recognition import (
            preload_face_models,
            warm_worker_embeddings,
        )

        preload_face_models()
        warm_worker_embeddings()
        print("Face models and worker embeddings ready.")
    except Exception as error:
        print(
            "Face preload failed:",
            f"{type(error).__name__}: {error}",
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    preload_runtime_models()
    yield


app = FastAPI(
    title="AI SafeGuard API",
    version="1.0.0",
    lifespan=lifespan,
)

app.middleware("http")(api_key_middleware)

cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "SAFEGUARD_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploaded_scan",
)

app.include_router(scan_router, prefix="/api")
app.include_router(workers_router, prefix="/api")
app.include_router(records_router, prefix="/api")


@app.get("/")
def root():
    return {
        "status": "running",
        "message": "AI SafeGuard backend is running",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
    }
