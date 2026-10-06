from app.routes.records import (
    delete_incident,
    is_valid_item_id,
)
from app.services.safety_detector import ppe_timeout_result
from fastapi import HTTPException
import pytest


def test_invalid_incident_ids_are_rejected():
    assert is_valid_item_id(None) is False
    assert is_valid_item_id("") is False
    assert is_valid_item_id("undefined") is False
    assert is_valid_item_id("null") is False
    assert is_valid_item_id("none") is False
    assert is_valid_item_id("  ") is False
    assert is_valid_item_id("incident-b") is True


def test_vest_maps_to_safety_vest():
    from app.services.safety_detector import map_class_to_gear

    gear_id, is_worn = map_class_to_gear("vest")
    assert gear_id == "safety_vest"
    assert is_worn is True
    assert map_class_to_gear("ear_protection")[0] == "ear_protection"
    assert map_class_to_gear("lab_coat")[0] == "lab_coat"


def test_default_ppe_weight_is_v6():
    from app.services.safety_detector import DEFAULT_PPE_WEIGHT

    assert DEFAULT_PPE_WEIGHT == "best_v6.pt"


def test_ppe_timeout_does_not_claim_missing_gear():
    result = ppe_timeout_result(["helmet", "goggles"], 6.8)
    assert result["ppe_status"] == "timeout"
    assert result["missing_gear"] == []
    assert result["compliant"] is False
    assert "timed out" in result["notes"].lower()


def test_missing_model_does_not_pretend_gear_was_checked(monkeypatch):
    from app.services import safety_detector

    monkeypatch.setattr(safety_detector, "resolve_model_path", lambda: None)
    monkeypatch.setattr(safety_detector, "_model", None)
    monkeypatch.setattr(safety_detector, "_model_path", None)

    result = safety_detector.detect_safety_gear("missing.jpg", ["helmet"])
    assert result["ppe_status"] == "model_missing"
    assert result["missing_gear"] == ["helmet"]
    assert "PPE model not found" in result["notes"]


def test_delete_one_incident_keeps_the_others(monkeypatch, tmp_path):
    from app.routes import records

    incidents_file = tmp_path / "incidents.json"
    monkeypatch.setattr(records, "INCIDENTS_FILE", incidents_file)

    records.save_list(
        incidents_file,
        [
            {"id": "incident-a", "worker_name": "A"},
            {"id": "incident-b", "worker_name": "B"},
            {"id": "incident-c", "worker_name": "C"},
        ],
    )

    delete_incident("incident-b")

    remaining = records.load_list(incidents_file)
    remaining_ids = [item["id"] for item in remaining]
    assert remaining_ids == ["incident-a", "incident-c"]


def test_missing_incident_id_does_not_delete_anything(monkeypatch, tmp_path):
    from app.routes import records

    incidents_file = tmp_path / "incidents.json"
    monkeypatch.setattr(records, "INCIDENTS_FILE", incidents_file)

    original = [
        {"id": "incident-a", "worker_name": "A"},
        {"id": "incident-b", "worker_name": "B"},
        {"id": "incident-c", "worker_name": "C"},
    ]
    records.save_list(incidents_file, original)

    with pytest.raises(HTTPException) as error:
        delete_incident("undefined")

    assert error.value.status_code == 400
    assert records.load_list(incidents_file) == original


def test_empty_incident_id_does_not_delete_anything(monkeypatch, tmp_path):
    from app.routes import records

    incidents_file = tmp_path / "incidents.json"
    monkeypatch.setattr(records, "INCIDENTS_FILE", incidents_file)

    original = [
        {"id": "incident-a", "worker_name": "A"},
        {"id": "", "worker_name": "broken"},
    ]
    records.save_list(incidents_file, original)

    with pytest.raises(HTTPException) as error:
        delete_incident("")

    assert error.value.status_code == 400
    assert records.load_list(incidents_file) == original
