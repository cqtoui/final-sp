"""
Train PPE detection version 6.

Starts from frozen best_v5.pt.
Adds whatever is currently in the YOLO split (v5 frames plus newly
reviewed lighting frames).
Writes best_v6.pt only. Does not overwrite best_v5.pt.
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
OUTPUT_MODEL = OUTPUT_DIR / "best_v6.pt"
LIVE_V6 = MODELS_DIR / "best_v6.pt"
FROZEN_V5 = MODELS_DIR / "best_v5.pt"
RUN_NAME = "ppe_v6"

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


def resolve_device() -> str | int:
    if torch.cuda.is_available():
        return 0
    return "cpu"


def main() -> int:
    configure_ultralytics()
    if not FROZEN_V5.exists():
        raise FileNotFoundError(
            f"v5 weights are required as the starting point: {FROZEN_V5}"
        )
    if not YAML_PATH.exists():
        raise FileNotFoundError(
            f"Missing {YAML_PATH}. After labelling new frames, run "
            "scripts/prepare_ppe_yolo_split.py"
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    model = YOLO(str(FROZEN_V5))
    if dict(model.names) != EXPECTED_NAMES:
        raise ValueError(f"Unexpected class names: {model.names}")

    device = resolve_device()
    print(f"Starting v6 from frozen v5: {FROZEN_V5}")
    print(f"v5 will not be overwritten. Live app stays on best_v5.pt until you switch.")
    print(f"Device: {device}")

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
    shutil.copy2(trained, LIVE_V6)

    print(f"Saved training copy: {OUTPUT_MODEL}")
    print(f"Saved live-optional weights: {LIVE_V6}")
    print(f"Frozen v5 still at: {FROZEN_V5}")
    print("To try v6 in the app, set SAFEGUARD_PPE_MODEL=best_v6.pt and restart the backend.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
