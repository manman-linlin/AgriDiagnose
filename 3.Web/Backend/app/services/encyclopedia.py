"""Thread-safe JSON-backed service for encyclopedia entries."""

from __future__ import annotations

import copy
import json
import os
import tempfile
import threading
import uuid
from pathlib import Path
from typing import Any

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "encyclopedia.json"
SAMPLE_IMAGES_DIR = Path(__file__).resolve().parents[4] / "5.Test" / "image"
MANAGED_IMAGE_URL_PREFIX = "/model-data/encyclopedia_images/"

CATEGORIES = ["真菌性病害", "细菌性病害", "病毒性病害", "虫害", "健康状态"]
RISK_LEVELS = ["低", "中", "高", "严重"]
ALL_CROPS = [
    "苹果", "蓝莓", "樱桃", "玉米", "葡萄", "柑橘", "桃",
    "甜椒", "马铃薯", "覆盆子", "大豆", "南瓜", "草莓", "番茄",
]

_LOCK = threading.RLock()


class EncyclopediaConflictError(ValueError):
    """Raised when an ID or class name conflicts with persisted data."""


class EncyclopediaNotFoundError(LookupError):
    """Raised when an encyclopedia entry does not exist."""


def _sample_image_urls() -> dict[str, str]:
    """Index the first supported test image by its Chinese class name."""
    if not SAMPLE_IMAGES_DIR.is_dir():
        return {}
    urls: dict[str, str] = {}
    for class_dir in SAMPLE_IMAGES_DIR.iterdir():
        if not class_dir.is_dir() or "_" not in class_dir.name:
            continue
        class_name = class_dir.name.split("_", 1)[1]
        sample = next(
            (p for p in sorted(class_dir.iterdir()) if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}),
            None,
        )
        if sample:
            urls[class_name] = f"/encyclopedia-images/{class_dir.name}/{sample.name}"
    return urls


def _read_unlocked() -> list[dict[str, Any]]:
    if not DATA_FILE.exists():
        return []
    with DATA_FILE.open("r", encoding="utf-8") as stream:
        value = json.load(stream)
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise ValueError("百科数据文件必须是 JSON 对象数组")
    return value


def _write_unlocked(entries: list[dict[str, Any]]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=DATA_FILE.parent,
            prefix=f".{DATA_FILE.name}.", suffix=".tmp", delete=False,
        ) as stream:
            temp_name = stream.name
            json.dump(entries, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, DATA_FILE)
        temp_name = None
    finally:
        if temp_name:
            Path(temp_name).unlink(missing_ok=True)


def _validate_uniqueness(entries: list[dict[str, Any]]) -> None:
    ids: set[str] = set()
    classes: set[str] = set()
    for entry in entries:
        entry_id = entry.get("id")
        if not entry_id or entry_id in ids:
            raise EncyclopediaConflictError(f"百科 ID 重复或为空: {entry_id or '<empty>'}")
        ids.add(entry_id)
        class_en = (entry.get("class_en") or "").strip()
        if class_en:
            if class_en in classes:
                raise EncyclopediaConflictError(f"class_en 重复: {class_en}")
            classes.add(class_en)


def _with_image(entry: dict[str, Any], samples: dict[str, str]) -> dict[str, Any]:
    result = copy.deepcopy(entry)
    persisted_url = result.get("image_url")
    if isinstance(persisted_url, str) and persisted_url.strip():
        result["image_url"] = persisted_url.strip()
        result["image_source"] = "uploaded"
        return result
    sample_url = samples.get(str(result.get("name_cn", "")))
    result["image_url"] = sample_url or ""
    result["image_source"] = "sample" if sample_url else "none"
    return result


def load_entries(*, resolve_images: bool = True) -> list[dict[str, Any]]:
    with _LOCK:
        entries = copy.deepcopy(_read_unlocked())
    if not resolve_images:
        return entries
    samples = _sample_image_urls()
    return [_with_image(entry, samples) for entry in entries]


def list_diseases(
    crop: str = "", category: str = "", keyword: str = "", risk: str = "",
) -> list[dict[str, Any]]:
    diseases = load_entries()
    if crop:
        diseases = [d for d in diseases if d.get("crop_cn") == crop]
    if category and category != "全部":
        diseases = [d for d in diseases if d.get("category") == category]
    if risk:
        diseases = [d for d in diseases if d.get("risk_level") == risk]
    if keyword.strip():
        query = keyword.strip().lower()
        diseases = [
            d for d in diseases
            if any(query in str(d.get(field, "")).lower() for field in ("name_cn", "name_en", "symptom_summary", "summary"))
        ]
    return diseases


def get_detail(disease_id: str) -> dict[str, Any] | None:
    return next((entry for entry in load_entries() if entry.get("id") == disease_id), None)


