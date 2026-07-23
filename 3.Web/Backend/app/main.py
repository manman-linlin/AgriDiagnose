"""
病虫害诊断 WebAPI —— FastAPI 应用入口。
启动: python run.py  或  uvicorn app.main:app --reload
"""

import io
import json
import os
import re
import secrets
import time
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import Body, Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from PIL import Image

from app.services import agent_service, encyclopedia
from app.services.classifier import classifier
from app.services.collector import collector_service

app = FastAPI(title="农作物病虫害诊断系统", version="1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_cache_frontend_assets(request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response


# ── 路径 ────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "Frontend"
PROJECT_DIR = Path(__file__).resolve().parents[3]
MODEL_DATA_DIR = PROJECT_DIR / "2.Model" / "Data"
ENCYCLOPEDIA_IMAGES_DIR = PROJECT_DIR / "5.Test" / "image"
UPLOADS_DIR = BACKEND_DIR / "uploads"
LOGS_DIR = BACKEND_DIR / "logs"
HISTORY_FILE = LOGS_DIR / "history.json"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# 静态文件挂载
if FRONTEND_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
if MODEL_DATA_DIR.is_dir():
    app.mount("/model-data", StaticFiles(directory=str(MODEL_DATA_DIR)), name="model-data")
if ENCYCLOPEDIA_IMAGES_DIR.is_dir():
    app.mount(
        "/encyclopedia-images",
        StaticFiles(directory=str(ENCYCLOPEDIA_IMAGES_DIR)),
        name="encyclopedia-images",
    )


# ── 历史记录读写 ────────────────────────────────────
def load_history() -> list:
    if not HISTORY_FILE.exists():
        return []
    with HISTORY_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_history(records: list):
    with HISTORY_FILE.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


def save_advice_to_history(diagnosis_id: str | None, advice: dict | None, review: dict | None):
    """把 Agent 生成的建议/复核结果写回对应的诊断记录，供历史页面追溯。
    找不到记录或 diagnosis_id 为空时静默跳过，不影响主对话流程。"""
    if not diagnosis_id or not advice:
        return
    history = load_history()
    for r in history:
        if r.get("id") == diagnosis_id:
            r["advice"] = advice
            r["manual_check_required"] = advice.get("manual_check_required", False)
            if review:
                r["review"] = review
            save_history(history)
            return


# ── 生命周期 ────────────────────────────────────────
@app.on_event("startup")
def startup():
    try:
        classifier.load()
    except FileNotFoundError as e:
        print(f"[WARN] {e}")
    except Exception as e:
        print(f"[ERROR] 模型加载失败: {e}")


# ── API ─────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "model_ready": classifier.is_ready}


@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        return JSONResponse(status_code=400, content={"code": 400, "message": "请上传图片文件"})

    if not classifier.is_ready:
        return JSONResponse(status_code=503, content={"code": 503, "message": "模型未就绪"})

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        results = classifier.predict(image, topk=3)

        # 保存上传图片（统一转为 RGB JPEG）
        img_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.jpg"
        img_path = UPLOADS_DIR / img_name
        image.convert("RGB").save(img_path, "JPEG", quality=85)

        # 记录历史
        record = {
            "id": uuid.uuid4().hex[:12],
            "filename": file.filename,
            "image": img_name,
            "top1": results[0],
            "top3": results,
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        history = load_history()
        history.insert(0, record)
        save_history(history)

        return {
            "code": 200,
            "message": "success",
            "data": {
                "id": record["id"],
                "filename": file.filename,
                "image_url": f"/uploads/{img_name}",
                "top1": results[0] if results else None,
                "top3": results,
            },
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "message": f"识别失败: {str(e)}"})


@app.get("/api/history")
def get_history():
    """获取历史诊断记录。"""
    history = load_history()
    # 补充 image_url
    for r in history:
        r["image_url"] = f"/uploads/{r['image']}"
    return {"code": 200, "data": history}


@app.delete("/api/history/{record_id}")
def delete_history(record_id: str):
    """删除一条历史记录。"""
    history = load_history()
    history = [r for r in history if r["id"] != record_id]
    save_history(history)
    return {"code": 200, "message": "ok"}


@app.get("/api/stats")
def get_stats():
    """返回历史诊断的类别分布统计。"""
    history = load_history()
    counter = {}
    for r in history:
        label = r["top1"]["label_cn"]
        counter[label] = counter.get(label, 0) + 1
    data = [{"name": k, "value": v} for k, v in sorted(counter.items(), key=lambda x: -x[1])]
    return {"code": 200, "data": data, "total": len(history)}


# ── 数据贡献（收集模块）──────────────────────────────
@app.post("/api/contribute")
async def contribute(
    mode: str = Form(...),
    files: list[UploadFile] = File(...),
    existing_class: str = Form(""),
    crop_name: str = Form(""),
    disease_name: str = Form(""),
    disease_description: str = Form(""),
    location: str = Form(""),
    photo_date: str = Form(""),
    notes: str = Form(""),
):
    """用户提交数据贡献：上传标注图片，扩展训练数据集。"""
    # ── 参数校验 ──
    if mode not in {"extend", "new"}:
        return JSONResponse(status_code=400, content={"code": 400, "message": "mode 只能为 'extend' 或 'new'"})

    if mode == "extend" and not existing_class.strip():
        return JSONResponse(status_code=400, content={"code": 400, "message": "扩展模式下必须选择病害类别"})

    if mode == "new":
        if not crop_name.strip():
            return JSONResponse(status_code=400, content={"code": 400, "message": "新增模式下作物名称为必填"})
        if not disease_name.strip():
            return JSONResponse(status_code=400, content={"code": 400, "message": "新增模式下病害名称为必填"})

    # ── 过滤并读取图片 ──
    images: list[Image.Image] = []
    for f in files:
        if not f.content_type or not f.content_type.startswith("image/"):
            continue
        try:
            contents = await f.read()
            images.append(Image.open(io.BytesIO(contents)))
        except Exception:
            continue

    if not images:
        return JSONResponse(status_code=400, content={"code": 400, "message": "请至少上传一张有效图片"})

    # ── 提交 ──
    try:
        record = collector_service.submit(
            mode=mode,
            images=images,
            existing_class=existing_class.strip(),
            crop_name=crop_name.strip(),
            disease_name=disease_name.strip(),
            disease_description=disease_description.strip(),
            location=location.strip(),
            photo_date=photo_date.strip(),
            notes=notes.strip(),
        )
        return {
            "code": 200,
            "message": "提交成功，感谢您的贡献！",
            "data": {"id": record["id"]},
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "message": f"提交失败: {str(e)}"})


