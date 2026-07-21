"""
数据收集服务：用户贡献图片 + 标签上传，支持扩展已有类别和新增病害类型。
图片存入 2.Model/Data/contributed/，元数据索引写入 contributions.json。
"""

import json
import shutil
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from PIL import Image

# ── 路径 ──────────────────────────────────────────────
MODEL_DIR = Path(__file__).resolve().parents[4] / "2.Model"
CONTRIBUTED_DIR = MODEL_DIR / "Data" / "contributed"
EXTEND_DIR = CONTRIBUTED_DIR / "extend"
NEW_DIR = CONTRIBUTED_DIR / "new"
INDEX_FILE = CONTRIBUTED_DIR / "contributions.json"
LABELS_PATH = MODEL_DIR / "Data" / "class_labels.json"

# 图片保存参数
SAVE_QUALITY = 92
SAVE_FORMAT = "JPEG"


# ── 枚举 ──────────────────────────────────────────────
class ContributionMode(str, Enum):
    EXTEND = "extend"
    NEW = "new"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ── 索引读写 ──────────────────────────────────────────
def _load_index() -> list[dict]:
    """读取 contributions.json 索引，文件不存在时返回空列表。"""
    if not INDEX_FILE.exists():
        return []
    try:
        with INDEX_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save_index(records: list[dict]):
    """写入 contributions.json，确保目录存在，使用 UTF-8 保证中文可读。"""
    INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    # 原子写入：先写临时文件，再替换
    tmp = INDEX_FILE.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    tmp.replace(INDEX_FILE)


# ── 工具函数 ──────────────────────────────────────────
def _make_short_label(en_class: str) -> str:
    """从英文类名提取简短标识，如 'Tomato___Early_blight' → 'Tom_Early_blight'。"""
    parts = en_class.split("___")
    if len(parts) == 2:
        return parts[0][:4] + "_" + parts[1][:16].replace(" ", "_")
    return en_class[:20].replace(" ", "_")


def _sanitize_filename(name: str) -> str:
    """将文件名中的不安全字符替换为下划线。"""
    return name.replace("/", "_").replace("\\", "_").replace(" ", "_")


def _as_url_path(p: Path) -> str:
    """将文件路径转为 URL 友好的正斜杠格式。"""
    return p.as_posix()


def _save_image(image: Image.Image, dest_dir: Path, filename: str):
    """将 PIL Image 统一转为 RGB JPEG 保存到目标目录。"""
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        bg = Image.new("RGB", image.size, (255, 255, 255))
        bg.paste(image, mask=image.split()[-1])
        image = bg
    elif image.mode != "RGB":
        image = image.convert("RGB")
    image.save(dest_path, SAVE_FORMAT, quality=SAVE_QUALITY)
    return dest_path


