from ultralytics import YOLO
from pathlib import Path

MODEL_PATH = Path("models/best.pt")

# Change this to the exact image name you want to test
IMAGE_PATH = Path("uploads/20260709_173441_589213_scan.jpg")

print("Model exists:", MODEL_PATH.exists())
print("Image exists:", IMAGE_PATH.exists())

model = YOLO(str(MODEL_PATH))

print("\nModel classes:")
print(model.names)

print("\nRunning prediction...")
results = model(str(IMAGE_PATH), conf=0.05)

for result in results:
    print("\nDetected boxes:", len(result.boxes))

    for box in result.boxes:
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        class_name = result.names[class_id]

        print({
            "class_id": class_id,
            "class_name": class_name,
            "confidence": round(confidence, 3),
            "box": [round(x, 2) for x in box.xyxy[0].tolist()],
        })