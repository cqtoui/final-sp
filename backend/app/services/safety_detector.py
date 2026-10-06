import os
import time
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = BACKEND_ROOT / "models"

CONFIDENCE_THRESHOLD = 0.25
# 960px found vest+gloves on webcam frames where 640px found gloves only.
# Confidence threshold and class IDs are unchanged.
IMAGE_SIZE = 960

# Live PPE weight. Rollback: set SAFEGUARD_PPE_MODEL=best_v5.pt
DEFAULT_PPE_WEIGHT = "best_v6.pt"

MODEL_CANDIDATES = (
    MODELS_DIR / "best_v6.pt",
    MODELS_DIR / "best_v5.pt",
    MODELS_DIR / "best_v4.pt",
    MODELS_DIR / "best_v3.pt",
    MODELS_DIR / "best_v2.pt",
    MODELS_DIR / "best.pt",
)

# YOLO class labels (any casing/punctuation) -> app gear ids.
CLASS_TO_GEAR = {
    "helmet": "helmet",
    "hardhat": "helmet",
    "hard_hat": "helmet",
    "safety_helmet": "helmet",
    "hat": "helmet",
    "goggles": "goggles",
    "goggle": "goggles",
    "glasses": "goggles",
    "safety_goggles": "goggles",
    "safety_glasses": "goggles",
    "eyewear": "goggles",
    "safety_vest": "safety_vest",
    "vest": "safety_vest",
    "reflective_vest": "safety_vest",
    "jacket": "safety_vest",
    "gloves": "gloves",
    "glove": "gloves",
    "safety_gloves": "gloves",
    "hand": "gloves",
    "ear_protection": "ear_protection",
    "earprotection": "ear_protection",
    "ear_muff": "ear_protection",
    "ear_muffs": "ear_protection",
    "earmuff": "ear_protection",
    "earmuffs": "ear_protection",
    "ear_plug": "ear_protection",
    "ear_plugs": "ear_protection",
    "hearing_protection": "ear_protection",
    "lab_coat": "lab_coat",
    "labcoat": "lab_coat",
    "coat": "lab_coat",
}

NEGATIVE_PREFIXES = (
    "no_",
    "no-",
    "without_",
    "missing_",
    "not_",
)

_model = None
_model_path: Path | None = None


def normalize_label(value: str) -> str:
    cleaned = str(value or "").strip().lower()
    for char in (" ", "-", "."):
        cleaned = cleaned.replace(char, "_")
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned.strip("_")


KNOWN_GEAR_IDS = set(CLASS_TO_GEAR.values())


def canonicalize_required_gear(required_gear: list[str] | None) -> list[str]:
    """Keep only known workplace PPE ids. Unknown items are ignored."""
    required: list[str] = []
    for item in required_gear or []:
        gear_id, _is_worn = map_class_to_gear(item)
        cleaned = gear_id or normalize_label(item)
        if cleaned in KNOWN_GEAR_IDS and cleaned not in required:
            required.append(cleaned)
    return required


def map_class_to_gear(class_name: str) -> tuple[str | None, bool]:
    """
    Return (gear_id, is_worn).
    Negative YOLO classes such as no_helmet map to helmet / False.
    """
    label = normalize_label(class_name)
    if not label:
        return None, True

    is_worn = True
    remainder = label
    for prefix in NEGATIVE_PREFIXES:
        if remainder.startswith(prefix):
            is_worn = False
            remainder = remainder[len(prefix):]
            break

    gear_id = CLASS_TO_GEAR.get(remainder)
    return gear_id, is_worn


def resolve_model_path() -> Path | None:
    requested = os.environ.get(
        "SAFEGUARD_PPE_MODEL",
        DEFAULT_PPE_WEIGHT,
    ).strip() or DEFAULT_PPE_WEIGHT
    requested_path = Path(requested)
    if not requested_path.is_absolute():
        requested_path = MODELS_DIR / requested
    if requested_path.exists():
        return requested_path
    for candidate in MODEL_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def load_model():
    global _model, _model_path

    model_path = resolve_model_path()
    if model_path is None:
        return None

    if _model is not None and _model_path == model_path:
        return _model

    from ultralytics import YOLO
    import numpy as np

    _model = YOLO(str(model_path))
    _model_path = model_path
    _model.predict(
        source=np.zeros((IMAGE_SIZE, IMAGE_SIZE, 3), dtype=np.uint8),
        conf=CONFIDENCE_THRESHOLD,
        imgsz=IMAGE_SIZE,
        verbose=False,
    )
    return _model


def ppe_timeout_result(
    required_gear: list[str] | None = None,
    elapsed_seconds: float = 0,
) -> dict[str, Any]:
    required = canonicalize_required_gear(required_gear)
    return {
        "detected_gear": [],
        "required_gear": required,
        "missing_gear": [],
        "compliant": False,
        "confidence": 0,
        "raw_detections": [],
        "notes": (
            "PPE detection timed out. Gear status is unavailable."
        ),
        "ppe_status": "timeout",
        "ppe_detection_time_seconds": round(elapsed_seconds, 2),
        "model_path": str(_model_path) if _model_path else "",
    }


def detect_safety_gear(
    image_path: str,
    required_gear: list[str] | None = None,
) -> dict[str, Any]:
    started_at = time.perf_counter()
    required = canonicalize_required_gear(required_gear)

    model = load_model()
    if model is None:
        return {
            "detected_gear": [],
            "required_gear": required,
            "missing_gear": required,
            "compliant": len(required) == 0,
            "confidence": 0,
            "raw_detections": [],
            "notes": (
                "PPE model not found. Place a trained weight at "
                "backend/models/best_v6.pt (or best_v5.pt / best_v4.pt)."
            ),
            "ppe_status": "model_missing",
            "ppe_detection_time_seconds": round(
                time.perf_counter() - started_at,
                2,
            ),
        }

    results = model.predict(
        source=image_path,
        conf=CONFIDENCE_THRESHOLD,
        imgsz=IMAGE_SIZE,
        verbose=False,
    )

    detected: list[str] = []
    raw_detections: list[dict[str, Any]] = []
    confidences: list[float] = []

    for result in results:
        if result.boxes is None:
            continue

        names = result.names or {}
        for box in result.boxes:
            class_id = int(box.cls.item())
            confidence = float(box.conf.item())
            class_name = str(names.get(class_id, class_id))
            gear_id, is_worn = map_class_to_gear(class_name)

            raw_detections.append(
                {
                    "class_id": class_id,
                    "class_name": class_name,
                    "gear_id": gear_id,
                    "worn": is_worn,
                    "confidence": round(confidence, 4),
                }
            )

            if gear_id and is_worn:
                confidences.append(confidence)
                if gear_id not in detected:
                    detected.append(gear_id)

    missing = [
        item
        for item in required
        if item not in detected
    ]

    average_confidence = (
        sum(confidences) / len(confidences)
        if confidences
        else 0
    )

    return {
        "detected_gear": detected,
        "required_gear": required,
        "missing_gear": missing,
        "compliant": len(missing) == 0,
        "confidence": round(average_confidence, 4),
        "raw_detections": raw_detections,
        "notes": (
            "PPE check complete."
            if model
            else "PPE model unavailable."
        ),
        "model_path": str(_model_path) if _model_path else "",
        "ppe_status": "ok",
        "ppe_detection_time_seconds": round(
            time.perf_counter() - started_at,
            2,
        ),
    }
