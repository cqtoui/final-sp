from app.auth import is_public_path
from app.services.safety_detector import map_class_to_gear, normalize_label
from app.services.json_store import load_list, save_list


def test_canonicalize_required_gear_keeps_only_known_items():
    from app.services.safety_detector import canonicalize_required_gear

    assert canonicalize_required_gear(
        ["gloves", "goggles", "lab_coat", "helmet", "steel_toe_boots"]
    ) == ["gloves", "goggles", "lab_coat", "helmet"]
    assert canonicalize_required_gear(["Safety Vest", "vest", "hard hat"]) == [
        "safety_vest",
        "helmet",
    ]
    assert canonicalize_required_gear(["unknown", "", None]) == []


def test_missing_gear_only_uses_required_items():
    from app.services.safety_detector import canonicalize_required_gear

    required = canonicalize_required_gear(
        ["gloves", "goggles", "lab_coat"]
    )
    detected = ["helmet", "goggles", "safety_vest"]
    missing = [item for item in required if item not in detected]
    assert missing == ["gloves", "lab_coat"]
    assert "helmet" not in missing
    assert "safety_vest" not in missing


def test_normalize_label_collapses_punctuation():
    assert normalize_label("Hard Hat") == "hard_hat"
    assert normalize_label("NO-Helmet") == "no_helmet"


def test_positive_and_negative_class_mapping():
    assert map_class_to_gear("Helmet") == ("helmet", True)
    assert map_class_to_gear("no_helmet") == ("helmet", False)
    assert map_class_to_gear("reflective vest") == ("safety_vest", True)
    assert map_class_to_gear("person") == (None, True)


def test_public_paths():
    assert is_public_path("/health")
    assert is_public_path("/")
    assert not is_public_path("/api/scan")
    assert not is_public_path("/api/workers")


def test_json_store_roundtrip(tmp_path):
    path = tmp_path / "items.json"
    save_list(path, [{"id": "1", "name": "gate"}])
    assert load_list(path) == [{"id": "1", "name": "gate"}]
