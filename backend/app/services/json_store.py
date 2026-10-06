import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException


def load_list(path: Path) -> list[dict[str, Any]]:
    path.parent.mkdir(parents=True, exist_ok=True)

    if not path.exists():
        path.write_text("[]", encoding="utf-8")
        return []

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read {path.name}: {error}",
        ) from error

    if not isinstance(data, list):
        raise HTTPException(
            status_code=500,
            detail=f"{path.name} must contain a list.",
        )

    return data


def save_list(path: Path, items: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(items, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    temporary.replace(path)
