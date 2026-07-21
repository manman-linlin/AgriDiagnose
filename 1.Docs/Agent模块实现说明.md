# Agent 模块实现说明 —— 与设计文档的差异

> 本文档记录 `4.Agent/` 及配套的 `/api/chat/*` 接口在**实际实现**中，与
> [详细设计文档.md](./详细设计文档.md) §4.4/§6/§8、
> [模块扩展设计文档.md](./模块扩展设计文档.md) §2/§6/§7/§8
> 之间的出入，供其他模块对接时参考，避免直接照抄文档描述导致接口对不上。
>
> 结论：**核心设计思路（输入/输出/置信度策略/纠错机制）与文档一致**，
> 差异主要集中在**接口字面契约、依赖库选择、代码文件组织**这几处工程实现细节。

---

## 1. 与《详细设计文档.md》的差异

基本一致，只有一处增强：

- 文档 §4.4 输入项里"图片简要描述"，实际实现直接把原图（多模态）发给大模型，
  而不是简化成一段文字描述——效果更好，不算冲突。

---

## 2. 与《模块扩展设计文档.md》§2 Agent 模块的差异

### 2.1 大模型供应商

| 项 | 文档要求 | 实际实现 |
|---|---|---|
| 供应商 | 豆包（Doubao），火山方舟 Ark | **硅基流动（SiliconFlow）** |
| Endpoint | `https://ark.cn-beijing.volces.com/api/v3/chat/completions` | `https://api.siliconflow.cn/v1/chat/completions` |
| 模型名 | `doubao-pro-32k` | `Qwen/Qwen3-VL-8B-Instruct`（支持图片输入的视觉模型） |
| API Key 环境变量 | `DOUBAO_API_KEY` | `LLM_API_KEY` |

**原因**：手头只有硅基流动的 API Key。`4.Agent/agent.py` 按 OpenAI 兼容协议
（`chat/completions` + `stream`）实现，不含任何供应商专有逻辑，换回豆包或其他
兼容供应商只需要改 `4.Agent/.env` 里的 `LLM_BASE_URL` / `LLM_MODEL`，**代码不用动**。

### 2.2 `POST /api/chat/start`

| 项 | 文档要求 | 实际实现 |
|---|---|---|
| 请求体 | `multipart/form-data`：`file`（图片二进制）+ 可选 `session_id` | JSON：`{ id, image_url, top1 }` |
| 内部行为 | 接口内部调用 `classifier.predict()` 做分类 | **不调用分类器**，假设 `/api/predict` 已经先调过 |
| 响应体 | `{ session_id, classification: { top1, top3 } }` | `{ session_id }`（分类结果已经在 `/api/predict` 响应里拿到过了） |

**原因**：诊断页流程本来就先调 `/api/predict` 拿到分类结果；AI 对话页的
"从聊天里直接传图"流程也是前端先调 `/api/predict` 再调 `/api/chat/start`
（见 [page-chat.js](../3.Web/Frontend/js/pages/page-chat.js) 的 `sendImageMessage()`）。
这样避免同一张图片被重复处理，`/api/chat/start` 只负责"基于已有诊断结果建会话"。

### 2.3 `GET /api/chat/stream/{session_id}`

请求方式（GET + 路径带 `sid`、追问用 `?text=` 查询参数）与文档一致，但 **SSE 消息体格式不同**：

| 项 | 文档要求 | 实际实现 |
|---|---|---|
| 增量消息 | `data: {"token": "字"}` | `data: {"type": "delta", "text": "字"}` |
| 结束标记 | `data: [DONE]`（裸字符串） | `data: {"type": "done", "content": "...", "advice": {...}, "review": {...}}`（结构化对象，带完整内容） |

**原因**：结构化 `done` 事件能一次性把拼好的完整文本、结构化防治建议（`advice`）、
多模态纠错结果（`review`）一起交给前端，前端不用自己拼接/二次解析。

### 2.4 会话状态存放位置

| 项 | 文档要求 | 实际实现 |
|---|---|---|
| 会话数据结构 | `4.Agent/agent.py` 内的 `ConversationSession` 数据类 | 无此数据类 |
| 会话管理 | `DoubaoAgent` 类自带 `_sessions` 字典 + `create_session()`/`get_session()`/`delete_session()` | `3.Web/Backend/app/main.py` 里的模块级字典 `CHAT_SESSIONS` |
| Agent 类本身 | 有状态（持有会话） | **无状态**，`LLMAgent` 只负责单次 API 调用（含流式），不管理会话生命周期 |

