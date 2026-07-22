"""Agent 模块配置：从环境变量 / .env 读取大模型 API 配置。

客户端按 OpenAI 兼容协议实现（chat/completions + stream），默认对接硅基流动
（SiliconFlow），如需换成其他兼容供应商（火山方舟/DeepSeek 官方等），改
LLM_BASE_URL / LLM_MODEL 即可，agent.py 不需要改动。
"""

import json
import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

# 供应商 API Key（.env 兜底值：管理后台未配置任何服务商时使用）
LLM_API_KEY = os.getenv("LLM_API_KEY", "")

# 模型名（需选支持图片输入的视觉模型，如硅基流动的 Qwen3-VL 系列）
LLM_MODEL = os.getenv("LLM_MODEL", "Qwen/Qwen3-VL-8B-Instruct")

LLM_BASE_URL = os.getenv(
    "LLM_BASE_URL", "https://api.siliconflow.cn/v1/chat/completions"
)

# 低于该置信度（百分比）时，要求 Agent 提示"仅供参考 / 建议人工复核"
CONFIDENCE_THRESHOLD = float(os.getenv("AGENT_CONFIDENCE_THRESHOLD", "80"))

REQUEST_TIMEOUT = float(os.getenv("AGENT_REQUEST_TIMEOUT", "30"))

# 单次对话保留的历史轮数上限（防止 token 无限增长）
MAX_HISTORY_TURNS = int(os.getenv("AGENT_MAX_HISTORY_TURNS", "10"))

# 管理后台「系统配置」页面写入的多平台 API-Key 配置文件
_ADMIN_CONFIG_FILE = (
    Path(__file__).resolve().parent.parent / "3.Web" / "Backend" / "app" / "data" / "config.json"
)


def _load_active_admin_provider() -> dict | None:
    """读取管理后台当前生效的服务商配置；文件不存在/未设置/信息不全都返回 None。"""
    try:
        if not _ADMIN_CONFIG_FILE.exists():
            return None
        with _ADMIN_CONFIG_FILE.open("r", encoding="utf-8") as f:
            cfg = json.load(f)
        active_id = cfg.get("active_provider")
        if not active_id:
            return None
        for p in cfg.get("llm_providers", []):
            if p.get("id") == active_id and p.get("api_key") and p.get("base_url") and p.get("default_model"):
                return p
    except Exception:
        return None
    return None


def get_llm_settings() -> tuple[str, str, str]:
    """返回 (api_key, model, base_url)。

    优先使用管理后台「系统配置」页面里设置的当前生效服务商；
    后台没配置时，回退到 .env 里的 LLM_API_KEY / LLM_MODEL / LLM_BASE_URL，
    保证 4.Agent 独立于 Web 后台运行时（如单独调试）行为不变。
    """
    provider = _load_active_admin_provider()
    if provider:
        base_url = provider["base_url"].rstrip("/")
        if not base_url.endswith("/chat/completions"):
            base_url += "/chat/completions"
        return provider["api_key"], provider["default_model"], base_url
    return LLM_API_KEY, LLM_MODEL, LLM_BASE_URL


def is_configured() -> bool:
    """API Key 与模型是否均已配置（后台配置优先，.env 兜底）。"""
    api_key, model, _ = get_llm_settings()
    return bool(api_key and model)
