import json
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse


router = APIRouter()


BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKER_DATA_DIR = BACKEND_ROOT / "worker_data"
FACE_DIR = WORKER_DATA_DIR / "faces"
WORKERS_FILE = WORKER_DATA_DIR / "workers.json"


ALLOWED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


def prepare_worker_storage() -> None:
    WORKER_DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    FACE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    if not WORKERS_FILE.exists():
        WORKERS_FILE.write_text(
            "[]",
            encoding="utf-8",
        )


def load_workers() -> list[dict[str, Any]]:
    prepare_worker_storage()

    try:
        content = WORKERS_FILE.read_text(
            encoding="utf-8",
        )

        workers = json.loads(content)

        if not isinstance(workers, list):
            raise ValueError(
                "workers.json must contain a list."
            )

        return workers

    except (
        json.JSONDecodeError,
        ValueError,
        OSError,
    ) as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "The backend worker database "
                f"could not be read: {error}"
            ),
        ) from error


def save_workers(
    workers: list[dict[str, Any]],
) -> None:
    prepare_worker_storage()

    temporary_file = (
        WORKERS_FILE.with_suffix(".tmp")
    )

    temporary_file.write_text(
        json.dumps(
            workers,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    temporary_file.replace(
        WORKERS_FILE
    )


def cache_registered_face(worker: dict[str, Any]) -> None:
    try:
        from app.services.face_recognition import (
            cache_worker_embedding,
        )

        cache_worker_embedding(worker)
    except Exception as error:
        print(
            "Could not cache worker embedding:",
            f"{type(error).__name__}: {error}",
        )


def drop_registered_face(
    photo_filename: str | None,
) -> None:
    try:
        from app.services.face_recognition import (
            remove_cached_worker_embedding,
        )

        remove_cached_worker_embedding(
            photo_filename
        )
    except Exception as error:
        print(
            "Could not drop worker embedding:",
            f"{type(error).__name__}: {error}",
        )


def invalidate_deepface_cache() -> None:
    """
    DeepFace stores database embeddings in files beginning with ds_model.
    Delete them whenever a face photo is added, changed, or removed.
    """
    if not FACE_DIR.exists():
        return

    for cache_file in FACE_DIR.glob(
        "ds_model*"
    ):
        try:
            if cache_file.is_file():
                cache_file.unlink()
        except OSError as error:
            print(
                "Could not remove DeepFace cache:",
                error,
            )


def get_photo_url(
    request: Request,
    worker_id: str,
    photo_filename: str | None,
) -> str:
    if not photo_filename:
        return ""

    return (
        str(request.base_url).rstrip("/")
        + f"/api/workers/{worker_id}/photo"
    )


def serialize_worker(
    worker: dict[str, Any],
    request: Request,
) -> dict[str, Any]:
    return {
        **worker,
        "photo_url": get_photo_url(
            request,
            str(worker.get("id", "")),
            worker.get("photo_filename"),
        ),
    }


def validate_text_field(
    value: str,
    field_name: str,
) -> str:
    cleaned_value = value.strip()

    if not cleaned_value:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} is required.",
        )

    return cleaned_value


def parse_required_gear(
    required_gear: str | None,
) -> list[str]:
    if not required_gear:
        return []

    try:
        parsed = json.loads(
            required_gear
        )
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=400,
            detail=(
                "required_gear must be "
                "a valid JSON list."
            ),
        ) from error

    if not isinstance(parsed, list):
        raise HTTPException(
            status_code=400,
            detail=(
                "required_gear must be "
                "a JSON list."
            ),
        )

    cleaned_items: list[str] = []

    for item in parsed:
        cleaned_item = str(item).strip()

        if (
            cleaned_item
            and cleaned_item
            not in cleaned_items
        ):
            cleaned_items.append(
                cleaned_item
            )

    return cleaned_items


def get_image_extension(
    photo: UploadFile,
) -> str:
    original_filename = (
        photo.filename or "worker.jpg"
    )

    extension = Path(
        original_filename
    ).suffix.lower()

    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Worker photo must be JPG, "
                "JPEG, PNG, or WEBP."
            ),
        )

    return extension