**原因**：让 `4.Agent/` 保持纯粹的"大模型调用库"，不耦合 Web 层的会话生命周期管理，
更方便独立测试和复用。会话本质是 Web 请求层面的概念，放在 `main.py` 更合适。

### 2.5 依赖库

| 项 | 文档要求 | 实际实现 |
|---|---|---|
| HTTP 客户端 | `httpx`（异步 `AsyncClient`） | `requests`（同步） |
| SSE 响应封装 | `sse-starlette` | FastAPI 自带 `StreamingResponse` + 手写 `data: {...}\n\n` 格式化 |

**原因**：项目规模小，FastAPI 对同步 `def` 路由函数会自动放线程池执行，不会阻塞
事件循环，没必要为此引入异步改造和额外依赖。

### 2.6 `parse_ai_response()` 函数位置

文档要求 `prompt.py` 里有独立的 `parse_ai_response(full_text)` 函数负责解析大模型
返回的 JSON。实际把这部分逻辑（`_extract_json()`）放在了 `agent.py` 里，`prompt.py`
只负责 Prompt 模板文本构建。行为等价，只是文件归属不同。

### 2.7 `schemas.py`

文档要求新增 `3.Web/Backend/app/schemas.py` 定义 Pydantic 请求/响应模型。实际
`/api/chat/*` 接口直接用 `dict = Body(...)` 接收请求体，没有引入 Pydantic 校验模型
（其他现有接口如 `/api/predict` 也是这个风格，保持一致）。如果需要更严格的输入校验
和自动生成的 `/docs` 接口文档，可以后续补上。

---

## 3. 纠错机制（review）—— 已按文档要求实现，细节说明

模块扩展设计文档 §2.2.5 要求的"多模态纠错"**已实现**，实现细节：

- 首轮诊断实际发起 **两次** 大模型调用（文档设想的是一次）：
  1. 流式调用，生成开场白（纯文字描述，不含判断结论），供前端逐字渲染
  2. 非流式调用，同时返回 `review`（`agrees_with_model`/`ai_diagnosis`/`visual_evidence`/`confidence_note`）
     和 `advice`（结构化防治建议）
- 拆成两次调用是为了保留流式打字效果（如果一次调用直接返回大段 JSON，没法有意义地做逐字流式展示）
- 前端"🔍 AI 纠错状态"面板（[page-chat.js](../3.Web/Frontend/js/pages/page-chat.js) 的 `reviewInfo` computed）
  按文档 §2.2.5 的四态表实现：绿（一致+高置信度）/ 黄（一致+低置信度）/ 橙（AI 质疑模型）/ 灰（AI 无法判断）

---

## 4. 数据持久化（文档未明确规定实现方式，补充说明）

详细设计文档 §5.2 要求诊断记录带"生成建议"和"是否复核"字段；模块扩展设计文档 §7
的 SQLite `chat_sessions` 表设计里也有类似字段（`diagnosis_id` 外键、`model_agrees`）。
实际实现：

- **没有引入 SQLite**（模块扩展设计文档 §7 自己也说"短期内可继续使用 JSON 文件"）
- 建议生成后，直接把 `advice` / `manual_check_required` / `review` 三个字段写回
  `3.Web/Backend/logs/history.json` 里对应 `id` 的诊断记录（见 `main.py` 的
  `save_advice_to_history()`）
- **完整多轮对话历史本身不持久化**——`CHAT_SESSIONS` 是纯内存字典，后端重启即清空；
  只有"最终生成的建议结果"会同步落盘，不是文档 SQLite 设计里那种完整对话记录表

---

## 5. 队友需要知道的配置项

要让 Agent 对话真正跑通（而不是走"未配置"的降级提示），需要在 `4.Agent/.env`
（本地文件，已被 `.gitignore` 排除，不会提交）里配置：

```
LLM_API_KEY=你的硅基流动 API Key
LLM_MODEL=Qwen/Qwen3-VL-8B-Instruct   # 或其他支持图片输入的视觉模型
```

参考 [4.Agent/.env.example](../4.Agent/.env.example)。没配置时 `/api/chat/*`
接口不会报错崩溃，会返回"AI 服务尚未配置"的提示信息，其余功能（诊断/历史/统计）
不受影响。
