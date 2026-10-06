from pathlib import Path
from datetime import datetime
from fastapi import UploadFile

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


async def save_upload_file(file: UploadFile) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    safe_filename = file.filename.replace(" ", "_") if file.filename else "scan.jpg"
    file_path = UPLOAD_DIR / f"{timestamp}_{safe_filename}"

    content = await file.read()

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    return str(file_path)