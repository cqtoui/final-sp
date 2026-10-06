from pathlib import Path
from ultralytics import YOLO


BACKEND_ROOT = Path(__file__).resolve().parent

MODEL_PATHS = {
    "v2": BACKEND_ROOT / "models" / "best_v2.pt",
    "v3": BACKEND_ROOT / "models" / "best_v3.pt",
}

TEST_IMAGES = BACKEND_ROOT / "test_images"
OUTPUT_ROOT = BACKEND_ROOT / "model_comparison"

CONFIDENCE_THRESHOLD = 0.15
IMAGE_SIZE = 768


def check_files() -> None:
    for model_name, model_path in MODEL_PATHS.items():
        if not model_path.exists():
            raise FileNotFoundError(
                f"{model_name} model not found:\n{model_path}"
            )

    if not TEST_IMAGES.exists():
        raise FileNotFoundError(
            f"Test image folder not found:\n{TEST_IMAGES}"
        )


def print_detections(model_name: str, result) -> None:
    print(f"\nModel: {model_name}")
    print(f"Image: {Path(result.path).name}")

    if result.boxes is None or len(result.boxes) == 0:
        print("No detections.")
        return

    for box in result.boxes:
        class_id = int(box.cls.item())
        confidence = float(box.conf.item())
        class_name = result.names[class_id]

        print(
            f"  {class_name}: "
            f"{confidence * 100:.1f}%"
        )


def main() -> None:
    check_files()

    image_files = [
        path
        for path in TEST_IMAGES.iterdir()
        if path.suffix.lower() in {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
        }
    ]

    if not image_files:
        raise RuntimeError(
            f"No test images found in:\n{TEST_IMAGES}"
        )

    print(f"Testing {len(image_files)} images.")

    for model_name, model_path in MODEL_PATHS.items():
        print("\n" + "=" * 60)
        print(f"Loading {model_name}: {model_path}")

        model = YOLO(str(model_path))

        print("Classes:", model.names)

        results = model.predict(
            source=str(TEST_IMAGES),
            conf=CONFIDENCE_THRESHOLD,
            imgsz=IMAGE_SIZE,
            save=True,
            project=str(OUTPUT_ROOT),
            name=model_name,
            exist_ok=True,
            verbose=False,
        )

        for result in results:
            print_detections(model_name, result)

    print("\nComparison finished.")
    print(f"Open this folder:\n{OUTPUT_ROOT}")


if __name__ == "__main__":
    main()