@app.get("/api/contribute/list")
def contribute_list(status: str = ""):
    """获取贡献记录列表，可按审核状态筛选。"""
    try:
        records = collector_service.list_contributions(status=status if status else None)
        return {"code": 200, "data": records, "total": len(records)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "message": f"获取失败: {str(e)}"})


@app.get("/api/contribute/stats")
def contribute_stats():
    """获取贡献统计数据。"""
    try:
        stats = collector_service.get_stats()
        return {"code": 200, "data": stats}
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "message": f"获取失败: {str(e)}"})


@app.get("/api/contribute/classes")
def contribute_classes():
    """获取已有 38 类病害中英文对照列表，供前端下拉选择器使用。"""
    try:
        classes = collector_service.get_classes()
        return {"code": 200, "data": classes}
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "message": f"获取失败: {str(e)}"})


# ── 病害百科 ──────────────────────────────────────────
@app.get("/api/encyclopedia/list")
def encyclopedia_list(crop: str = "", category: str = "", keyword: str = ""):
    """病害百科列表，支持按作物 / 分类 / 关键词过滤。"""
    try:
        diseases = encyclopedia.list_diseases(crop=crop, category=category, keyword=keyword)
        return {"code": 200, "data": diseases, "total": len(diseases)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "message": f"获取失败: {str(e)}"})


@app.get("/api/encyclopedia/crops")
def encyclopedia_crops():
    """全部作物及各自收录的病害词条数量。"""
    try:
        return {"code": 200, "data": encyclopedia.list_crops()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "message": f"获取失败: {str(e)}"})


@app.get("/api/encyclopedia/categories")
def encyclopedia_categories():
    try:
        return {"code": 200, "data": encyclopedia.list_categories()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "message": f"Failed to load categories: {str(e)}"})


@app.get("/api/encyclopedia/{disease_id}")
def encyclopedia_detail(disease_id: str):
    """单个病害详情。"""
    detail = encyclopedia.get_detail(disease_id)
    if not detail:
        return JSONResponse(status_code=404, content={"code": 404, "message": "未找到该病害词条"})
    return {"code": 200, "data": detail}


# ── Pydantic 模型 ─────────────────────────────────────
class AdminLoginRequest(BaseModel):
    password: str


class AdminReviewRequest(BaseModel):
    approved: bool = False
    notes: str = ""


# ── 管理员认证 ────────────────────────────────────────
class EncyclopediaSourceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str
    organization: str = ""
    url: str = ""

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        if not value:
            raise ValueError("来源标题不能为空")
        return value

    @field_validator("url")
    @classmethod
    def valid_url(cls, value: str) -> str:
        if value and not value.lower().startswith(("http://", "https://")):
            raise ValueError("来源网址必须以 http:// 或 https:// 开头")
        return value


class EncyclopediaEntryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: str | None = None
    name_cn: str
    name_en: str
    crop_cn: str
    category: str
    risk_level: str
    summary: str = Field(validation_alias=AliasChoices("summary", "symptom_summary"))
    symptoms: list[str]
    prevention: list[str] = []
    treatment: list[str] = []
    class_en: str | None = None
    epidemiology: str | None = None
    pathogen: str | None = None
    differentiation: str | None = None
    sources: list[EncyclopediaSourceRequest] = []
    image_url: str | None = None
    image_source: str | None = None

    @field_validator("id", "name_cn", "name_en", "crop_cn", "summary")
    @classmethod
    def nonempty_string(cls, value):
        if value is not None and not value.strip():
            raise ValueError("字段不能为空")
        return value

    @field_validator("class_en", "epidemiology", "pathogen", "differentiation", "image_url", mode="before")
    @classmethod
    def clean_optional_string(cls, value):
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("字段必须是字符串")
        return value.strip() or None

    @field_validator("category")
    @classmethod
    def valid_category(cls, value):
        if value not in encyclopedia.CATEGORIES:
            raise ValueError("不支持的百科类别")
        return value

    @field_validator("risk_level")
    @classmethod
    def valid_risk(cls, value):
        if value not in encyclopedia.RISK_LEVELS:
            raise ValueError("不支持的风险等级")
        return value

    @field_validator("symptoms", "prevention", "treatment", mode="before")
    @classmethod
    def clean_string_array(cls, value):
        if not isinstance(value, list):
            raise ValueError("字段必须是字符串数组")
        cleaned = []
        for item in value:
            if not isinstance(item, str):
                raise ValueError("数组元素必须是字符串")
            if item.strip():
                cleaned.append(item.strip())
        return cleaned

    @model_validator(mode="after")
    def symptoms_required(self):
        if not self.symptoms:
            raise ValueError("至少需要一条典型症状")
        return self

    def to_entry(self) -> dict:
        entry = self.model_dump(exclude={"image_source"}, exclude_none=True)
        if self.image_source in {"sample", "none"}:
            entry.pop("image_url", None)
        entry["symptom_summary"] = entry.pop("summary")
        entry["sources"] = [source.model_dump() for source in self.sources]
        entry["updated_at"] = datetime.now().strftime("%Y-%m-%d")
        return entry


class EncyclopediaBatchImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entries: list[dict]
    dry_run: bool = False
    mode: str = "skip"

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, value):
        if value not in {"skip", "update"}:
            raise ValueError("mode must be skip or update")
        return value

    @model_validator(mode="after")
    def nonempty_entries(self):
        if not self.entries:
            raise ValueError("entries must not be empty")
        return self


ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_TOKENS: set[str] = set()


def _require_admin(authorization: str = Header("")) -> None:
    """FastAPI 依赖：验证 Bearer token，未通过抛出 401。"""
    if not authorization.startswith("Bearer "):
        raise _auth_error()
    token = authorization[len("Bearer "):]
    if token not in ADMIN_TOKENS:
        raise _auth_error()


def _auth_error():
    raise HTTPException(status_code=401, detail="请先登录管理员账号")


# ── 管理员 API ───────────────────────────────────────
@app.post("/api/admin/login")
def admin_login(payload: AdminLoginRequest):
    """管理员密码登录，返回一次性 token。"""
    if payload.password != ADMIN_PASSWORD:
        return JSONResponse(status_code=401, content={"code": 401, "message": "密码错误"})
    token = secrets.token_hex(32)
    ADMIN_TOKENS.add(token)
    return {"code": 200, "data": {"token": token}}


@app.post("/api/admin/logout")
def admin_logout(authorization: str = Header("")):
    """退出登录，销毁 token。"""
    if authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]
        ADMIN_TOKENS.discard(token)
    return {"code": 200, "message": "已退出"}


@app.post("/api/admin/review/{contribution_id}")
def admin_review(
    contribution_id: str,
    _: None = Depends(_require_admin),
    payload: AdminReviewRequest = Body(...),
):
    """审核一条贡献记录（需管理员登录）。"""
    success = collector_service.review(contribution_id, payload.approved, payload.notes)
    if not success:
        return JSONResponse(status_code=404, content={"code": 404, "message": "未找到该贡献记录"})
    status_text = "已采纳" if payload.approved else "已驳回"
    return {"code": 200, "message": f"审核完成：{status_text}"}


@app.get("/api/admin/contributions")
def admin_contributions(
    status: str = "",
    _: None = Depends(_require_admin),
):
    """管理员视角获取全部贡献记录（含审核操作数据）。"""
    try:
        records = collector_service.list_contributions(status=status if status else None)
        return {"code": 200, "data": records, "total": len(records)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "message": f"获取失败: {str(e)}"})


# ── 批量审核 ──────────────────────────────────────────
class BatchReviewRequest(BaseModel):
    ids: list[str] = []
    approved: bool = False
    notes: str = ""

@app.post("/api/admin/review/batch")
def admin_review_batch(
    _: None = Depends(_require_admin),
    payload: BatchReviewRequest = Body(...),
):
    """批量审核贡献记录。"""
    success = 0
    for cid in payload.ids:
        if collector_service.review(cid, payload.approved, payload.notes):
            success += 1
    return {"code": 200, "message": f"已处理 {success}/{len(payload.ids)} 条"}


# ── 仪表盘 API ────────────────────────────────────────
@app.get("/api/admin/dashboard/overview")
def dashboard_overview(_: None = Depends(_require_admin)):
    """仪表盘概览数据。"""
    history = load_history()
    contributions = collector_service.list_contributions()
    today = datetime.now().strftime("%Y-%m-%d")
    today_count = sum(1 for r in history if r.get("time", "").startswith(today))
    pending = sum(1 for r in contributions if r.get("status") == "pending")
    categories = len(set(r["top1"]["label_cn"] for r in history if r.get("top1")))
    return {
        "code": 200,
        "data": {
            "total": len(history),
            "today": today_count,
            "users": 0,
            "categories": max(categories, 38),
            "pending": pending,
            "modelStatus": "正常",
        },
    }


@app.get("/api/admin/dashboard/trends")
def dashboard_trends(days: int = 30, _: None = Depends(_require_admin)):
    """诊断趋势：按日期聚合。"""
    from collections import Counter
    history = load_history()
    counter = Counter()
    for r in history:
        date = (r.get("time", "") or "")[:10]
        if date:
            counter[date] += 1
    # 补全近 N 天的日期
    from datetime import timedelta
    result = []
    for i in range(days - 1, -1, -1):
        d = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        result.append({"date": d, "count": counter.get(d, 0)})
    return {"code": 200, "data": result}


@app.get("/api/admin/dashboard/distribution")
def dashboard_distribution(_: None = Depends(_require_admin)):
    """作物诊断分布。"""
    import json as _json
    labels_path = MODEL_DATA_DIR / "class_labels.json"
    en_to_crop = {}
    if labels_path.exists():
        with labels_path.open("r", encoding="utf-8") as f:
            for item in _json.load(f):
                en_to_crop[item["en"]] = item.get("crop", "")
    from collections import Counter
    history = load_history()
    crop_counter = Counter()
    for r in history:
        en = r.get("top1", {}).get("label_en", "")
        crop = en_to_crop.get(en, "")
        if crop:
            crop_counter[crop] += 1
    data = [{"name": k, "value": v} for k, v in crop_counter.most_common(10)]
    return {"code": 200, "data": data}


# ── 模型管理 API ──────────────────────────────────────
@app.get("/api/admin/model/info")
def admin_model_info(_: None = Depends(_require_admin)):
    """当前模型信息。"""
    meta_path = MODEL_DATA_DIR.parent / "Weights" / "meta.json"
    info = {"name": "ConvNeXt-Tiny", "accuracy": "99.80%", "classes": 38, "size": "111.5 MB", "lastTrain": "-"}
    if meta_path.exists():
        import json as _json
        with meta_path.open("r", encoding="utf-8") as f:
            meta = _json.load(f)
            info["accuracy"] = f"{meta.get('best_acc', 0.998) * 100:.2f}%"
            info["classes"] = len(meta.get("classes", []))
    return {"code": 200, "data": info}


