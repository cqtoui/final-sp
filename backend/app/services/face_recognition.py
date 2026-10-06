import json
import math
import threading
import time
from pathlib import Path
from typing import Any

from deepface import DeepFace
from PIL import Image, UnidentifiedImageError


BACKEND_ROOT = Path(__file__).resolve().parents[2]

WORKER_DATA_DIR = (
    BACKEND_ROOT
    / "worker_data"
)

FACE_DATABASE = (
    WORKER_DATA_DIR
    / "faces"
)

WORKERS_FILE = (
    WORKER_DATA_DIR
    / "workers.json"
)

EMBEDDINGS_CACHE_FILE = (
    WORKER_DATA_DIR
    / "face_embeddings.json"
)


MODEL_NAME = "Facenet512"

# RetinaFace is accurate on this PC but takes 9-16s, which exceeds the
# 7-second scan budget. YuNet detects the same registered face and still
# matches the existing Facenet512 cache (measured distance 0.029 at 0.30).
DETECTOR_BACKEND = "yunet"

# Facenet512 cosine matching threshold.
# Lower is stricter. Start with 0.30.
MATCH_THRESHOLD = 0.30

FACE_DETECT_MAX_SIDE = 800

_face_models_loaded = False
_face_job_lock = threading.Lock()


ALLOWED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


def unknown_worker(
    status: str,
    recognition_time_seconds: float = 0,
    face_distance: float | None = None,
    face_detection_time_seconds: float = 0,
    embedding_time_seconds: float = 0,
    face_comparison_time_seconds: float = 0,
    face_recognition_timed_out: bool = False,
) -> dict[str, Any]:
    return {
        "worker_identified": "Unknown Worker",
        "worker_id": "",
        "employee_id": "",
        "department": "",
        "face_recognition_status": status,
        "face_distance": (
            round(face_distance, 4)
            if face_distance is not None
            else None
        ),
        "face_threshold": MATCH_THRESHOLD,
        "face_recognition_time_seconds": round(
            recognition_time_seconds,
            2,
        ),
        "face_detection_time_seconds": round(
            face_detection_time_seconds,
            2,
        ),
        "embedding_time_seconds": round(
            embedding_time_seconds,
            2,
        ),
        "face_comparison_time_seconds": round(
            face_comparison_time_seconds,
            2,
        ),
        "face_recognition_timed_out": (
            face_recognition_timed_out
        ),
    }


def preload_face_models() -> None:
    """
    Load YuNet and Facenet512 once so later scans reuse them.
    """
    global _face_models_loaded

    if _face_models_loaded:
        return

    DeepFace.build_model(
        MODEL_NAME,
        task="facial_recognition",
    )
    DeepFace.build_model(
        DETECTOR_BACKEND,
        task="face_detector",
    )
    _face_models_loaded = True
    print(
        "Face models loaded:",
        MODEL_NAME,
        DETECTOR_BACKEND,
    )


def load_workers() -> list[dict[str, Any]]:
    if not WORKERS_FILE.exists():
        return []

    try:
        workers = json.loads(
            WORKERS_FILE.read_text(
                encoding="utf-8",
            )
        )

        if not isinstance(workers, list):
            print(
                "workers.json must contain a JSON list."
            )
            return []

        return workers

    except (
        json.JSONDecodeError,
        OSError,
    ) as error:
        print(
            "Could not load workers:",
            f"{type(error).__name__}: {error}",
        )
        return []


def load_embedding_cache() -> dict[str, Any]:
    if not EMBEDDINGS_CACHE_FILE.exists():
        return {}

    try:
        cache = json.loads(
            EMBEDDINGS_CACHE_FILE.read_text(
                encoding="utf-8",
            )
        )

        if isinstance(cache, dict):
            return cache

        return {}

    except (
        json.JSONDecodeError,
        OSError,
    ) as error:
        print(
            "Could not load embedding cache:",
            f"{type(error).__name__}: {error}",
        )
        return {}