def save_worker_photo(
    photo: UploadFile,
    worker_id: str,
) -> str:
    extension = get_image_extension(
        photo
    )

    photo_filename = (
        f"{worker_id}{extension}"
    )

    destination_path = (
        FACE_DIR / photo_filename
    )

    try:
        with destination_path.open(
            "wb"
        ) as destination:
            shutil.copyfileobj(
                photo.file,
                destination,
            )

    except Exception as error:
        if destination_path.exists():
            destination_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=(
                "The worker photo could "
                "not be saved."
            ),
        ) from error

    if (
        not destination_path.exists()
        or destination_path.stat().st_size == 0
    ):
        if destination_path.exists():
            destination_path.unlink()

        raise HTTPException(
            status_code=400,
            detail=(
                "The submitted worker photo "
                "was empty."
            ),
        )

    return photo_filename


def delete_worker_photo(
    photo_filename: str | None,
) -> None:
    if not photo_filename:
        return

    photo_path = (
        FACE_DIR / photo_filename
    )

    try:
        if photo_path.exists():
            photo_path.unlink()
    except OSError as error:
        print(
            "Could not remove worker photo:",
            error,
        )


@router.get("/workers")
def get_workers(
    request: Request,
):
    workers = load_workers()

    return {
        "workers": [
            serialize_worker(
                worker,
                request,
            )
            for worker in workers
        ],
    }


@router.get("/workers/{worker_id}")
def get_worker(
    worker_id: str,
    request: Request,
):
    workers = load_workers()

    worker = next(
        (
            item
            for item in workers
            if item.get("id")
            == worker_id
        ),
        None,
    )

    if worker is None:
        raise HTTPException(
            status_code=404,
            detail="Worker not found.",
        )

    return {
        "worker": serialize_worker(
            worker,
            request,
        ),
    }


@router.post(
    "/workers",
    status_code=201,
)
async def create_worker(
    request: Request,
    full_name: str = Form(...),
    employee_id: str = Form(...),
    department: str = Form(...),
    status: str = Form("active"),
    required_gear: str = Form("[]"),
    photo: UploadFile = File(...),
):
    workers = load_workers()

    cleaned_name = validate_text_field(
        full_name,
        "Full name",
    )

    cleaned_employee_id = (
        validate_text_field(
            employee_id,
            "Employee ID",
        )
    )

    cleaned_department = (
        validate_text_field(
            department,
            "Department",
        )
    )

    duplicate = next(
        (
            worker
            for worker in workers
            if str(
                worker.get(
                    "employee_id",
                    "",
                )
            ).lower()
            == cleaned_employee_id.lower()
        ),
        None,
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                "A worker with this employee "
                "ID already exists."
            ),
        )

    worker_id = str(
        uuid.uuid4()
    )

    photo_filename = (
        save_worker_photo(
            photo,
            worker_id,
        )
    )

    worker = {
        "id": worker_id,
        "full_name": cleaned_name,
        "employee_id": (
            cleaned_employee_id
        ),
        "department": (
            cleaned_department
        ),
        "status": (
            status.strip()
            or "active"
        ),
        "required_gear": (
            parse_required_gear(
                required_gear
            )
        ),
        "photo_filename": (
            photo_filename
        ),
    }

    workers.append(worker)

    try:
        save_workers(workers)
    except Exception:
        delete_worker_photo(
            photo_filename
        )
        raise

    invalidate_deepface_cache()
    cache_registered_face(worker)

    return {
        "message": (
            "Worker registered successfully."
        ),
        "worker": serialize_worker(
            worker,
            request,
        ),
    }