@app.get("/api/admin/model/classes")
def admin_model_classes(_: None = Depends(_require_admin)):
    """模型类别详情：每类中文名、作物、训练集数量、验证准确率。"""
    import json as _json
    meta_path = MODEL_DATA_DIR.parent / "Weights" / "meta.json"
    history_path = MODEL_DATA_DIR.parent / "Weights" / "history.json"
    labels_path = MODEL_DATA_DIR / "class_labels.json"

    classes = []
    en_to_cn = {}
    if labels_path.exists():
        with labels_path.open("r", encoding="utf-8") as f:
            for item in _json.load(f):
                en_to_cn[item["en"]] = item

    per_class = {}
    if history_path.exists():
        with history_path.open("r", encoding="utf-8") as f:
            history = _json.load(f)
            best = max(history, key=lambda r: r.get("val_acc", 0), default=None)
            if best and "per_class_acc" in best:
                per_class = best["per_class_acc"]

    class_list = []
    if meta_path.exists():
        with meta_path.open("r", encoding="utf-8") as f:
            meta = _json.load(f)
            class_list = meta.get("classes", [])

    for en in class_list:
        info = en_to_cn.get(en, {})
        classes.append({
            "en": en,
            "cn": info.get("cn", en),
            "crop": info.get("crop", ""),
            "disease": info.get("disease", ""),
            "accuracy": round(per_class.get(en, 0) * 100, 1),
        })
    # 按作物分组排序
    classes.sort(key=lambda x: (x["crop"], x["cn"]))
    return {"code": 200, "data": classes}


@app.get("/api/admin/model/devices")
def admin_model_devices(_: None = Depends(_require_admin)):
    """检测可用训练设备。"""
    import platform
    import torch
    cpu_model = platform.processor() or platform.machine() or "CPU"
    devices = [{
        "id": "auto",
        "type": "auto",
        "name": "自动选择",
        "model": "GPU / CPU",
        "index": None,
        "recommended": True,
        "description": "优先使用可用 GPU，没有 GPU 时自动回退到 CPU。",
    }]
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            memory = ""
            try:
                props = torch.cuda.get_device_properties(i)
                memory = f"{props.total_memory / 1024 ** 3:.1f} GB"
            except Exception:
                pass
            devices.append({
                "id": f"cuda:{i}",
                "type": "cuda",
                "name": torch.cuda.get_device_name(i),
                "model": torch.cuda.get_device_name(i),
                "index": i,
                "memory": memory,
                "recommended": i == 0,
                "description": "GPU 加速训练，适合完整训练任务。",
            })
    devices.append({
        "id": "cpu",
        "type": "cpu",
        "name": "CPU",
        "model": cpu_model,
        "index": -1,
        "recommended": not torch.cuda.is_available(),
        "description": "兼容性最好，但完整训练耗时较长。",
    })
    return {"code": 200, "data": devices}


TRAINING_PROCESS = None
TRAINING_STATUS = {"status": "idle", "logs": [], "epoch": 0, "totalEpochs": 20, "loss": 0, "acc": 0, "progress": 0}

@app.post("/api/admin/model/train")
def admin_model_train(_: None = Depends(_require_admin), payload: dict = Body(...)):
    """启动训练（后台子进程）。"""
    import ast
    import subprocess, threading
    global TRAINING_PROCESS
    if TRAINING_STATUS["status"] == "running":
        return JSONResponse(status_code=400, content={"code": 400, "message": "训练已在运行中"})
    epochs = max(1, min(int(payload.get("epochs", 20) or 20), 100))
    batch_size = max(1, min(int(payload.get("batchSize", 16) or 16), 128))
    lr = float(payload.get("lr", 0.0003) or 0.0003)
    device_id = payload.get("device", "auto") or "auto"
    device_arg = "cpu" if device_id == "cpu" else "cuda" if str(device_id).startswith("cuda") else "auto"
    include_contributed = bool(payload.get("includeContributed", True))
    contributed_status = payload.get("contributedStatus", "approved") or "approved"
    env = os.environ.copy()
    if str(device_id).startswith("cuda") and ":" in str(device_id):
        env["CUDA_VISIBLE_DEVICES"] = str(device_id).split(":", 1)[1]
    TRAINING_STATUS.update(
        status="running",
        logs=[],
        epoch=0,
        totalEpochs=epochs,
        progress=0,
        loss=0,
        acc=0,
        includeContributed=include_contributed,
        contributedStatus=contributed_status,
    )
    def update_from_line(line: str):
        if not line.startswith("{") or "epoch" not in line:
            return
        try:
            record = ast.literal_eval(line)
        except Exception:
            return
        if not isinstance(record, dict):
            return
        TRAINING_STATUS["epoch"] = int(record.get("epoch", 0) or 0)
        TRAINING_STATUS["loss"] = float(record.get("val_loss", record.get("train_loss", 0)) or 0)
        TRAINING_STATUS["acc"] = float(record.get("val_acc", record.get("train_acc", 0)) or 0)
        TRAINING_STATUS["progress"] = round(TRAINING_STATUS["epoch"] / max(1, epochs) * 100, 1)

    def run():
        global TRAINING_PROCESS
        try:
            cmd = [
                "python",
                str(MODEL_DATA_DIR.parent / "train.py"),
                "--epochs", str(epochs),
                "--batch-size", str(batch_size),
                "--lr", str(lr),
                "--device", device_arg,
            ]
            if include_contributed:
                cmd.extend(["--include-contributed", "--contributed-status", contributed_status])
            TRAINING_PROCESS = subprocess.Popen(
                cmd,
                cwd=str(MODEL_DATA_DIR.parent),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace", env=env,
            )
            for line in TRAINING_PROCESS.stdout:
                clean = line.strip()
                TRAINING_STATUS["logs"].append(clean)
                update_from_line(clean)
                if len(TRAINING_STATUS["logs"]) > 200:
                    TRAINING_STATUS["logs"] = TRAINING_STATUS["logs"][-200:]
            code = TRAINING_PROCESS.wait()
            if TRAINING_STATUS["status"] == "cancelled":
                TRAINING_STATUS["logs"].append("Training cancelled.")
            elif code == 0:
                TRAINING_STATUS["status"] = "done"
                TRAINING_STATUS["progress"] = 100
            else:
                TRAINING_STATUS["status"] = "error"
                TRAINING_STATUS["logs"].append(f"Training process exited with code {code}.")
        except Exception as e:
            TRAINING_STATUS["status"] = "error"
            TRAINING_STATUS["logs"].append(str(e))
        finally:
            TRAINING_PROCESS = None
    threading.Thread(target=run, daemon=True).start()
    return {"code": 200, "message": "训练已启动"}


