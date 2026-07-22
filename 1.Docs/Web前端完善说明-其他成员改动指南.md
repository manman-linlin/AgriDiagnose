# Web 前端完善 — 其他成员改动指南

> 版本：v4.0 | 日期：2026-07-22 | 前端完善工作全部完成后，供后端/模型/AI Agent 成员参考

---

## 目录

- [1. 管理员账户](#1-管理员账户)
- [2. 新增后端 API（需后端确认已实现）](#2-新增后端-api需后端确认已实现)
- [3. 新增/修改的前端文件](#3-新增修改的前端文件)
- [4. 新增数据文件](#4-新增数据文件)
- [5. Agent 模块变更](#5-agent-模块变更)
- [6. 启动与测试](#6-启动与测试)
- [7. 常见问题](#7-常见问题)

---

## 1. 管理员账户

### 默认密码

```
管理员密码：admin123
```

### 修改方式

**方式一：环境变量**

```bash
# Windows PowerShell
$env:ADMIN_PASSWORD = "你的新密码"

# Linux / macOS
export ADMIN_PASSWORD="你的新密码"
```

**方式二：直接修改后端代码**

文件：[3.Web/Backend/app/main.py](AgriDiagnose/3.Web/Backend/app/main.py) 第 319 行：

```python
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
#                                              ^^^^^^^^ 改这里
```

### 登录入口

访问网站首页 → 右上角点击 **"后台管理"** → 输入密码 → 进入管理后台

---

## 2. 新增后端 API（需后端确认已实现）

以下 API 已在前端代码中调用，**均在 [main.py](AgriDiagnose/3.Web/Backend/app/main.py) 中实现**。如果后端成员重新部署，请确认以下路由存在：

### 仪表盘（均需管理员登录）

| 方法 | 路径 | 说明 | 数据来源 |
|------|------|------|----------|
| GET | `/api/admin/dashboard/overview` | 6 个统计卡片数据 | `logs/history.json` + `contributions.json` |
| GET | `/api/admin/dashboard/trends?days=30` | 每日诊断量趋势 | `logs/history.json` 按日期聚合 |
| GET | `/api/admin/dashboard/distribution` | 作物诊断分布 | `class_labels.json` 映射 + `history.json` |

### 模型管理（均需管理员登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/model/info` | 当前模型信息 |
| GET | `/api/admin/model/classes` | 38 类逐类精度列表 |
| GET | `/api/admin/model/devices` | 检测 GPU/CPU 训练设备 |
| POST | `/api/admin/model/train` | 启动训练（后台子进程） |
| GET | `/api/admin/model/training/status` | 训练进度轮询 |
| POST | `/api/admin/model/training/cancel` | 取消训练 |

### 审核管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/review/batch` | 批量审核（需登录） |

### 系统配置（均需管理员登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/config/llm` | 获取 LLM 服务商列表（Key 脱敏） |
| PUT | `/api/admin/config/llm/{provider_id}` | 更新服务商配置 |
| POST | `/api/admin/config/llm/test` | 测试 LLM 连接 |
| GET | `/api/admin/config/system` | 获取系统参数 |
| PUT | `/api/admin/config/system` | 更新系统参数 |

### 百科管理（均需管理员登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/encyclopedia` | 新增词条 |
| PUT | `/api/admin/encyclopedia/{id}` | 编辑词条 |
| DELETE | `/api/admin/encyclopedia/{id}` | 删除词条 |
| POST | `/api/admin/encyclopedia/{id}/image` | 上传百科配图 |

### 用户管理（均需管理员登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users?q=` | 用户列表（支持搜索） |
| PUT | `/api/admin/users/{id}` | 修改用户角色/信息 |

### 系统日志（需管理员登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/logs?level=&keyword=&limit=200` | 查看后端运行日志 |

---

## 3. 新增/修改的前端文件

### 新增文件

```
3.Web/Frontend/js/features/admin/logs/
└── page.js                          # 系统日志查看器页面
```

### 修改文件（共 11 个）

| 文件 | 主要改动 |
|------|----------|
| [js/app/App.js](AgriDiagnose/3.Web/Frontend/js/app/App.js) | `isOverlay`/`activeComponent` 改为直接依赖 `routerState.tick` |
| [js/router/index.js](AgriDiagnose/3.Web/Frontend/js/router/index.js) | 导出 `routerState`；`transitionKey` 增加响应式依赖；新增 `logs` 路由 |
| [js/stores/ui.js](AgriDiagnose/3.Web/Frontend/js/stores/ui.js) | 新增 `info` Toast 类型；`offline` 网络状态；`notifications` 通知中心 |
| [js/layout/Topbar.js](AgriDiagnose/3.Web/Frontend/js/layout/Topbar.js) | 登录后显示"管理后台"按钮 |
| [js/features/admin/AdminLayout.js](AgriDiagnose/3.Web/Frontend/js/features/admin/AdminLayout.js) | 子页过渡动画；侧边栏待审核角标；通知铃铛；离线横幅；logs 页注册 |
| [js/features/admin/dashboard/page.js](AgriDiagnose/3.Web/Frontend/js/features/admin/dashboard/page.js) | 图标卡片重设计；AppCounter 滚动；趋势图；柱状图；置信度直方图；饼图联动；行展开；表格排序；骨架屏；30s 轮询；CSV 导出 |
| [js/features/admin/review/page.js](AgriDiagnose/3.Web/Frontend/js/features/admin/review/page.js) | 统计卡片；全选/反选；快捷键 A/R/J/K/Space；hover 预览；百科跳转；按钮三态；30s 撤销 |
| [js/features/admin/model/page.js](AgriDiagnose/3.Web/Frontend/js/features/admin/model/page.js) | 训练设备展示；38 类逐类精度列表；训练确认弹窗 |
| [js/features/admin/settings/page.js](AgriDiagnose/3.Web/Frontend/js/features/admin/settings/page.js) | 折叠面板平滑过渡动画 |
| [js/features/admin/encyclopedia/page.js](AgriDiagnose/3.Web/Frontend/js/features/admin/encyclopedia/page.js) | 拼音搜索；三级组合筛选；弹窗动画；数组动态编辑；图片上传 |
| [js/features/admin/users/page.js](AgriDiagnose/3.Web/Frontend/js/features/admin/users/page.js) | 表格列排序 |
| [js/features/history/page.js](AgriDiagnose/3.Web/Frontend/js/features/history/page.js) | CSV 导出 |
| [js/shared/components/AppIcon.js](AgriDiagnose/3.Web/Frontend/js/shared/components/AppIcon.js) | 新增 `calendar`/`trending-up`/`bell`/`terminal` 图标 |

### CSS 修改

| 文件 | 主要改动 |
|------|----------|
| [css/components.css](AgriDiagnose/3.Web/Frontend/css/components.css) | 新增 `.toast.info`；`.dash-stat-card` 系列仪表盘卡片样式 |
| [css/animations.css](AgriDiagnose/3.Web/Frontend/css/animations.css) | 新增 `.pulse-dot` 呼吸动画；`.stat-flash` 数据变化高亮 |

---

## 4. 新增数据文件

以下文件由后端 API 自动创建，无需手动准备：

| 文件 | 创建者 |
|------|--------|
| `3.Web/Backend/app/data/config.json` | `/api/admin/config/system` PUT 首次保存时 |
| `3.Web/Backend/app/data/users.json` | 预留（用户注册时创建） |
| `2.Model/Data/encyclopedia_images/` | `/api/admin/encyclopedia/{id}/image` 上传时创建 |
| `3.Web/Backend/logs/history.json` | 已有，诊断记录 |
| `2.Model/Data/contributed/contributions.json` | 已有，审核记录 |

---

## 5. Agent 模块变更

Agent 模块代码未直接修改，但管理后台"系统配置"页面允许管理员动态修改 LLM 配置（API Key / 模型 / 接口地址）。

如果 Agent 成员需要让 Agent 读取管理后台保存的配置：

1. 配置文件路径：`3.Web/Backend/app/data/config.json`
2. 格式参考 [项目完善计划文档](项目完善计划文档.md) 第 4.2 节
3. Agent 切换配置的入口：[agent_service.py](AgriDiagnose/3.Web/Backend/app/services/agent_service.py) — 当前仍从 `4.Agent/.env` 读取，如需动态切换，修改该文件从 `config.json` 读取 `active_provider`

---

## 6. 启动与测试

### 启动后端

```bash
cd 3.Web/Backend
pip install -r requirements.txt    # 首次
python run.py                      # 启动在 http://localhost:8000
```

### 验证清单

| 序号 | 测试项 | 操作 |
|------|--------|------|
| 1 | 管理员登录 | 首页 → 右上角"后台管理" → 输入 `admin123` → 进入仪表盘 |
| 2 | 仪表盘 | 6 个图标卡片有数字滚动动画；趋势图/柱状图/饼图/直方图正常渲染 |
| 3 | 审核管理 | 统计卡片显示；列表可全选/反选；hover 图片预览；按 A/R/J/K 快捷键操作 |
| 4 | 模型管理 | 显示训练设备；38 类精度列表按作物分组；点击"开始训练"先弹确认窗 |
| 5 | 系统配置 | LLM 面板平滑展开；可保存 API Key；可测试连接 |
| 6 | 百科管理 | 搜索支持拼音首字母；三级下拉筛选；编辑弹窗有症状/防治/治疗增减按钮 |
| 7 | 用户管理 | 表格支持列头点击排序（▲/▼箭头） |
| 8 | 系统日志 | 侧边栏"系统日志"入口；终端风格深色日志面板；可筛选级别 |
| 9 | 通知中心 | 顶部铃铛图标；未读红色角标；点击展开通知列表 |
| 10 | 返回前台 | 点击"返回前台"回到诊断首页 |

---

## 7. 常见问题

### Q: 仪表盘数据全是 0？
A: 正常现象，诊断数据来自 `logs/history.json`。通过前台进行一次图片诊断后，仪表盘数据会自动更新（30 秒轮询）。

### Q: 百科图片上传后不显示？
A: 确认 `2.Model/Data/encyclopedia_images/` 目录存在且有写入权限。图片通过 `/model-data/encyclopedia_images/{filename}` 访问。

### Q: 训练按钮点击后无反应？
A: 检查 `2.Model/train.py` 是否存在。训练依赖 PyTorch 环境和 PlantVillage 数据集。

### Q: 系统配置保存后 Agent 仍用旧 API Key？
A: 当前 Agent 仍从 `4.Agent/.env` 读取配置。管理后台的配置存储在 `config.json` 中，Agent 尚未对接。需要修改 `agent_service.py` 读取 `config.json`。

### Q: 通知中心没有通知？
A: 通知由后台事件自动生成（训练完成等）。`ui.addNotification()` 方法已就绪，后端可在关键事件后调用前端 store 方法推送通知。

---

> **维护提示**：前端所有 API 调用统一经过 [js/api/client.js](AgriDiagnose/3.Web/Frontend/js/api/client.js) 的 `request()` 函数和 [js/api/index.js](AgriDiagnose/3.Web/Frontend/js/api/index.js) 的业务函数。新增 API 时请遵循此模式。