# ── 服务类 ────────────────────────────────────────────
class CollectorService:
    """数据收集服务：处理用户上传的标注图片，存储并建立索引。"""

    # ── 提交 ────────────────────────────────────────
    def submit(
        self,
        mode: str,
        images: list[Image.Image],
        existing_class: str = "",
        crop_name: str = "",
        disease_name: str = "",
        disease_description: str = "",
        location: str = "",
        photo_date: str = "",
        notes: str = "",
    ) -> dict:
        """
        提交一次数据贡献。

        参数:
            mode: "extend" 或 "new"
            images: PIL Image 对象列表
            existing_class: 扩展模式下对应的英文类名
            crop_name: 新增模式下的作物名
            disease_name: 新增模式下的病害名
            disease_description: 新增模式下的病害描述
            location: 拍摄地点
            photo_date: 拍摄时间 (YYYY-MM-DD)
            notes: 备注

        返回:
            贡献记录 dict（不含图片二进制数据）
        """
        now = datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        contribution_id = uuid.uuid4().hex[:12]
        saved_paths: list[str] = []

        if mode == ContributionMode.EXTEND:
            # 扩展已有类别：存入 contributed/extend/{英文类名}/
            safe_class = _sanitize_filename(existing_class)
            dest_dir = EXTEND_DIR / safe_class
            label_short = _make_short_label(existing_class)
            for i, img in enumerate(images):
                fname = f"ext_{label_short}_{timestamp}_{i+1:03d}.jpg"
                dest = _save_image(img, dest_dir, fname)
                saved_paths.append(_as_url_path(dest.relative_to(MODEL_DIR)))
        elif mode == ContributionMode.NEW:
            # 新增病害类型：存入 contributed/new/{作物}___{病害}/
            dir_name = _sanitize_filename(f"{crop_name}___{disease_name}")
            dest_dir = NEW_DIR / dir_name
            for i, img in enumerate(images):
                fname = f"new_{timestamp}_{i+1:03d}.jpg"
                dest = _save_image(img, dest_dir, fname)
                saved_paths.append(_as_url_path(dest.relative_to(MODEL_DIR)))
            # 写入 metadata.json 记录作物/病害元信息
            meta_path = dest_dir / "metadata.json"
            if not meta_path.exists():
                meta = {
                    "crop_name": crop_name,
                    "disease_name": disease_name,
                    "description": disease_description,
                    "submitted_at": now.strftime("%Y-%m-%d %H:%M:%S"),
                }
                with meta_path.open("w", encoding="utf-8") as f:
                    json.dump(meta, f, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的模式: {mode}，请使用 'extend' 或 'new'")

        # 构建贡献记录
        record = {
            "id": contribution_id,
            "mode": mode,
            "submit_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "status": ReviewStatus.PENDING,
            "existing_class": existing_class if mode == ContributionMode.EXTEND else "",
            "crop_name": crop_name if mode == ContributionMode.NEW else "",
            "disease_name": disease_name if mode == ContributionMode.NEW else "",
            "disease_description": disease_description if mode == ContributionMode.NEW else "",
            "image_count": len(images),
            "image_paths": saved_paths,
            "location": location,
            "photo_date": photo_date,
            "notes": notes,
            "review_notes": "",
        }

        # 写入索引
        index = _load_index()
        index.insert(0, record)
        _save_index(index)

        return record

    # ── 列出记录 ────────────────────────────────────
    def list_contributions(self, status: Optional[str] = None) -> list[dict]:
        """
        获取贡献记录列表。

        参数:
            status: 可选，按审核状态筛选 ('pending' / 'approved' / 'rejected')

        返回:
            贡献记录列表，按提交时间倒序
        """
        records = _load_index()
        if status and status in {s.value for s in ReviewStatus}:
            records = [r for r in records if r.get("status") == status]
        # 补充 image_url 方便前端展示
        for r in records:
            paths = r.get("image_paths", [])
            if paths:
                r["thumbnail"] = f"/model-data/{paths[0]}"
            else:
                r["thumbnail"] = ""
        return records

    # ── 审核 ────────────────────────────────────────
    def review(self, contribution_id: str, approved: bool, notes: str = "") -> bool:
        """
        审核一条贡献记录。

        参数:
            contribution_id: 贡献记录 ID
            approved: True = 已采纳, False = 未通过
            notes: 审核备注

        返回:
            True 表示操作成功，False 表示未找到该记录
        """
        records = _load_index()
        for r in records:
            if r.get("id") == contribution_id:
                r["status"] = ReviewStatus.APPROVED if approved else ReviewStatus.REJECTED
                if notes:
                    r["review_notes"] = notes
                _save_index(records)
                return True
        return False

    # ── 统计 ────────────────────────────────────────
    def get_stats(self) -> dict:
        """
        返回贡献统计数据。

        返回字段:
            total_submissions: 总提交数
            total_images: 总图片数
            approved_images: 已采纳图片数
            extend_count: 扩展已有类别提交数
            new_count: 新增病害类型提交数
            pending_count: 待审核数
        """
        records = _load_index()
        total_images = sum(r.get("image_count", 0) for r in records)
        approved_images = sum(
            r.get("image_count", 0) for r in records if r.get("status") == ReviewStatus.APPROVED
        )
        return {
            "total_submissions": len(records),
            "total_images": total_images,
            "approved_images": approved_images,
            "extend_count": sum(1 for r in records if r.get("mode") == ContributionMode.EXTEND),
            "new_count": sum(1 for r in records if r.get("mode") == ContributionMode.NEW),
            "pending_count": sum(1 for r in records if r.get("status") == ReviewStatus.PENDING),
        }

    # ── 获取已有类别列表 ─────────────────────────────
    @staticmethod
    def get_classes() -> list[dict]:
        """
        读取 class_labels.json 返回已有 38 类的中英文对照列表，
        供前端扩展模式下的病害下拉选择器使用。
        """
        if not LABELS_PATH.exists():
            return []
        with LABELS_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)


# 全局单例
collector_service = CollectorService()