@app.get("/api/admin/model/training/status")
def admin_model_training_status(_: None = Depends(_require_admin)):
    """训练进度。"""
    return {"code": 200, "data": TRAINING_STATUS}


@app.post("/api/admin/model/training/cancel")
def admin_model_training_cancel(_: None = Depends(_require_admin)):
    """取消训练。"""
    global TRAINING_PROCESS
    if TRAINING_PROCESS and TRAINING_PROCESS.poll() is None:
        TRAINING_STATUS["status"] = "cancelled"
        TRAINING_PROCESS.terminate()
    else:
        TRAINING_STATUS["status"] = "idle"
    return {"code": 200, "message": "训练已取消"}


# ── 系统配置 API ──────────────────────────────────────
CONFIG_FILE = BACKEND_DIR / "app" / "data" / "config.json"

# 预置服务商：均为 OpenAI 兼容协议（Bearer Token + /chat/completions），
# 百度文心一言、讯飞星火等鉴权方式不同的平台不放进来，选了也调不通。
DEFAULT_LLM_PROVIDERS = [
    {
        "id": "siliconflow", "name": "硅基流动 SiliconFlow",
        "base_url": "https://api.siliconflow.cn/v1", "api_key": "",
        "models": ["Qwen/Qwen3-VL-8B-Instruct", "Qwen/Qwen2.5-VL-72B-Instruct", "deepseek-ai/DeepSeek-V3"],
        "default_model": "Qwen/Qwen3-VL-8B-Instruct",
    },
    {
        "id": "deepseek", "name": "DeepSeek 官方",
        "base_url": "https://api.deepseek.com/v1", "api_key": "",
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "default_model": "deepseek-chat",
    },
    {
        "id": "zhipu", "name": "智谱AI GLM",
        "base_url": "https://open.bigmodel.cn/api/paas/v4", "api_key": "",
        "models": ["glm-4v", "glm-4-plus", "glm-4-flash"],
        "default_model": "glm-4v",
    },
    {
        "id": "moonshot", "name": "月之暗面 Kimi",
        "base_url": "https://api.moonshot.cn/v1", "api_key": "",
        "models": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        "default_model": "moonshot-v1-8k",
    },
    {
        "id": "dashscope", "name": "阿里云百炼（通义千问）",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "api_key": "",
        "models": ["qwen-vl-max", "qwen-plus", "qwen-turbo"],
        "default_model": "qwen-vl-max",
    },
    {
        "id": "volcengine", "name": "火山方舟（豆包）",
        "base_url": "https://ark.cn-beijing.volces.com/api/v3", "api_key": "",
        "models": ["doubao-1-5-vision-pro-32k", "doubao-1-5-pro-32k"],
        "default_model": "doubao-1-5-vision-pro-32k",
    },
    {
        "id": "openai", "name": "OpenAI 官方",
        "base_url": "https://api.openai.com/v1", "api_key": "",
        "models": ["gpt-4o", "gpt-4o-mini"],
        "default_model": "gpt-4o",
    },
    {
        "id": "groq", "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1", "api_key": "",
        "models": ["llama-3.2-90b-vision-preview", "llama-3.3-70b-versatile"],
        "default_model": "llama-3.2-90b-vision-preview",
    },
    {
        "id": "custom", "name": "自定义",
        "base_url": "", "api_key": "",
        "models": [], "default_model": "",
    },
]


def _default_config() -> dict:
    return {
        "llm_providers": [dict(p) for p in DEFAULT_LLM_PROVIDERS],
        "active_provider": "",
        "system": {
            "max_upload_size_mb": 10,
            "max_images_per_contribution": 20,
            "allowed_image_types": ["jpg", "jpeg", "png", "webp"],
        },
    }


def _load_config() -> dict:
    if CONFIG_FILE.exists():
        with CONFIG_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    cfg = _default_config()
    _save_config(cfg)
    return cfg


def _save_config(cfg: dict):
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CONFIG_FILE.open("w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def _mask_key(key: str) -> str:
    if key and len(key) > 8:
        return key[:4] + "****" + key[-4:]
    return ""


@app.get("/api/admin/config/llm")
def admin_config_llm(_: None = Depends(_require_admin)):
    """获取 LLM 服务商列表（不下发明文 Key）+ 当前生效的服务商。"""
    cfg = _load_config()
    providers = [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "base_url": p.get("base_url", ""),
            "default_model": p.get("default_model", ""),
            "models": p.get("models", []),
            "has_key": bool(p.get("api_key")),
            "api_key_hint": _mask_key(p.get("api_key", "")),
        }
        for p in cfg.get("llm_providers", [])
    ]
    return {"code": 200, "data": {"providers": providers, "active_provider": cfg.get("active_provider", "")}}


