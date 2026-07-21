# Agent 模块

## 功能说明

本模块调用大模型 API（OpenAI 兼容 chat/completions 协议，默认对接**硅基流动 SiliconFlow**），
根据图像分类模型的识别结果生成病虫害防治建议。**不做分类判断**——"这是什么病"完全由
`2.Model` 的 ConvNeXt-Tiny 分类模型决定，Agent 只负责在此基础上做解释和给建议。

## 工作流程

分两次调用，避免结构化 JSON 被逐字流式输出显得很奇怪：

```
图片 + 分类结果 ──→ ① 流式生成开场白（自然语言，供前端逐字渲染）
                ──→ ② 非流式生成结构化建议 JSON（症状/成因/防治/风险，整卡片展示）
```

多轮追问时不再重复发送图片，改用一段文字摘要（`build_context_note`）携带诊断上下文。

## 文件说明

| 文件 | 说明 |
|------|------|
| `config.py` | 从 `.env` 读取 `LLM_API_KEY` / `LLM_MODEL` / `LLM_BASE_URL`，置信度阈值等 |
| `prompt.py` | Prompt 模板：开场白（自然语言）+ 诊断建议（JSON）+ 多轮对话 |
| `agent.py` | `LLMAgent` 封装：`diagnose()` / `stream_intro()` / `chat()` / `stream_chat()` |

## 输入

| 字段 | 来源 | 说明 |
|------|------|------|
| `crop` | 模型分类结果 | 作物名称（中文），如"番茄" |
| `disease` | 模型分类结果 | 病害名称（中文），如"早疫病" |
| `confidence` | 模型分类结果 | 识别置信度 |
| `image` | 用户上传 | 叶片图片（多模态，随开场白 / 结构化建议一起发送） |

## 输出（结构化建议 JSON）

```json
{
  "disease_name": "番茄早疫病",
  "symptoms": "叶片出现褐色圆形病斑，有同心轮纹，严重时叶片枯死。",
  "cause": "由茄链格孢菌引起，高温高湿环境下易发生。",
  "prevention": ["选择抗病品种", "合理轮作，避免连作", "加强通风透光"],
  "treatment": ["发病初期喷洒百菌清可湿性粉剂", "及时清除病叶病株并深埋", "注意药剂交替使用，避免抗药性"],
  "risk_level": "中",
  "manual_check_required": false
}
```

置信度低于阈值（默认 80%，见 `config.CONFIDENCE_THRESHOLD`）时，`manual_check_required`
强制为 `true`，提示前端"结果仅供参考、建议人工复核"。

## 换供应商

`agent.py` 完全按 OpenAI 兼容协议实现，不含任何供应商专有逻辑。换供应商（如切回火山方舟豆包、
DeepSeek 官方等）只需改 `4.Agent/.env` 里的 `LLM_BASE_URL` 和 `LLM_MODEL`，代码不用动——
但要注意换用的模型必须支持图片输入（多模态），否则 `diagnose()` / `stream_intro()` 会报错。

## 与 WebApp 集成

实际接入的是 `3.Web/Backend/app/services/agent_service.py`（桥接层）+
`3.Web/Backend/app/main.py` 里的两个接口：

- `POST /api/chat/start`：传诊断结果（`image_url` + `top1`），建会话，返回 `session_id`
- `GET /api/chat/stream/{sid}`：SSE 流式接口。不带 `text` 参数 = 首轮开场白 + 结构化建议；
  带 `?text=...` = 多轮追问

前端 `3.Web/Frontend/js/pages/page-chat.js` 通过 `EventSource` 消费这条流，逐字渲染。
