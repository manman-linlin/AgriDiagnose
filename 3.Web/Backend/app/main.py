"""
病虫害诊断 WebAPI —— FastAPI 应用入口。
启动: python run.py  或  uvicorn app.main:app --reload
"""

import io
import json
import time
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

from app.services.classifier import classifier

app = FastAPI(title="农作物病虫害诊断系统", version="1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 路径 ────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "Frontend"
UPLOADS_DIR = BACKEND_DIR / "uploads"
LOGS_DIR = BACKEND_DIR / "logs"
HISTORY_FILE = LOGS_DIR / "history.json"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# 静态文件挂载
if FRONTEND_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


# ── 历史记录读写 ────────────────────────────────────
def load_history() -> list:
    if not HISTORY_FILE.exists():
        return []
    with HISTORY_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_history(records: list):
    with HISTORY_FILE.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


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


# ── 前端页面 ────────────────────────────────────────
@app.get("/")
def index():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "前端页面未找到，请访问 /docs 查看 API 文档"}
