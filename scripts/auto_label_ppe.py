"""
Auto-label extracted PPE frames with backend/models/best_v4.pt.

This script does not modify the model, the application, or final_test videos.
Labels come only from detector boxes, never from the video filename.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

import cv2
from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = PROJECT_ROOT / "backend" / "models" / "best_v5.pt"
FALLBACK_MODEL_PATH = PROJECT_ROOT / "backend" / "models" / "best_v4.pt"
IMAGE_DIR = PROJECT_ROOT / "private_training" / "dataset" / "images" / "unlabelled"
LABEL_DIR = PROJECT_ROOT / "private_training" / "dataset" / "labels" / "auto"
PREVIEW_DIR = PROJECT_ROOT / "private_training" / "dataset" / "previews"
NAMES_FILE = PROJECT_ROOT / "private_training" / "dataset" / "classes.txt"

# Labelling-only threshold. The live app stays at 0.25.
AUTO_LABEL_CONF = 0.15
REVIEW_CONF = 0.25
IMAGE_SIZE = 960

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Display names for previews. YOLO IDs stay the model's IDs.
DISPLAY_NAMES = {
    "helmet": "helmet",
    "goggles": "goggles",
    "gloves": "gloves",
    "vest": "safety vest",
    "safety_vest": "safety vest",
    "ear_protection": "ear protection",
    "lab_coat": "lab coat",
}

PREVIEW_COLORS = {
    0: (12, 88, 234),
    1: (136, 148, 13),
    2: (38, 38, 220),
    3: (12, 88, 234),
    4: (180, 80, 20),
    5: (80, 80, 80),
}


def list_images() -> list[Path]:
    if not IMAGE_DIR.exists():
        return []
    return sorted(
        path
        for path in IMAGE_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def display_name(class_name: str) -> str:
    key = str(class_name or "").strip().lower().replace("-", "_").replace(" ", "_")
    return DISPLAY_NAMES.get(key, class_name)


def to_yolo_line(class_id: int, xyxy: list[float], width: int, height: int) -> str:
    x1, y1, x2, y2 = xyxy
    box_w = max(0.0, x2 - x1)
    box_h = max(0.0, y2 - y1)
    cx = (x1 + x2) / 2.0 / width
    cy = (y1 + y2) / 2.0 / height
    nw = box_w / width
    nh = box_h / height
    cx = min(max(cx, 0.0), 1.0)
    cy = min(max(cy, 0.0), 1.0)
    nw = min(max(nw, 0.0), 1.0)
    nh = min(max(nh, 0.0), 1.0)
    return f"{class_id} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}"


def draw_preview(image_path: Path, detections: list[dict], save_path: Path) -> None:
    image = cv2.imread(str(image_path))
    if image is None:
        return
    for item in detections:
        x1, y1, x2, y2 = [int(round(value)) for value in item["xyxy"]]
        color = PREVIEW_COLORS.get(item["class_id"], (12, 88, 234))
        label = f"{item['display_name']} {item['confidence']:.2f}"
        cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
        text_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(
            image,
            (x1, max(0, y1 - text_size[1] - 8)),
            (x1 + text_size[0] + 6, y1),
            color,
            -1,
        )
        cv2.putText(
            image,
            label,
            (x1 + 3, max(14, y1 - 4)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
    cv2.imwrite(str(save_path), image)


def main() -> int:
    model_path = MODEL_PATH if MODEL_PATH.exists() else FALLBACK_MODEL_PATH
    if not model_path.exists():
        print(f"Model not found: {MODEL_PATH}")
        return 1

    images = list_images()
    LABEL_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Model: {model_path}")
    print(f"Images: {IMAGE_DIR}")
    print(f"Labels: {LABEL_DIR}")
    print(f"Previews: {PREVIEW_DIR}")
    print("Not using private_training/final_test/")
    print(f"Auto-label confidence: {AUTO_LABEL_CONF} (app threshold unchanged)")
    print()

    model = YOLO(str(model_path))
    names = model.names or {}
    print("Model class IDs and names:")
    for class_id in sorted(names):
        print(f"  {class_id}: {names[class_id]} -> {display_name(names[class_id])}")
    print()

    NAMES_FILE.write_text(
        "\n".join(str(names[class_id]) for class_id in sorted(names)) + "\n",
        encoding="utf-8",
    )

    class_counts: Counter[str] = Counter()
    empty_images: list[str] = []
    review_images: list[str] = []
    processed = 0

    for image_path in images:
        results = model.predict(
            source=str(image_path),
            conf=AUTO_LABEL_CONF,
            imgsz=IMAGE_SIZE,
            verbose=False,
        )
        processed += 1
        detections: list[dict] = []
        needs_review = False

        for result in results:
            height, width = result.orig_shape
            if result.boxes is None:
                continue
            result_names = result.names or names
            for box in result.boxes:
                class_id = int(box.cls.item())
                confidence = float(box.conf.item())
                class_name = str(result_names.get(class_id, class_id))
                xyxy = [float(value) for value in box.xyxy[0].tolist()]
                detections.append(
                    {
                        "class_id": class_id,
                        "class_name": class_name,
                        "display_name": display_name(class_name),
                        "confidence": confidence,
                        "xyxy": xyxy,
                        "width": width,
                        "height": height,
                    }
                )
                class_counts[display_name(class_name)] += 1
                if confidence < REVIEW_CONF:
                    needs_review = True

        label_path = LABEL_DIR / f"{image_path.stem}.txt"
        lines = [
            to_yolo_line(
                item["class_id"],
                item["xyxy"],
                item["width"],
                item["height"],
            )
            for item in detections
        ]
        label_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        draw_preview(image_path, detections, PREVIEW_DIR / f"{image_path.stem}.jpg")

        if not detections:
            empty_images.append(image_path.name)
            review_images.append(image_path.name)
        elif needs_review:
            review_images.append(image_path.name)

        if processed % 50 == 0:
            print(f"Processed {processed}/{len(images)}")

    print()
    print("=== Auto-label summary ===")
    print(f"Images processed: {processed}")
    print("Boxes by class:")
    expected = [
        "helmet",
        "goggles",
        "gloves",
        "safety vest",
        "ear protection",
        "lab coat",
    ]
    for name in expected:
        print(f"  {name}: {class_counts.get(name, 0)}")
    extra = sorted(set(class_counts) - set(expected))
    for name in extra:
        print(f"  {name}: {class_counts[name]}")
    print(f"Images with no labels: {len(empty_images)}")
    print(f"Images that may need manual review: {len(review_images)}")
    if empty_images:
        print("Unlabelled image names:")
        for name in empty_images:
            print(f"  {name}")
    print()
    print("These labels are not guaranteed to be correct.")
    print("Check them manually before any training.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