def save_embedding_cache(
    cache: dict[str, Any],
) -> None:
    WORKER_DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary_file = (
        EMBEDDINGS_CACHE_FILE
        .with_suffix(".tmp")
    )

    temporary_file.write_text(
        json.dumps(
            cache,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    temporary_file.replace(
        EMBEDDINGS_CACHE_FILE
    )


def is_valid_image(
    image_path: Path,
) -> bool:
    if not image_path.exists():
        return False

    if not image_path.is_file():
        return False

    if (
        image_path.suffix.lower()
        not in ALLOWED_IMAGE_EXTENSIONS
    ):
        return False

    try:
        with Image.open(
            image_path
        ) as image:
            image.verify()

        return True

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
    ):
        return False


def is_no_face_error(
    error: Exception,
) -> bool:
    message = str(error).lower()

    no_face_messages = (
        "face could not be detected",
        "face cannot be detected",
        "no face detected",
        "no face",
        "could not detect face",
        "cannot detect face",
        "confirm that the picture is a face photo",
        "consider to set enforce_detection",
    )

    return any(
        text in message
        for text in no_face_messages
    )


def prepare_image_for_face_detection(
    image_path: Path,
) -> Path:
    """
    Downscale very large frames before detection.

    Facenet512 still embeds the aligned face crop, not this full image.
    """
    with Image.open(image_path) as image:
        rgb = image.convert("RGB")
        if max(rgb.size) <= FACE_DETECT_MAX_SIDE:
            return image_path

        rgb.thumbnail(
            (FACE_DETECT_MAX_SIDE, FACE_DETECT_MAX_SIDE),
            Image.Resampling.LANCZOS,
        )
        prepared_path = image_path.with_name(
            f"{image_path.stem}_face{image_path.suffix or '.jpg'}"
        )
        rgb.save(prepared_path, quality=95)
        return prepared_path


def generate_embedding_timed(
    image_path: Path,
) -> tuple[list[float], float, float]:
    """
    Detect with YuNet, then embed with Facenet512.

    Matching still uses the 0.30 cosine threshold and cached worker
    embeddings. Detection and embedding are timed separately.
    """
    preload_face_models()
    probe_path = prepare_image_for_face_detection(
        image_path
    )

    detection_started = time.perf_counter()
    faces = DeepFace.extract_faces(
        img_path=str(probe_path),
        detector_backend=DETECTOR_BACKEND,
        enforce_detection=True,
        align=True,
    )
    detection_time = (
        time.perf_counter()
        - detection_started
    )

    if not faces:
        raise ValueError(
            "No face representation was generated."
        )

    if len(faces) > 1:
        raise ValueError(
            "Multiple faces detected. Please scan one person at a time."
        )

    face_image = faces[0].get("face")

    embedding_started = time.perf_counter()
    representations = DeepFace.represent(
        img_path=face_image,
        model_name=MODEL_NAME,
        detector_backend="skip",
        enforce_detection=False,
        align=False,
        normalization="base",
    )
    embedding_time = (
        time.perf_counter()
        - embedding_started
    )

    if not representations:
        raise ValueError(
            "No face representation was generated."
        )

    embedding = representations[0].get(
        "embedding"
    )

    if not isinstance(
        embedding,
        list,
    ):
        raise ValueError(
            "The generated face embedding is invalid."
        )

    if not embedding:
        raise ValueError(
            "The generated face embedding is empty."
        )

    return (
        [
            float(value)
            for value in embedding
        ],
        detection_time,
        embedding_time,
    )


def generate_embedding(
    image_path: Path,
) -> list[float]:
    """
    Detect, align, and represent one face using YuNet and Facenet512.

    This is the expensive operation. Registered-worker embeddings are cached,
    so this normally runs only once for the live scan.
    """
    embedding, _, _ = generate_embedding_timed(
        image_path
    )
    return embedding


def cosine_distance(
    first_embedding: list[float],
    second_embedding: list[float],
) -> float:
    if (
        not first_embedding
        or not second_embedding
    ):
        return 1.0

    if (
        len(first_embedding)
        != len(second_embedding)
    ):
        return 1.0

    dot_product = sum(
        first_value * second_value
        for first_value, second_value
        in zip(
            first_embedding,
            second_embedding,
        )
    )

    first_norm = math.sqrt(
        sum(
            value * value
            for value in first_embedding
        )
    )

    second_norm = math.sqrt(
        sum(
            value * value
            for value in second_embedding
        )
    )

    if (
        first_norm == 0
        or second_norm == 0
    ):
        return 1.0

    similarity = (
        dot_product
        / (
            first_norm
            * second_norm
        )
    )

    return float(
        1 - similarity
    )


def get_worker_embedding(
    worker: dict[str, Any],
    cache: dict[str, Any],
    allow_create: bool = False,
) -> tuple[list[float] | None, bool]:
    """
    Return a cached worker embedding.

    During a live scan, allow_create is False so registered-worker
    embeddings are never rebuilt. Registration and startup warmup may
    create a missing embedding once.
    """
    photo_filename = worker.get(
        "photo_filename"
    )

    if not photo_filename:
        return None, False

    photo_path = (
        FACE_DATABASE
        / str(photo_filename)
    )

    if not is_valid_image(
        photo_path
    ):
        print(
            "Skipping invalid worker photograph:",
            photo_path,
        )
        return None, False

    modification_time = (
        photo_path.stat().st_mtime_ns
    )

    cached_item = cache.get(
        str(photo_filename)
    )

    if isinstance(
        cached_item,
        dict,
    ):
        cached_modification_time = (
            cached_item.get(
                "modification_time"
            )
        )

        cached_embedding = (
            cached_item.get(
                "embedding"
            )
        )

        if (
            cached_modification_time
            == modification_time
            and isinstance(
                cached_embedding,
                list,
            )
            and cached_embedding
        ):
            return (
                [
                    float(value)
                    for value
                    in cached_embedding
                ],
                False,
            )

    if not allow_create:
        return None, False

    print(
        "Creating face embedding for:",
        worker.get(
            "full_name",
            "Unnamed Worker",
        ),
    )

    try:
        embedding = generate_embedding(
            photo_path
        )

    except Exception as error:
        print(
            "Could not create worker embedding:",
            worker.get(
                "full_name",
                "Unnamed Worker",
            ),
            f"{type(error).__name__}: {error}",
        )

        return None, False

    cache[str(photo_filename)] = {
        "worker_id": worker.get(
            "id",
            "",
        ),
        "photo_filename": str(
            photo_filename
        ),
        "modification_time": (
            modification_time
        ),
        "model_name": MODEL_NAME,
        "detector_backend": (
            DETECTOR_BACKEND
        ),
        "embedding": embedding,
    }

    return embedding, True


def remove_stale_cache_entries(
    workers: list[dict[str, Any]],
    cache: dict[str, Any],
) -> bool:
    valid_filenames = {
        str(
            worker.get(
                "photo_filename"
            )
        )
        for worker in workers
        if worker.get(
            "photo_filename"
        )
    }

    stale_filenames = [
        filename
        for filename in cache
        if filename
        not in valid_filenames
    ]

    for filename in stale_filenames:
        cache.pop(
            filename,
            None,
        )

    return bool(
        stale_filenames
    )


def cache_worker_embedding(
    worker: dict[str, Any],
) -> None:
    """
    Create or refresh one registered worker's embedding. Used on
    registration, photo update, and startup warmup — not during scan.
    """
    cache = load_embedding_cache()
    _, created = get_worker_embedding(
        worker,
        cache,
        allow_create=True,
    )
    if created:
        save_embedding_cache(cache)


def remove_cached_worker_embedding(
    photo_filename: str | None,
) -> None:
    if not photo_filename:
        return

    cache = load_embedding_cache()
    if str(photo_filename) not in cache:
        return

    cache.pop(str(photo_filename), None)
    save_embedding_cache(cache)


def warm_worker_embeddings() -> None:
    """
    Build missing embeddings once at startup so scans only compare numbers.
    """
    workers = load_workers()
    cache = load_embedding_cache()
    cache_changed = remove_stale_cache_entries(
        workers,
        cache,
    )

    for worker in workers:
        if str(
            worker.get("status", "active")
        ).lower() != "active":
            continue

        _, created = get_worker_embedding(
            worker,
            cache,
            allow_create=True,
        )
        if created:
            cache_changed = True

    if cache_changed:
        try:
            save_embedding_cache(cache)
        except OSError as error:
            print(
                "Could not save embedding cache:",
                error,
            )


def recognize_worker(
    image_path: str,
) -> dict[str, Any]:
    if not _face_job_lock.acquire(timeout=6.5):
        return unknown_worker(
            "Face recognition timed out",
            0,
            face_recognition_timed_out=True,
        )

    try:
        return _recognize_worker_impl(
            image_path
        )
    finally:
        _face_job_lock.release()


def _recognize_worker_impl(
    image_path: str,
) -> dict[str, Any]:
    """
    Accurate recognition with cached worker embeddings.

    YuNet and Facenet512 run once on the live scan. Stored workers are
    compared using their cached numerical embeddings. Missing worker
    embeddings are not created during a scan.
    """
    started_at = (
        time.perf_counter()
    )
    detection_time = 0.0
    embedding_time = 0.0
    comparison_time = 0.0

    scan_path = Path(
        image_path
    )

    if not is_valid_image(
        scan_path
    ):
        elapsed = (
            time.perf_counter()
            - started_at
        )

        return unknown_worker(
            "Uploaded file is not a valid image",
            elapsed,
        )

    workers = load_workers()

    active_workers = [
        worker
        for worker in workers
        if str(
            worker.get(
                "status",
                "active",
            )
        ).lower()
        == "active"
    ]

    if not active_workers:
        elapsed = (
            time.perf_counter()
            - started_at
        )

        return unknown_worker(
            "No active workers registered",
            elapsed,
        )

    try:
        (
            scan_embedding,
            detection_time,
            embedding_time,
        ) = generate_embedding_timed(
            scan_path
        )

    except ValueError as error:
        elapsed = (
            time.perf_counter()
            - started_at
        )

        if (
            is_no_face_error(error)
            or "no face representation"
            in str(error).lower()
        ):
            return unknown_worker(
                "No clear face detected",
                elapsed,
                face_detection_time_seconds=detection_time,
                embedding_time_seconds=embedding_time,
            )

        if (
            "multiple faces"
            in str(error).lower()
        ):
            return unknown_worker(
                "Multiple faces detected",
                elapsed,
                face_detection_time_seconds=detection_time,
                embedding_time_seconds=embedding_time,
            )

        print(
            "Scan embedding ValueError:",
            error,
        )

        return unknown_worker(
            "Face recognition could not complete",
            elapsed,
            face_detection_time_seconds=detection_time,
            embedding_time_seconds=embedding_time,
        )

    except Exception as error:
        elapsed = (
            time.perf_counter()
            - started_at
        )

        if is_no_face_error(
            error
        ):
            return unknown_worker(
                "No clear face detected",
                elapsed,
                face_detection_time_seconds=detection_time,
                embedding_time_seconds=embedding_time,
            )

        print(
            "Scan embedding error:",
            f"{type(error).__name__}: {error}",
        )

        return unknown_worker(
            "Face recognition error",
            elapsed,
            face_detection_time_seconds=detection_time,
            embedding_time_seconds=embedding_time,
        )

    cache = load_embedding_cache()

    cache_changed = remove_stale_cache_entries(
        active_workers,
        cache,
    )

    best_worker: dict[str, Any] | None = None
    best_distance: float | None = None

    valid_embedding_count = 0
    comparison_started = time.perf_counter()

    for worker in active_workers:
        worker_embedding, embedding_created = (
            get_worker_embedding(
                worker,
                cache,
                allow_create=False,
            )
        )

        if embedding_created:
            cache_changed = True

        if worker_embedding is None:
            continue

        valid_embedding_count += 1

        distance = cosine_distance(
            scan_embedding,
            worker_embedding,
        )

        print(
            "Face comparison:",
            worker.get(
                "full_name",
                "Unnamed Worker",
            ),
            f"distance={distance:.4f}",
            f"threshold={MATCH_THRESHOLD}",
        )

        if (
            best_distance is None
            or distance < best_distance
        ):
            best_worker = worker
            best_distance = distance

    comparison_time = (
        time.perf_counter()
        - comparison_started
    )

    if cache_changed:
        try:
            save_embedding_cache(
                cache
            )
        except OSError as error:
            print(
                "Could not save embedding cache:",
                error,
            )

    elapsed = (
        time.perf_counter()
        - started_at
    )

    if valid_embedding_count == 0:
        return unknown_worker(
            "No valid worker photographs registered",
            elapsed,
            face_detection_time_seconds=detection_time,
            embedding_time_seconds=embedding_time,
            face_comparison_time_seconds=comparison_time,
        )

    if (
        best_worker is None
        or best_distance is None
    ):
        return unknown_worker(
            "No matching face found",
            elapsed,
            face_detection_time_seconds=detection_time,
            embedding_time_seconds=embedding_time,
            face_comparison_time_seconds=comparison_time,
        )

    if best_distance > MATCH_THRESHOLD:
        return unknown_worker(
            "No matching face found",
            elapsed,
            best_distance,
            face_detection_time_seconds=detection_time,
            embedding_time_seconds=embedding_time,
            face_comparison_time_seconds=comparison_time,
        )

    print(
        "Worker matched:",
        best_worker.get(
            "full_name",
            "Unknown Worker",
        ),
        f"distance={best_distance:.4f}",
        f"time={elapsed:.2f}s",
    )

    return {
        "worker_identified": (
            best_worker.get(
                "full_name",
                "Unknown Worker",
            )
        ),
        "worker_id": (
            best_worker.get(
                "id",
                "",
            )
        ),
        "employee_id": (
            best_worker.get(
                "employee_id",
                "",
            )
        ),
        "department": (
            best_worker.get(
                "department",
                "",
            )
        ),
        "face_recognition_status": (
            "Matched"
        ),
        "face_distance": round(
            best_distance,
            4,
        ),
        "face_threshold": (
            MATCH_THRESHOLD
        ),
        "face_recognition_time_seconds": round(
            elapsed,
            2,
        ),
        "face_detection_time_seconds": round(
            detection_time,
            2,
        ),
        "embedding_time_seconds": round(
            embedding_time,
            2,
        ),
        "face_comparison_time_seconds": round(
            comparison_time,
            2,
        ),
        "face_recognition_timed_out": False,
    }