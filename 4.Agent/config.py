"""Agent 模块配置：从环境变量 / .env 读取大模型 API 配置。

客户端按 OpenAI 兼容协议实现（chat/completions + stream），默认对接硅基流动
（SiliconFlow），如需换成其他兼容供应商（火山方舟/DeepSeek 官方等），改
LLM_BASE_URL / LLM_MODEL 即可，agent.py 不需要改动。
"""

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

# 供应商 API Key
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


def is_configured() -> bool:
    """API Key 与模型是否均已配置。"""
    return bool(LLM_API_KEY and LLM_MODEL)
