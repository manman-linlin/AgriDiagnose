"""大模型调用封装（OpenAI 兼容 chat/completions 协议，默认对接硅基流动）。

对外只暴露两个方法：
- diagnose(): 首轮多模态诊断（图片 + 分类结果 -> 结构化防治建议 JSON）
- chat():     后续多轮对话（纯文本，携带诊断上下文摘要）
"""

import base64
import json
import re

import requests

import config
import prompt as prompt_mod


class AgentError(Exception):
    """Agent 调用失败（网络异常、鉴权失败、接口报错等），与"输出格式不规范"区分开。"""


def _extract_json(text: str) -> dict | None:
    """从大模型返回文本中尽力提取 JSON 对象，容忍 Markdown 代码块等噪音。"""
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text.strip(), flags=re.IGNORECASE).strip()
    text = re.sub(r"```$", "", text.strip()).strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except (json.JSONDecodeError, ValueError):
            return None
    return None


class LLMAgent:
    def __init__(self):
        if not config.is_configured():
            raise AgentError(
                "Agent 未配置：请在 4.Agent/.env 中设置 LLM_API_KEY 和 LLM_MODEL"
            )
        self._headers = {
            "Authorization": f"Bearer {config.LLM_API_KEY}",
            "Content-Type": "application/json",
        }

    def _call(self, messages: list[dict]) -> str:
        payload = {
            "model": config.LLM_MODEL,
            "messages": messages,
            "temperature": 0.3,
        }
        try:
            resp = requests.post(
                config.LLM_BASE_URL,
                headers=self._headers,
                json=payload,
                timeout=config.REQUEST_TIMEOUT,
            )
        except requests.RequestException as e:
            raise AgentError(f"请求大模型 API 失败: {e}") from e

        if resp.status_code != 200:
            raise AgentError(f"大模型 API 返回错误 {resp.status_code}: {resp.text[:300]}")

        resp.encoding = "utf-8"
        try:
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, ValueError) as e:
            raise AgentError(f"大模型 API 返回格式异常: {e}") from e

    def _call_stream(self, messages: list[dict]):
        """流式调用，逐段 yield 文本增量。"""
        payload = {
            "model": config.LLM_MODEL,
            "messages": messages,
            "temperature": 0.3,
            "stream": True,
        }
        try:
            resp = requests.post(
                config.LLM_BASE_URL,
                headers=self._headers,
                json=payload,
                timeout=config.REQUEST_TIMEOUT,
                stream=True,
            )
        except requests.RequestException as e:
            raise AgentError(f"请求大模型 API 失败: {e}") from e

        if resp.status_code != 200:
            raise AgentError(f"大模型 API 返回错误 {resp.status_code}: {resp.text[:300]}")

        # requests 对 text/event-stream 响应常猜错字符集（回退 ISO-8859-1），
        # 不强制 utf-8 会导致中文乱码甚至 JSON 解析失败。
        resp.encoding = "utf-8"

        for raw_line in resp.iter_lines(decode_unicode=True):
            if not raw_line or not raw_line.startswith("data:"):
                continue
            data_str = raw_line[len("data:") :].strip()
            if data_str == "[DONE]":
                break
            try:
                chunk = json.loads(data_str)
            except (json.JSONDecodeError, ValueError):
                continue
            choices = chunk.get("choices") or []
            if not choices:
                continue
            text = (choices[0].get("delta") or {}).get("content")
            if text:
                yield text

    def stream_intro(self, image_bytes: bytes, crop: str, disease: str, confidence: float):
        """流式开场白（多模态，供前端逐字渲染）。"""
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        user_prompt = prompt_mod.build_intro_prompt(crop, disease, confidence)
        messages = [
            {"role": "system", "content": prompt_mod.INTRO_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                ],
            },
        ]
        yield from self._call_stream(messages)

    def stream_chat(self, context_note: str, history: list[dict]):
        """多轮追问的流式回复。"""
        messages = [
            {"role": "system", "content": prompt_mod.CHAT_SYSTEM_PROMPT + context_note},
            *history,
        ]
        yield from self._call_stream(messages)

    def diagnose(self, image_bytes: bytes, crop: str, disease: str, confidence: float) -> dict:
        """多模态诊断：返回 { content: str, advice: dict|None }。"""
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        user_prompt = prompt_mod.build_diagnosis_prompt(crop, disease, confidence)

        messages = [
            {"role": "system", "content": prompt_mod.DIAGNOSIS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                ],
            },
        ]

        raw = self._call(messages)
        parsed = _extract_json(raw)

        review = None
        advice = None
        if isinstance(parsed, dict):
            if isinstance(parsed.get("advice"), dict):
                advice = parsed["advice"]
                review = parsed.get("review") if isinstance(parsed.get("review"), dict) else None
            elif "disease_name" in parsed:
                # 兼容模型未按 {review, advice} 嵌套结构返回，把整个对象当作 advice
                advice = parsed

        if advice:
            content = (
                f"我已结合叶片图片和识别结果进行分析：这是 **{advice.get('disease_name', disease)}**。"
                "以下是详细的防治方案："
            )
            return {"content": content, "advice": advice, "review": review}

        # 大模型未按 JSON 格式返回时，降级为纯文本展示，不中断对话
        return {"content": raw.strip() or "抱歉，暂时无法生成结构化建议。", "advice": None, "review": None}

    def chat(self, context_note: str, history: list[dict]) -> str:
        """多轮对话：history 为 [{role, content}, ...]，返回助手回复文本。"""
        messages = [
            {"role": "system", "content": prompt_mod.CHAT_SYSTEM_PROMPT + context_note},
            *history,
        ]
        return self._call(messages).strip()
