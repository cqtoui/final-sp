"""
Build a YOLO train/val split from reviewed PPE labels.

Uses only private_training/dataset/images/unlabelled/ and
private_training/dataset/labels/reviewed/.
Does not read final_test, auto labels, or backend/models.
"""

from __future__ import annotations

import shutil
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = PROJECT_ROOT / "private_training" / "dataset" / "images" / "unlabelled"
LABEL_DIR = PROJECT_ROOT / "private_training" / "dataset" / "labels" / "reviewed"
YOLO_DIR = PROJECT_ROOT / "private_training" / "dataset" / "yolo"
YAML_PATH = PROJECT_ROOT / "private_training" / "dataset" / "ppe.yaml"
CLASS_FILE = PROJECT_ROOT / "private_training" / "dataset" / "classes.txt"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VAL_FRACTION = 0.2
CLASS_NAMES = [
    "helmet",
    "goggles",
    "gloves",
    "vest",
    "ear_protection",
    "lab_coat",
]


def list_images() -> list[Path]:
    return sorted(
        path
        for path in IMAGE_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def video_key(path: Path) -> str:
    stem = path.stem
    if "_s" in stem:
        return stem.rsplit("_s", 1)[0]
    return stem


def split_by_video(images: list[Path]) -> tuple[list[Path], list[Path]]:
    grouped: dict[str, list[Path]] = defaultdict(list)
    for path in images:
        grouped[video_key(path)].append(path)

    train: list[Path] = []
    val: list[Path] = []
    for video in sorted(grouped):
        frames = sorted(grouped[video])
        if len(frames) == 1:
            train.extend(frames)
            continue
        n_val = max(1, round(len(frames) * VAL_FRACTION))
        n_val = min(n_val, len(frames) - 1)
        val.extend(frames[-n_val:])
        train.extend(frames[:-n_val])
    return train, val


def reset_yolo_dirs() -> None:
    if YOLO_DIR.exists():
        shutil.rmtree(YOLO_DIR)
    for split in ("train", "val"):
        (YOLO_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (YOLO_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)


def copy_pair(image: Path, split: str) -> None:
    label = LABEL_DIR / f"{image.stem}.txt"
    if not label.exists():
        raise FileNotFoundError(f"Missing reviewed label for {image.name}")
    shutil.copy2(image, YOLO_DIR / "images" / split / image.name)
    shutil.copy2(label, YOLO_DIR / "labels" / split / label.name)


def write_yaml() -> None:
    names = "\n".join(f"  {index}: {name}" for index, name in enumerate(CLASS_NAMES))
    YAML_PATH.write_text(
        (
            f"path: {YOLO_DIR.as_posix()}\n"
            "train: images/train\n"
            "val: images/val\n"
            "names:\n"
            f"{names}\n"
        ),
        encoding="utf-8",
    )


def confirm_classes() -> None:
    if not CLASS_FILE.exists():
        raise FileNotFoundError(f"Missing class file: {CLASS_FILE}")
    on_disk = [
        line.strip()
        for line in CLASS_FILE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if on_disk != CLASS_NAMES:
        raise ValueError(f"Class list mismatch: {on_disk} != {CLASS_NAMES}")


def main() -> int:
    confirm_classes()
    images = list_images()
    if not images:
        print(f"No images found in {IMAGE_DIR}")
        return 1

    train, val = split_by_video(images)
    reset_yolo_dirs()
    for path in train:
        copy_pair(path, "train")
    for path in val:
        copy_pair(path, "val")
    write_yaml()

    print(f"Images: {len(images)}")
    print(f"Train: {len(train)}")
    print(f"Val: {len(val)}")
    print(f"YOLO folders: {YOLO_DIR}")
    print(f"Dataset yaml: {YAML_PATH}")
    print("final_test was not used.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
