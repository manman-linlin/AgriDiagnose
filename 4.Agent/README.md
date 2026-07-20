# Agent 模块

## 功能说明

本模块负责调用**豆包（Doubao）大模型 API**，根据图像识别结果生成病虫害防治建议。

## 工作流程

```
图片分类结果 ──→ 构建 Prompt ──→ 调用豆包 API ──→ 解析返回 JSON ──→ 前端展示
   │                  │                  │
   │          作物名 + 病害名     结构化防治建议
   │          置信度 + 图片        症状/成因/防治/风险
```

## 输入

| 字段 | 来源 | 说明 |
|------|------|------|
| `crop` | 模型分类结果 | 作物名称（中文），如"番茄" |
| `disease` | 模型分类结果 | 病害名称（中文），如"早疫病" |
| `confidence` | 模型分类结果 | 识别置信度 |
| `image` | 用户上传 | 叶片图片（可选，多模态模型支持） |

## 输出（期望 JSON 格式）

```json
{
  "disease_name": "番茄早疫病",
  "symptoms": "叶片出现褐色圆形病斑，有同心轮纹，严重时叶片枯死。",
  "cause": "由茄链格孢菌引起，高温高湿环境下易发生。",
  "prevention": [
    "选择抗病品种",
    "合理轮作，避免连作",
    "加强通风透光"
  ],
  "treatment": [
    "发病初期喷洒百菌清可湿性粉剂",
    "及时清除病叶病株并深埋",
    "注意药剂交替使用，避免抗药性"
  ],
  "risk_level": "中",
  "manual_check_required": false
}
```

## Prompt 模板

```text
你是一名专业的农业病虫害防治专家。请根据以下信息，给出结构化的诊断建议：

- 作物名称：{crop}
- 病害名称：{disease}
- 识别置信度：{confidence}%

请按照以下 JSON 格式返回（仅返回 JSON，不要其他内容）：
{
  "disease_name": "病害中文名",
  "symptoms": "典型症状描述",
  "cause": "发病原因",
  "prevention": ["预防措施1", "预防措施2"],
  "treatment": ["治疗方法1", "治疗方法2"],
  "risk_level": "高/中/低",
  "manual_check_required": true/false
}

注意：
1. 如果置信度低于 80%，manual_check_required 设为 true
2. 防治建议应具体、可操作
3. 药剂名称需使用通用名，并提醒安全间隔期
```

## 待实现文件

| 文件 | 说明 |
|------|------|
| `agent.py` | 豆包 API 调用封装 |
| `config.py` | API Key、Endpoint 配置 |
| `prompt.py` | Prompt 模板管理 |

## 豆包 API 调用示例（参考）

```python
import requests

def call_doubao(crop: str, disease: str, confidence: float) -> dict:
    """调用豆包 API 生成防治建议。"""
    url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "doubao-pro-32k",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"作物：{crop}\n病害：{disease}\n置信度：{confidence}%"},
        ],
        "temperature": 0.3,
    }
    resp = requests.post(url, json=payload, headers=headers)
    return resp.json()
```

## 与 WebApp 集成

在 `3.Web/Backend/app/main.py` 中增加 `/api/advice` 接口：

```python
@app.post("/api/advice")
def get_advice(request: AdviceRequest):
    """根据识别结果获取防治建议。"""
    result = agent.call(request.crop, request.disease, request.confidence)
    return {"code": 200, "data": result}
```

前端诊断结果卡片下增加"查看防治建议"按钮，点击后调用此接口展示详细防治方案。