@app.put("/api/admin/config/llm/{provider_id}")
def admin_config_llm_update(provider_id: str, _: None = Depends(_require_admin), payload: dict = Body(...)):
    """更新某个服务商的 API Key / 模型 / 接口地址。空字符串的 api_key 视为“不修改”，避免误清空已保存的 Key。"""
    cfg = _load_config()
    for p in cfg.get("llm_providers", []):
        if p.get("id") == provider_id:
            if payload.get("api_key"):
                p["api_key"] = payload["api_key"].strip()
            if "default_model" in payload:
                p["default_model"] = (payload["default_model"] or "").strip()
            if provider_id == "custom" and "base_url" in payload:
                p["base_url"] = (payload["base_url"] or "").strip()
            _save_config(cfg)
            return {"code": 200, "message": "已保存"}
    return JSONResponse(status_code=404, content={"code": 404, "message": "未找到该服务商"})


@app.put("/api/admin/config/active/{provider_id}")
def admin_config_set_active(provider_id: str, _: None = Depends(_require_admin)):
    """把某个服务商设为当前生效的 AI 对话/诊断建议模型。"""
    cfg = _load_config()
    provider = next((p for p in cfg.get("llm_providers", []) if p.get("id") == provider_id), None)
    if not provider:
        return JSONResponse(status_code=404, content={"code": 404, "message": "未找到该服务商"})
    if not provider.get("api_key") or not provider.get("base_url") or not provider.get("default_model"):
        return JSONResponse(status_code=400, content={"code": 400, "message": "请先填写 API Key、接口地址和模型"})
    cfg["active_provider"] = provider_id
    _save_config(cfg)
    return {"code": 200, "message": f"已启用「{provider.get('name')}」"}


@app.post("/api/admin/config/llm/test")
def admin_config_llm_test(_: None = Depends(_require_admin), payload: dict = Body(...)):
    """测试 LLM 连接：优先用请求里传的未保存值，没传则用已保存的值。

    真正发起一次最小化的 chat/completions 调用（而不是只探测 /models），
    这样填错的模型名（服务商下根本不存在）也能在这里被测出来，
    而不是要等到用户在诊断/对话页面真正使用时才报错。
    """
    import requests as req
    provider_id = payload.get("provider_id", "")
    cfg = _load_config()
    provider = next((p for p in cfg.get("llm_providers", []) if p.get("id") == provider_id), None)
    if not provider:
        return JSONResponse(status_code=404, content={"code": 404, "message": "未找到该服务商"})
    api_key = (payload.get("api_key") or provider.get("api_key") or "").strip()
    base_url = (payload.get("base_url") or provider.get("base_url") or "").strip().rstrip("/")
    model = (payload.get("model") or provider.get("default_model") or "").strip()
    if not api_key or not base_url:
        return JSONResponse(status_code=400, content={"code": 400, "message": "请先填写 API Key 和接口地址"})
    if not model:
        return JSONResponse(status_code=400, content={"code": 400, "message": "请先填写模型名称"})

    chat_url = base_url if base_url.endswith("/chat/completions") else base_url + "/chat/completions"
    try:
        resp = req.post(
            chat_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1,
            },
            timeout=15,
        )
    except Exception as e:
        return {"code": 200, "data": {"ok": False, "error": str(e)}}

    if resp.status_code == 200:
        return {"code": 200, "data": {"ok": True, "status": 200, "model": model}}

    # 尽量把服务商返回的具体错误信息（如"模型不存在"）透出给管理员，而不是只给状态码
    try:
        err_body = resp.json()
        err_msg = (err_body.get("error") or {}).get("message") or err_body.get("message") or resp.text[:200]
    except Exception:
        err_msg = resp.text[:200]
    return {"code": 200, "data": {"ok": False, "status": resp.status_code, "error": err_msg}}


@app.get("/api/admin/config/system")
def admin_config_system(_: None = Depends(_require_admin)):
    """获取系统参数。"""
    cfg = _load_config()
    sys_cfg = cfg.get("system", {})
    return {
        "code": 200,
        "data": {
            "maxUploadMB": sys_cfg.get("max_upload_size_mb", 10),
            "maxImages": sys_cfg.get("max_images_per_contribution", 20),
            "allowedTypes": ",".join(sys_cfg.get("allowed_image_types", ["jpg", "jpeg", "png", "webp"])),
        },
    }


@app.put("/api/admin/config/system")
def admin_config_system_update(_: None = Depends(_require_admin), payload: dict = Body(...)):
    """更新系统参数。"""
    cfg = _load_config()
    cfg["system"] = {
        "max_upload_size_mb": payload.get("maxUploadMB", 10),
        "max_images_per_contribution": payload.get("maxImages", 20),
        "allowed_image_types": payload.get("allowedTypes", "jpg,jpeg,png,webp").split(","),
    }
    _save_config(cfg)
    return {"code": 200, "message": "已保存"}


# Encyclopedia management
ENCYCLOPEDIA_IMAGE_DIR = MODEL_DATA_DIR / "encyclopedia_images"
MAX_ENCYCLOPEDIA_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_ENCYCLOPEDIA_MIMES = {"image/jpeg", "image/png", "image/webp"}


def _encyclopedia_error(exc: Exception):
    if isinstance(exc, encyclopedia.EncyclopediaNotFoundError):
        return JSONResponse(status_code=404, content={"code": 404, "message": "Image is empty"})
    return JSONResponse(status_code=409, content={"code": 409, "message": str(exc)})


def _delete_managed_encyclopedia_image(image_url: str | None) -> None:
    if not image_url or not image_url.startswith(encyclopedia.MANAGED_IMAGE_URL_PREFIX):
        return
    filename = Path(image_url).name
    if filename and filename == image_url.removeprefix(encyclopedia.MANAGED_IMAGE_URL_PREFIX):
        (ENCYCLOPEDIA_IMAGE_DIR / filename).unlink(missing_ok=True)