def create_entry(entry: dict[str, Any]) -> dict[str, Any]:
    clean = copy.deepcopy(entry)
    clean["id"] = clean.get("id") or uuid.uuid4().hex[:12]
    with _LOCK:
        entries = _read_unlocked()
        proposed = [clean, *entries]
        _validate_uniqueness(proposed)
        _write_unlocked(proposed)
    return _with_image(clean, _sample_image_urls())


def update_entry(disease_id: str, replacement: dict[str, Any]) -> dict[str, Any]:
    clean = copy.deepcopy(replacement)
    supplied_id = clean.get("id")
    if supplied_id and supplied_id != disease_id:
        raise EncyclopediaConflictError("请求体中的 id 不得与路径 id 不同")
    clean["id"] = disease_id
    with _LOCK:
        entries = _read_unlocked()
        index = next((i for i, entry in enumerate(entries) if entry.get("id") == disease_id), None)
        if index is None:
            raise EncyclopediaNotFoundError(disease_id)
        # Optional fields omitted by the client retain their persisted values.
        merged = copy.deepcopy(entries[index])
        merged.update(clean)
        if not clean.get("image_url") and entries[index].get("image_url"):
            merged["image_url"] = entries[index]["image_url"]
        clean = merged
        entries[index] = clean
        _validate_uniqueness(entries)
        _write_unlocked(entries)
    return _with_image(clean, _sample_image_urls())


def set_image_url(disease_id: str, image_url: str) -> dict[str, Any]:
    with _LOCK:
        entries = _read_unlocked()
        entry = next((item for item in entries if item.get("id") == disease_id), None)
        if entry is None:
            raise EncyclopediaNotFoundError(disease_id)
        entry["image_url"] = image_url
        _write_unlocked(entries)
        result = copy.deepcopy(entry)
    return _with_image(result, _sample_image_urls())


def delete_entry(disease_id: str) -> dict[str, Any]:
    with _LOCK:
        entries = _read_unlocked()
        index = next((i for i, entry in enumerate(entries) if entry.get("id") == disease_id), None)
        if index is None:
            raise EncyclopediaNotFoundError(disease_id)
        removed = entries.pop(index)
        _write_unlocked(entries)
    return removed


def batch_import(valid_entries: list[dict[str, Any]], *, dry_run: bool, mode: str) -> dict[str, Any]:
    if mode not in {"skip", "update"}:
        raise ValueError("mode 只能为 skip 或 update")
    with _LOCK:
        current = _read_unlocked()
        working = copy.deepcopy(current)
        by_id = {entry.get("id"): i for i, entry in enumerate(working)}
        created = updated = skipped = 0
        errors: list[dict[str, Any]] = []

        batch_ids: set[str] = set()
        batch_classes: set[str] = set()
        for position, raw in enumerate(valid_entries):
            entry = copy.deepcopy(raw)
            entry["id"] = entry.get("id") or uuid.uuid4().hex[:12]
            class_en = (entry.get("class_en") or "").strip()
            if entry["id"] in batch_ids or (class_en and class_en in batch_classes):
                errors.append({"index": position, "id": entry["id"], "message": "duplicate id or class_en in import batch"})
                continue
            batch_ids.add(entry["id"])
            if class_en:
                batch_classes.add(class_en)
            existing_index = by_id.get(entry["id"])
            if existing_index is not None and mode == "skip":
                skipped += 1
                continue
            candidate = copy.deepcopy(working)
            if existing_index is None:
                candidate.append(entry)
            else:
                if "image_url" not in entry and working[existing_index].get("image_url"):
                    entry["image_url"] = working[existing_index]["image_url"]
                candidate[existing_index] = entry
            try:
                _validate_uniqueness(candidate)
            except EncyclopediaConflictError as exc:
                errors.append({"index": position, "id": entry["id"], "message": str(exc)})
                continue
            working = candidate
            if existing_index is None:
                by_id[entry["id"]] = len(working) - 1
                created += 1
            else:
                updated += 1

        if not dry_run and not errors:
            _write_unlocked(working)
    return {"created": created, "updated": updated, "skipped": skipped, "errors": errors, "dry_run": dry_run}


def list_crops() -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for disease in load_entries(resolve_images=False):
        crop = str(disease.get("crop_cn", ""))
        counts[crop] = counts.get(crop, 0) + 1
    crops = [{"name": crop, "count": counts.get(crop, 0)} for crop in ALL_CROPS]
    crops.extend({"name": crop, "count": count} for crop, count in counts.items() if crop not in ALL_CROPS)
    return crops


def list_categories() -> list[dict[str, Any]]:
    counts = {category: 0 for category in CATEGORIES}
    for disease in load_entries(resolve_images=False):
        category = disease.get("category")
        if category in counts:
            counts[category] += 1
    return [{"name": category, "count": counts[category]} for category in CATEGORIES]
