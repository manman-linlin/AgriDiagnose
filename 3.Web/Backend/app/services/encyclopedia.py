"""
病害百科服务：从 app/data/encyclopedia.json 读取病害词条，供列表/详情/作物筛选接口使用。
之前前端 page-encyclopedia.js 请求这些接口时后端并不存在对应路由，导致每次都静默 fallback
到硬编码在 JS 里的数据；现在改为真实的单一数据源（后端 JSON），前端不再需要 fallback。
"""

import json
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "encyclopedia.json"

# 覆盖全部 14 种作物的展示顺序；暂无收录病害的作物计数显示为 0，保持列表完整。
ALL_CROPS = [
    "苹果", "蓝莓", "樱桃", "玉米", "葡萄", "柑橘", "桃",
    "甜椒", "马铃薯", "覆盆子", "大豆", "南瓜", "草莓", "番茄",
]


def _load() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    with DATA_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def list_diseases(crop: str = "", category: str = "", keyword: str = "") -> list[dict]:
    """按作物 / 分类 / 关键词过滤病害列表。"""
    diseases = _load()
    if crop:
        diseases = [d for d in diseases if d.get("crop_cn") == crop]
    if category and category != "全部":
        diseases = [d for d in diseases if d.get("category") == category]
    if keyword:
        q = keyword.strip().lower()
        diseases = [
            d for d in diseases
            if q in d.get("name_cn", "").lower()
            or q in d.get("name_en", "").lower()
            or q in d.get("symptom_summary", "").lower()
        ]
    return diseases


def get_detail(disease_id: str) -> dict | None:
    for d in _load():
        if d.get("id") == disease_id:
            return d
    return None


def list_crops() -> list[dict]:
    """返回全部作物及各自的病害词条数量，暂无收录的作物计数为 0。"""
    diseases = _load()
    counts: dict[str, int] = {}
    for d in diseases:
        crop = d.get("crop_cn", "")
        counts[crop] = counts.get(crop, 0) + 1

    crops = [{"name": c, "count": counts.get(c, 0)} for c in ALL_CROPS]
    # 兜底：数据里出现了但不在 ALL_CROPS 名单中的作物，追加到末尾
    for c, count in counts.items():
        if c not in ALL_CROPS:
            crops.append({"name": c, "count": count})
    return crops
