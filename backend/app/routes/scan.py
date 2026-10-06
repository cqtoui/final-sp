import asyncio
import json
import shutil
import time
from datetime import datetime
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

from app.services.face_recognition import (
    is_valid_image,
    recognize_worker,
    unknown_worker,
)

from app.services.safety_detector import (
    canonicalize_required_gear,
    detect_safety_gear,
    ppe_timeout_result,
)


SCAN_BUDGET_SECONDS = 7.0
SCAN_HARD_LIMIT_SECONDS = 11.0


router = APIRouter()


BACKEND_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

UPLOAD_DIR = (
    BACKEND_ROOT
    / "uploads"
)

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


ALLOWED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


def save_uploaded_image(
    uploaded_file: UploadFile,
) -> Path:
    original_filename = (
        uploaded_file.filename
        or "scan.jpg"
    )

    file_extension = Path(
        original_filename
    ).suffix.lower()

    if (
        file_extension
        not in ALLOWED_IMAGE_EXTENSIONS
    ):
        file_extension = ".jpg"

    timestamp = (
        datetime.now().strftime(
            "%Y%m%d_%H%M%S_%f"
        )
    )

    filename = (
        f"{timestamp}_scan"
        f"{file_extension}"
    )

    image_path = (
        UPLOAD_DIR / filename
    )

    try:
        with image_path.open(
            "wb"
        ) as destination:
            shutil.copyfileobj(
                uploaded_file.file,
                destination,
            )

    except Exception as error:
        if image_path.exists():
            image_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=(
                "The uploaded scan "
                "could not be saved."
            ),
        ) from error

    if (
        not image_path.exists()
        or image_path.stat().st_size
        == 0
    ):
        if image_path.exists():
            image_path.unlink()

        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded scan was empty."
            ),
        )

    return image_path


def parse_required_gear(
    required_gear_json: str | None,
) -> list[str]:
    if not required_gear_json:
        return []

    try:
        parsed_value: Any = json.loads(
            required_gear_json
        )

    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=400,
            detail=(
                "required_gear must be "
                "a valid JSON list."
            ),
        ) from error

    if not isinstance(
        parsed_value,
        list,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "required_gear must be "
                "a JSON list."
            ),
        )

    required_gear: list[str] = []

    for item in parsed_value:
        cleaned_item = str(
            item
        ).strip()

        if (
            cleaned_item
            and cleaned_item
            not in required_gear
        ):
            required_gear.append(
                cleaned_item
            )

    return canonicalize_required_gear(
        required_gear
    )


@router.post("/scan")
async def scan_image(
    request: Request,
    file: UploadFile = File(...),
    required_gear: str | None = Form(
        default=None
    ),
):
    """
    Run PPE detection and facial recognition together.

    The client receives a result within about seven seconds. If face
    recognition is still running, the PPE result is returned with
    Unknown Worker and a timeout status.
    """
    started_at = time.perf_counter()

    image_path = save_uploaded_image(
        file
    )

    submitted_required_gear = (
        parse_required_gear(
            required_gear
        )
    )

    if not is_valid_image(image_path):
        face_result = recognize_worker(str(image_path))
        safety_result = ppe_timeout_result(
            submitted_required_gear,
            0,
        )
        safety_result["ppe_status"] = "skipped_invalid_image"
        safety_result["notes"] = (
            "Uploaded file is not a valid image."
        )
        image_url = str(
            request.url_for(
                "uploaded_scan",
                path=image_path.name,
            )
        )
        return {
            **safety_result,
            **face_result,
            "image_url": image_url,
            "required_gear": submitted_required_gear,
            "scan_time_seconds": round(
                time.perf_counter() - started_at,
                2,
            ),
            "ppe_status": "skipped_invalid_image",
            "ppe_detection_time_seconds": 0,
        }

    remaining = max(
        0.4,
        SCAN_BUDGET_SECONDS
        - (time.perf_counter() - started_at),
    )

    ppe_task = asyncio.create_task(
        asyncio.to_thread(
            detect_safety_gear,
            str(image_path),
            submitted_required_gear,
        )
    )
    face_task = asyncio.create_task(
        asyncio.to_thread(
            recognize_worker,
            str(image_path),
        )
    )

    done, _pending = await asyncio.wait(
        {ppe_task, face_task},
        timeout=remaining,
    )

    if ppe_task in done:
        safety_result = ppe_task.result()
    else:
        leftover = (
            SCAN_HARD_LIMIT_SECONDS
            - (time.perf_counter() - started_at)
        )
        if leftover <= 0:
            safety_result = ppe_timeout_result(
                submitted_required_gear,
                time.perf_counter() - started_at,
            )
        else:
            try:
                safety_result = await asyncio.wait_for(
                    ppe_task,
                    timeout=leftover,
                )
            except asyncio.TimeoutError:
                safety_result = ppe_timeout_result(
                    submitted_required_gear,
                    time.perf_counter() - started_at,
                )

    if face_task in done:
        face_result = face_task.result()
    else:
        face_result = unknown_worker(
            "Face recognition timed out",
            time.perf_counter() - started_at,
            face_recognition_timed_out=True,
        )

    image_url = str(
        request.url_for(
            "uploaded_scan",
            path=image_path.name,
        )
    )

    scan_time = time.perf_counter() - started_at

    return {
        **safety_result,
        **face_result,
        "image_url": image_url,
        "required_gear": (
            safety_result.get(
                "required_gear",
                submitted_required_gear,
            )
        ),
        "scan_time_seconds": round(scan_time, 2),
        "ppe_status": safety_result.get(
            "ppe_status",
            "ok",
        ),
        "ppe_detection_time_seconds": (
            safety_result.get(
                "ppe_detection_time_seconds",
                0,
            )
        ),
    }


@router.get("/scan/test")
def scan_test():
    return {
        "status": "ok",
        "message": (
            "Scan route is working."
        ),
    }