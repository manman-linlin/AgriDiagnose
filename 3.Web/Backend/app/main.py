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

from fastapi import Body, FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

from app.services import agent_service
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
