"""
Fine-tune PPE detection into version 5 with stronger lighting variation.

WARNING: this overwrites backend/models/best_v5.pt.
For a new version that keeps v5, use scripts/train_ppe_v6.py instead.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

os.environ["YOLO_OFFLINE"] = "1"
os.environ["WANDB_DISABLED"] = "true"
os.environ["ULTRALYTICS_OFFLINE"] = "1"

import torch
from ultralytics import YOLO
from ultralytics.utils import SETTINGS


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = PROJECT_ROOT / "backend" / "models"
YAML_PATH = PROJECT_ROOT / "private_training" / "dataset" / "ppe.yaml"
RUNS_DIR = PROJECT_ROOT / "private_training" / "runs"
OUTPUT_DIR = PROJECT_ROOT / "private_training" / "models"
OUTPUT_MODEL = OUTPUT_DIR / "best_v5.pt"
LIVE_MODEL = MODELS_DIR / "best_v5.pt"
BACKUP_MODEL = MODELS_DIR / "best_v5_before_lighting.pt"
FALLBACK_SOURCE = MODELS_DIR / "best_v4.pt"
RUN_NAME = "ppe_v5_lighting"

EXPECTED_NAMES = {
    0: "helmet",
    1: "goggles",
    2: "gloves",
    3: "vest",
    4: "ear_protection",
    5: "lab_coat",
}


def configure_ultralytics() -> None:
    SETTINGS.update({"sync": False})
    SETTINGS.update({"runs_dir": str(RUNS_DIR)})


def resolve_source() -> Path:
    if LIVE_MODEL.exists():
        return LIVE_MODEL
    if FALLBACK_SOURCE.exists():
        return FALLBACK_SOURCE
    raise FileNotFoundError(
        f"Missing source weights. Expected {LIVE_MODEL} or {FALLBACK_SOURCE}."
    )


def resolve_device() -> str | int:
    if torch.cuda.is_available():
        return 0
    return "cpu"


def main() -> int:
    configure_ultralytics()
    source = resolve_source()
    if not YAML_PATH.exists():
        raise FileNotFoundError(
            f"Missing {YAML_PATH}. Run scripts/prepare_ppe_yolo_split.py first."
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    shutil.copy2(source, BACKUP_MODEL)
    model = YOLO(str(BACKUP_MODEL))
    if dict(model.names) != EXPECTED_NAMES:
        raise ValueError(f"Unexpected class names: {model.names}")

    device = resolve_device()
    print(f"Starting lighting fine-tune from {source}")
    print(f"Backup of previous v5: {BACKUP_MODEL}")
    print(f"Device: {device}")
    print("HSV brightness/saturation/hue are increased for different lighting.")

    model.train(
        data=str(YAML_PATH),
        epochs=40,
        patience=12,
        imgsz=640,
        batch=8,
        device=device,
        workers=0,
        project=str(RUNS_DIR),
        name=RUN_NAME,
        exist_ok=True,
        pretrained=True,
        optimizer="AdamW",
        lr0=0.0008,
        lrf=0.01,
        cache=True,
        plots=True,
        save=True,
        verbose=True,
        close_mosaic=8,
        augment=True,
        # Stronger lighting shifts: dark rooms, glare, warm/cool lamps.
        hsv_h=0.04,
        hsv_s=0.9,
        hsv_v=0.9,
        mosaic=1.0,
        mixup=0.1,
        fliplr=0.5,
        translate=0.1,
        scale=0.5,
    )

    trained = RUNS_DIR / RUN_NAME / "weights" / "best.pt"
    if not trained.exists():
        raise FileNotFoundError(f"Training finished but {trained} was not created")

    shutil.copy2(trained, OUTPUT_MODEL)
    shutil.copy2(trained, LIVE_MODEL)

    print(f"Saved training copy: {OUTPUT_MODEL}")
    print(f"Live app weights updated: {LIVE_MODEL}")
    print(f"Previous v5 kept at: {BACKUP_MODEL}")
    print("Restart the backend so it loads the new best_v5.pt.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