@router.put("/workers/{worker_id}")
async def update_worker(
    worker_id: str,
    request: Request,
    full_name: str = Form(...),
    employee_id: str = Form(...),
    department: str = Form(...),
    status: str = Form("active"),
    required_gear: str = Form("[]"),
    photo: UploadFile | None = File(
        default=None
    ),
):
    workers = load_workers()

    worker_index = next(
        (
            index
            for index, worker
            in enumerate(workers)
            if worker.get("id")
            == worker_id
        ),
        None,
    )

    if worker_index is None:
        raise HTTPException(
            status_code=404,
            detail="Worker not found.",
        )

    existing_worker = workers[
        worker_index
    ]

    cleaned_name = validate_text_field(
        full_name,
        "Full name",
    )

    cleaned_employee_id = (
        validate_text_field(
            employee_id,
            "Employee ID",
        )
    )

    cleaned_department = (
        validate_text_field(
            department,
            "Department",
        )
    )

    duplicate = next(
        (
            worker
            for worker in workers
            if (
                worker.get("id")
                != worker_id
                and str(
                    worker.get(
                        "employee_id",
                        "",
                    )
                ).lower()
                == cleaned_employee_id.lower()
            )
        ),
        None,
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                "Another worker already uses "
                "this employee ID."
            ),
        )

    old_photo_filename = (
        existing_worker.get(
            "photo_filename"
        )
    )

    new_photo_filename = (
        old_photo_filename
    )

    photo_changed = False

    if (
        photo is not None
        and photo.filename
    ):
        new_photo_filename = (
            save_worker_photo(
                photo,
                worker_id,
            )
        )

        photo_changed = True

    updated_worker = {
        **existing_worker,
        "full_name": cleaned_name,
        "employee_id": (
            cleaned_employee_id
        ),
        "department": (
            cleaned_department
        ),
        "status": (
            status.strip()
            or "active"
        ),
        "required_gear": (
            parse_required_gear(
                required_gear
            )
        ),
        "photo_filename": (
            new_photo_filename
        ),
    }

    workers[worker_index] = (
        updated_worker
    )

    save_workers(workers)

    if (
        photo_changed
        and old_photo_filename
        and old_photo_filename
        != new_photo_filename
    ):
        delete_worker_photo(
            old_photo_filename
        )

    if photo_changed:
        invalidate_deepface_cache()
        if (
            old_photo_filename
            and old_photo_filename
            != new_photo_filename
        ):
            drop_registered_face(
                old_photo_filename
            )
        cache_registered_face(
            updated_worker
        )

    return {
        "message": (
            "Worker updated successfully."
        ),
        "worker": serialize_worker(
            updated_worker,
            request,
        ),
    }


@router.delete(
    "/workers/{worker_id}"
)
def delete_worker(
    worker_id: str,
):
    workers = load_workers()

    worker = next(
        (
            item
            for item in workers
            if item.get("id")
            == worker_id
        ),
        None,
    )

    if worker is None:
        raise HTTPException(
            status_code=404,
            detail="Worker not found.",
        )

    remaining_workers = [
        item
        for item in workers
        if item.get("id")
        != worker_id
    ]

    save_workers(
        remaining_workers
    )

    delete_worker_photo(
        worker.get(
            "photo_filename"
        )
    )

    drop_registered_face(
        worker.get(
            "photo_filename"
        )
    )

    invalidate_deepface_cache()

    return {
        "message": (
            "Worker deleted successfully."
        ),
    }


@router.get("/workers/{worker_id}/photo")
def get_worker_photo(worker_id: str):
    workers = load_workers()
    worker = next(
        (
            item
            for item in workers
            if item.get("id") == worker_id
        ),
        None,
    )

    if worker is None:
        raise HTTPException(
            status_code=404,
            detail="Worker not found.",
        )

    photo_filename = worker.get("photo_filename")
    if not photo_filename:
        raise HTTPException(
            status_code=404,
            detail="Worker photo not found.",
        )

    photo_path = (FACE_DIR / Path(photo_filename).name).resolve()
    if not str(photo_path).startswith(str(FACE_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid photo path.")

    if not photo_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Worker photo not found.",
        )

    return FileResponse(photo_path)


@router.patch("/workers/{worker_id}")
def patch_worker(
    worker_id: str,
    payload: dict[str, Any],
    request: Request,
):
    allowed_fields = {
        "total_scans",
        "total_violations",
        "compliance_rate",
        "status",
    }

    workers = load_workers()
    worker_index = next(
        (
            index
            for index, worker in enumerate(workers)
            if worker.get("id") == worker_id
        ),
        None,
    )

    if worker_index is None:
        raise HTTPException(
            status_code=404,
            detail="Worker not found.",
        )

    updated = {
        **workers[worker_index],
        **{
            key: payload[key]
            for key in allowed_fields
            if key in payload
        },
    }
    workers[worker_index] = updated
    save_workers(workers)

    return {
        "message": "Worker updated successfully.",
        "worker": serialize_worker(updated, request),
    }