@app.get("/api/admin/encyclopedia")
def admin_encyclopedia_list(q: str = "", crop: str = "", category: str = "", risk: str = "", page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), _: None = Depends(_require_admin)):
    entries = encyclopedia.list_diseases(crop=crop, category=category, keyword=q, risk=risk)
    start = (page - 1) * page_size
    return {"code": 200, "data": {"items": entries[start:start + page_size], "total": len(entries), "page": page, "page_size": page_size}}


@app.get("/api/admin/encyclopedia/{disease_id}")
def admin_encyclopedia_detail(disease_id: str, _: None = Depends(_require_admin)):
    detail = encyclopedia.get_detail(disease_id)
    if detail is None:
        return JSONResponse(status_code=404, content={"code": 404, "message": "Image is empty"})
    return {"code": 200, "data": detail}


@app.post("/api/admin/encyclopedia")
def admin_encyclopedia_create(payload: EncyclopediaEntryRequest, _: None = Depends(_require_admin)):
    try:
        return {"code": 200, "data": encyclopedia.create_entry(payload.to_entry())}
    except encyclopedia.EncyclopediaConflictError as exc:
        return _encyclopedia_error(exc)


@app.put("/api/admin/encyclopedia/{disease_id}")
def admin_encyclopedia_update(disease_id: str, payload: EncyclopediaEntryRequest, _: None = Depends(_require_admin)):
    try:
        return {"code": 200, "data": encyclopedia.update_entry(disease_id, payload.to_entry())}
    except (encyclopedia.EncyclopediaConflictError, encyclopedia.EncyclopediaNotFoundError) as exc:
        return _encyclopedia_error(exc)


@app.post("/api/admin/encyclopedia/{disease_id}/image")
async def admin_encyclopedia_image(disease_id: str, file: UploadFile = File(...), _: None = Depends(_require_admin)):
    existing = encyclopedia.get_detail(disease_id)
    if existing is None:
        return JSONResponse(status_code=404, content={"code": 404, "message": "Image is empty"})
    if file.content_type not in ALLOWED_ENCYCLOPEDIA_MIMES:
        return JSONResponse(status_code=400, content={"code": 400, "message": "Only JPG, PNG, and WebP images are supported"})
    contents = await file.read(MAX_ENCYCLOPEDIA_IMAGE_BYTES + 1)
    if len(contents) > MAX_ENCYCLOPEDIA_IMAGE_BYTES:
        return JSONResponse(status_code=413, content={"code": 413, "message": "Image must not exceed 5MB"})
    if not contents:
        return JSONResponse(status_code=400, content={"code": 400, "message": "Image is empty"})
    try:
        with Image.open(io.BytesIO(contents)) as probe:
            probe.verify()
        with Image.open(io.BytesIO(contents)) as decoded:
            if decoded.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("unsupported image format")
            if decoded.width * decoded.height > 40_000_000:
                raise ValueError("image dimensions are too large")
            decoded.load()
            image = decoded.convert("RGB")
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            ENCYCLOPEDIA_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
            image_path = ENCYCLOPEDIA_IMAGE_DIR / f"{disease_id}.jpg"
            temp_path = ENCYCLOPEDIA_IMAGE_DIR / f".{disease_id}.{uuid.uuid4().hex}.tmp"
            try:
                image.save(temp_path, "JPEG", quality=88, optimize=True)
                os.replace(temp_path, image_path)
            finally:
                temp_path.unlink(missing_ok=True)
    except (OSError, ValueError, Image.DecompressionBombError):
        return JSONResponse(status_code=400, content={"code": 400, "message": "Malformed image or mismatched format"})
    url = f"{encyclopedia.MANAGED_IMAGE_URL_PREFIX}{disease_id}.jpg"
    try:
        updated = encyclopedia.set_image_url(disease_id, url)
    except encyclopedia.EncyclopediaNotFoundError as exc:
        image_path.unlink(missing_ok=True)
        return _encyclopedia_error(exc)
    old_url = existing.get("image_url") if existing.get("image_source") == "uploaded" else None
    if old_url != url:
        _delete_managed_encyclopedia_image(old_url)
    return {"code": 200, "data": {"image_url": url, "image_source": updated["image_source"]}}


@app.delete("/api/admin/encyclopedia/{disease_id}")
def admin_encyclopedia_delete(disease_id: str, _: None = Depends(_require_admin)):
    try:
        removed = encyclopedia.delete_entry(disease_id)
    except encyclopedia.EncyclopediaNotFoundError as exc:
        return _encyclopedia_error(exc)
    _delete_managed_encyclopedia_image(removed.get("image_url"))
    return {"code": 200, "data": {"id": disease_id}, "message": "Deleted"}


@app.post("/api/admin/encyclopedia/import")
@app.post("/api/admin/encyclopedia/batch-import")
def admin_encyclopedia_import(payload: EncyclopediaBatchImportRequest, _: None = Depends(_require_admin)):
    validated, errors = [], []
    for index, raw in enumerate(payload.entries):
        try:
            validated.append(EncyclopediaEntryRequest.model_validate(raw).to_entry())
        except ValidationError as exc:
            errors.append({"index": index, "errors": exc.errors(include_url=False)})
    if errors:
        result = {"created": 0, "updated": 0, "skipped": 0, "errors": errors, "dry_run": payload.dry_run}
    else:
        result = encyclopedia.batch_import(validated, dry_run=payload.dry_run, mode=payload.mode)
    return {"code": 200, "data": result}


