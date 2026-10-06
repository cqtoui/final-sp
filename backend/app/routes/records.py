import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.json_store import load_list, save_list


router = APIRouter()

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "worker_data"
ENTRY_POINTS_FILE = DATA_DIR / "entry_points.json"
INCIDENTS_FILE = DATA_DIR / "incidents.json"

DEFAULT_ENTRY_POINT = {
    "id": "default-entry",
    "name": "Default Entry",
    "department": "General",
    "location": "",
    "camera_status": "online",
    "required_gear": [
        "helmet",
        "goggles",
        "safety_vest",
        "gloves",
        "ear_protection",
        "lab_coat",
    ],
    "scans_today": 0,
    "violations_today": 0,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_entry_points() -> list[dict[str, Any]]:
    items = load_list(ENTRY_POINTS_FILE)
    if items:
        return items

    seeded = {
        **DEFAULT_ENTRY_POINT,
        "created_date": now_iso(),
        "updated_date": now_iso(),
    }
    save_list(ENTRY_POINTS_FILE, [seeded])
    return [seeded]


INVALID_ITEM_IDS = {
    "",
    "undefined",
    "null",
    "none",
}


def is_valid_item_id(item_id: str | None) -> bool:
    if item_id is None:
        return False

    cleaned = str(item_id).strip()
    if not cleaned:
        return False

    return cleaned.lower() not in INVALID_ITEM_IDS


def find_item(
    items: list[dict[str, Any]],
    item_id: str,
) -> dict[str, Any] | None:
    if not is_valid_item_id(item_id):
        return None

    return next(
        (item for item in items if str(item.get("id")) == str(item_id)),
        None,
    )


@router.get("/entry-points")
def list_entry_points():
    return {"entry_points": ensure_entry_points()}


@router.post("/entry-points", status_code=201)
def create_entry_point(payload: dict[str, Any]):
    items = ensure_entry_points()
    item_id = str(payload.get("id") or uuid.uuid4())
    if find_item(items, item_id):
        raise HTTPException(status_code=409, detail="Entry point already exists.")

    record = {
        **payload,
        "id": item_id,
        "created_date": payload.get("created_date") or now_iso(),
        "updated_date": now_iso(),
    }
    items.insert(0, record)
    save_list(ENTRY_POINTS_FILE, items)
    return {"entry_point": record}


@router.put("/entry-points/{item_id}")
def update_entry_point(item_id: str, payload: dict[str, Any]):
    items = ensure_entry_points()
    existing = find_item(items, item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Entry point not found.")

    updated = {
        **existing,
        **payload,
        "id": existing["id"],
        "updated_date": now_iso(),
    }
    items = [
        updated if str(item.get("id")) == str(item_id) else item
        for item in items
    ]
    save_list(ENTRY_POINTS_FILE, items)
    return {"entry_point": updated}


@router.delete("/entry-points/{item_id}")
def delete_entry_point(item_id: str):
    items = ensure_entry_points()
    if find_item(items, item_id) is None:
        raise HTTPException(status_code=404, detail="Entry point not found.")

    remaining = [
        item for item in items if str(item.get("id")) != str(item_id)
    ]
    save_list(ENTRY_POINTS_FILE, remaining)
    return {"message": "Entry point deleted."}


@router.get("/incidents")
def list_incidents():
    return {"incidents": load_list(INCIDENTS_FILE)}


@router.post("/incidents", status_code=201)
def create_incident(payload: dict[str, Any]):
    items = load_list(INCIDENTS_FILE)
    item_id = str(payload.get("id") or uuid.uuid4())
    record = {
        **payload,
        "id": item_id,
        "created_date": payload.get("created_date") or now_iso(),
        "updated_date": now_iso(),
    }
    items.insert(0, record)
    save_list(INCIDENTS_FILE, items)
    return {"incident": record}


@router.put("/incidents/{item_id}")
def update_incident(item_id: str, payload: dict[str, Any]):
    items = load_list(INCIDENTS_FILE)
    existing = find_item(items, item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Incident not found.")

    updated = {
        **existing,
        **payload,
        "id": existing["id"],
        "updated_date": now_iso(),
    }
    items = [
        updated if str(item.get("id")) == str(item_id) else item
        for item in items
    ]
    save_list(INCIDENTS_FILE, items)
    return {"incident": updated}


@router.delete("/incidents/{item_id}")
def delete_incident(item_id: str):
    if not is_valid_item_id(item_id):
        raise HTTPException(
            status_code=400,
            detail="A valid incident ID is required.",
        )

    items = load_list(INCIDENTS_FILE)
    existing = find_item(items, item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Incident not found.")

    target_id = str(existing.get("id"))
    remaining = [
        item for item in items if str(item.get("id")) != target_id
    ]
    save_list(INCIDENTS_FILE, remaining)
    return {"message": "Incident deleted."}
