"""AI 对话服务：桥接 4.Agent 模块，供 main.py 的 /api/chat/* 接口调用。"""

import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[4] / "4.Agent"
sys.path.insert(0, str(AGENT_DIR))

import config as agent_config  # noqa: E402
from agent import AgentError, LLMAgent  # noqa: E402
from prompt import build_context_note  # noqa: E402

__all__ = [
    "AgentError",
    "is_ready",
    "diagnose_advice",
    "stream_intro",
    "stream_chat",
    "build_context_note",
    "MAX_HISTORY_TURNS",
]

MAX_HISTORY_TURNS = agent_config.MAX_HISTORY_TURNS

def is_ready() -> bool:
    return agent_config.is_configured()


def _get_agent() -> LLMAgent:
    # 不做单例缓存：管理员在后台切换服务商/Key 后应立即生效，
    # 而 LLMAgent() 本身很轻（无网络调用），每次重建成本可以忽略。
    return LLMAgent()


def diagnose_advice(image_bytes: bytes, crop: str, disease: str, confidence: float) -> dict:
    """非流式：返回 { advice: dict|None, review: dict|None }，供 stream 端点在开场白播完后调用。"""
    result = _get_agent().diagnose(image_bytes, crop, disease, confidence)
    return {"advice": result["advice"], "review": result["review"]}


def stream_intro(image_bytes: bytes, crop: str, disease: str, confidence: float):
    yield from _get_agent().stream_intro(image_bytes, crop, disease, confidence)


def stream_chat(context_note: str, history: list[dict]):
    yield from _get_agent().stream_chat(context_note, history)