# ── 用户管理 API ──────────────────────────────────────
@app.get("/api/admin/users")
def admin_users(_: None = Depends(_require_admin), q: str = ""):
    """管理员获取用户列表。"""
    users_file = BACKEND_DIR / "app" / "data" / "users.json"
    if not users_file.exists():
        return {"code": 200, "data": []}
    import json as _json
    with users_file.open("r", encoding="utf-8") as f:
        users = _json.load(f)
    if q:
        users = [u for u in users if q.lower() in u.get("username", "").lower() or q.lower() in u.get("display_name", "").lower()]
    return {"code": 200, "data": users}


@app.put("/api/admin/users/{user_id}")
def admin_users_update(user_id: str, _: None = Depends(_require_admin), payload: dict = Body(...)):
    """管理员修改用户信息。"""
    users_file = BACKEND_DIR / "app" / "data" / "users.json"
    if not users_file.exists():
        return JSONResponse(status_code=404, content={"code": 404, "message": "用户文件不存在"})
    import json as _json
    with users_file.open("r", encoding="utf-8") as f:
        users = _json.load(f)
    for u in users:
        if u.get("id") == user_id:
            u.update(payload)
            with users_file.open("w", encoding="utf-8") as f:
                _json.dump(users, f, ensure_ascii=False, indent=2)
            return {"code": 200, "data": u}
    return JSONResponse(status_code=404, content={"code": 404, "message": "未找到该用户"})


# ── 系统日志 API ──────────────────────────────────────
@app.get("/api/admin/logs")
def admin_logs(level: str = "", keyword: str = "", limit: int = 200, _: None = Depends(_require_admin)):
    """查看系统日志。"""
    log_files = sorted(LOGS_DIR.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not log_files and not HISTORY_FILE.exists():
        return {"code": 200, "data": []}
    lines = []
    for lf in log_files[:3]:
        try:
            with lf.open("r", encoding="utf-8", errors="replace") as f:
                lines.extend(f.readlines())
        except Exception:
            continue
    if not lines:
        return {"code": 200, "data": []}
    if level:
        lines = [l for l in lines if level.upper() in l.upper()]
    if keyword:
        lines = [l for l in lines if keyword.lower() in l.lower()]
    lines = lines[-limit:]
    return {"code": 200, "data": [{"line": l.rstrip()} for l in lines]}


# ── AI 对话（Agent 模块，SSE 真流式）──────────────────
# 会话状态仅保存在内存中：进程重启即清空，符合课程设计演示场景，
# 不与 /api/history 的持久化诊断记录混淆。
CHAT_SESSIONS: dict[str, dict] = {}


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@app.post("/api/chat/start")
def chat_start(payload: dict = Body(...)):
    """基于一次诊断结果创建 AI 对话会话（仅建会话，不调用大模型，供 /api/chat/stream 使用）。"""
    image_url = payload.get("image_url", "")
    diagnosis_id = payload.get("id")
    top1 = payload.get("top1") or {}
    crop = top1.get("crop", "")
    disease = top1.get("disease") or top1.get("label_cn", "")
    confidence = top1.get("confidence", 0)

    if not image_url or not disease:
        return JSONResponse(status_code=400, content={"code": 400, "message": "缺少诊断结果信息"})

    img_path = UPLOADS_DIR / Path(image_url).name
    if not img_path.is_file():
        return JSONResponse(status_code=400, content={"code": 400, "message": "找不到对应的诊断图片"})

    session_id = uuid.uuid4().hex[:16]
    CHAT_SESSIONS[session_id] = {
        "history": [],
        "context_note": "",
        "diagnosis": {
            "id": diagnosis_id,
            "crop": crop,
            "disease": disease,
            "confidence": confidence,
            "image_path": str(img_path),
        },
        "created": time.time(),
    }
    return {"code": 200, "data": {"session_id": session_id}}


@app.get("/api/chat/stream/{sid}")
def chat_stream(sid: str, text: str = ""):
    """SSE 流式对话：不带 text = 首轮诊断开场白 + 结构化建议；带 text = 多轮追问。"""
    session = CHAT_SESSIONS.setdefault(
        sid, {"history": [], "context_note": "", "diagnosis": None, "created": time.time()}
    )

    def gen():
        if not agent_service.is_ready():
            yield _sse({"type": "error", "message": "AI 服务尚未配置（缺少 Agent API Key）"})
            return

        try:
            if text.strip():
                session["history"].append({"role": "user", "content": text.strip()})
                full = ""
                for delta in agent_service.stream_chat(session["context_note"], session["history"]):
                    full += delta
                    yield _sse({"type": "delta", "text": delta})
                session["history"].append({"role": "assistant", "content": full})
                max_msgs = 2 * agent_service.MAX_HISTORY_TURNS
                if len(session["history"]) > max_msgs:
                    session["history"] = session["history"][-max_msgs:]
                yield _sse({"type": "done", "content": full, "advice": None})
            else:
                d = session.get("diagnosis")
                if not d:
                    yield _sse({"type": "error", "message": "会话缺少诊断上下文"})
                    return
                image_bytes = Path(d["image_path"]).read_bytes()
                full = ""
                for delta in agent_service.stream_intro(
                    image_bytes, d["crop"], d["disease"], d["confidence"]
                ):
                    full += delta
                    yield _sse({"type": "delta", "text": delta})
                result = agent_service.diagnose_advice(
                    image_bytes, d["crop"], d["disease"], d["confidence"]
                )
                advice, review = result["advice"], result["review"]
                session["history"].append({"role": "assistant", "content": full})
                session["context_note"] = agent_service.build_context_note(
                    d["crop"], d["disease"], d["confidence"], advice
                )
                save_advice_to_history(d.get("id"), advice, review)
                yield _sse({"type": "done", "content": full, "advice": advice, "review": review})
        except agent_service.AgentError as e:
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


# ── 前端页面 ────────────────────────────────────────
@app.get("/")
def index():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "前端页面未找到，请访问 /docs 查看 API 文档"}
