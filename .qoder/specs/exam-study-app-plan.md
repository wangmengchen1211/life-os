# 联考学习软件 - 实施方案

## Context

用户计划开发一款面向公众发布的考公联考学习 App（iOS/Android），核心功能为：每日晨读、复盘分析、个性化学习规划。AI 采用国内大模型 API（DeepSeek 为主，通义千问备选），语音采用系统自带 TTS，后端部署在国内云服务。

---

## 技术栈

| 层级 | 选型 | 理由 |
|------|------|------|
| 移动端 | **Flutter (Dart)** | 跨平台性能优秀，中文排版控制好，国内大厂（阿里/腾讯）均有采用 |
| 状态管理 | **Riverpod** | Flutter 生态主流，类型安全 |
| 后端 | **Python FastAPI** | 异步支持好，国内大模型 SDK 均以 Python 为主，开发效率高 |
| 数据库 | **PostgreSQL** | JSONB 存储 AI 生成内容，支持中文全文检索 |
| 缓存/队列 | **Redis** | 内容缓存 + Celery 任务队列 |
| 定时任务 | **Celery + Beat** | 每日凌晨生成晨读、每晚调整学习计划 |
| AI 模型 | **DeepSeek（主）+ 通义千问（备）** | 抽象层支持切换，DeepSeek 性价比高 |
| TTS | **flutter_tts（系统 TTS）** | 免费，无需额外 API 费用 |
| 云服务 | **阿里云** | ECS/RDS/Tair/OSS/SMS，与通义千问网络互通 |

---

## 系统架构

```
Flutter App (iOS/Android)
    │ HTTPS (JWT Auth)
    ▼
Nginx (反向代理 / SSL / 限流)
    │
    ▼
FastAPI (Gunicorn, 多实例)
    ├── PostgreSQL (RDS) ── 用户/内容/计划/复盘
    ├── Redis (Tair) ──── 缓存/会话/任务队列
    ├── Celery Workers ── 定时内容生成 & 计划调整
    └── LLM Router ────── DeepSeek API / 通义千问 API
```

### 关键架构决策

1. **晨读内容预生成**：凌晨 2 点 Celery 任务批量生成当日晨读，缓存至 Redis。用户打开 App 直接读取缓存，毫秒级响应。
2. **复盘分析流式输出**：用户提交复盘后，通过 SSE 流式返回 AI 分析，实现"打字机"效果。
3. **学习计划每晚调整**：晚 11 点 Celery 任务基于当日复盘数据自动调整次日计划。

---

## 数据库设计（核心表）

- **users** — 用户信息、目标考试、自评等级、每日可用时间、兴趣标签
- **morning_readings** — 晨读文章（标题、正文、核心要点、考试关联分析、分类标签）
- **user_reading_interactions** — 阅读记录（时长、是否播放 TTS、收藏、笔记）
- **review_records** — 复盘记录（类型、自述、心情评分、学习时长、AI 分析 JSONB）
- **study_plans** — 学习计划（整体策略、阶段分解、版本管理）
- **daily_tasks** — 每日任务清单（标题、分类、预估时间、完成状态）
- **learning_progress** — 学习进度指标（科目、指标类型、数值、日期）
- **content_topic_pool** — 晨读主题池（话题、分类、相关度评分）

---

## API 设计要点

### 认证
- `POST /auth/sms/send` — 发送验证码
- `POST /auth/sms/verify` — 验证并返回 JWT

### 晨读模块
- `GET /readings/today` — 获取今日晨读（按用户兴趣排序）
- `GET /readings/{id}` — 文章详情
- `POST /readings/{id}/interact` — 记录阅读行为

### 复盘模块
- `POST /reviews` — 提交复盘，**SSE 流式返回 AI 分析**
- `GET /reviews` — 复盘历史列表
- `GET /reviews/summary` — 聚合分析（趋势图数据）

### 学习规划模块
- `POST /plans/generate` — 生成初始计划（SSE 流式）
- `GET /plans/active/today` — 今日任务清单
- `PATCH /tasks/{id}` — 标记任务完成/跳过

---

## AI 集成设计

### LLM 抽象层
- `LLMProvider` 抽象基类：`generate()` / `generate_stream()`
- `DeepSeekProvider` / `TongyiProvider` 具体实现
- `LLMRouter` 负责主备切换、超时重试（15 秒超时自动切备用）

### 三套 Prompt 模板
1. **晨读生成**：以考公辅导专家角色，围绕指定话题生成 600-1000 字文章 + 核心要点 + 考试关联分析，输出 JSON
2. **复盘分析**：注入用户画像 + 历史数据 + 当次反思内容，输出进度评分、优势、薄弱环节、差距分析、可执行建议
3. **计划生成/调整**：基于用户信息生成分阶段计划 + 每日任务；每晚基于当日执行情况和复盘结果调整次日任务

---

## 项目目录结构

```
gongkao-app/
├── frontend/                    # Flutter
│   └── lib/
│       ├── core/                # 网络、存储、TTS、配置
│       ├── features/
│       │   ├── auth/            # 登录/注册
│       │   ├── onboarding/      # 新用户引导
│       │   ├── morning_reading/ # 晨读模块
│       │   ├── review/          # 复盘模块
│       │   └── study_plan/      # 学习规划模块
│       └── shared/              # 公共组件
├── backend/                     # FastAPI
│   └── app/
│       ├── api/v1/              # 路由
│       ├── models/              # ORM 模型
│       ├── schemas/             # 请求/响应模型
│       ├── services/            # 业务逻辑
│       ├── ai/                  # LLM 抽象层 + Prompt 模板
│       └── tasks/               # Celery 定时任务
└── infra/                       # 部署配置
```

---

## 实施步骤

### 阶段 0：基础搭建
1. 初始化 FastAPI 项目，配置 SQLAlchemy + PostgreSQL + Redis + Docker Compose
2. 实现短信验证码登录（阿里云 SMS + JWT）
3. 初始化 Flutter 项目，配置 Riverpod + Dio + 路由
4. 实现登录界面 + 新用户引导流程（目标考试 → 水平自评 → 时间 → 兴趣）

### 阶段 1：晨读模块
5. 实现 LLM 抽象层（DeepSeek + 通义千问 Provider + Router）
6. 实现晨读内容生成管线（Prompt 模板 + Celery 定时任务 + 主题池）
7. Flutter 晨读界面（文章列表 → 详情页 → TTS 播放栏 → 收藏）
8. Redis 缓存 + 客户端离线缓存（Hive）

### 阶段 2：复盘模块
9. 后端复盘 CRUD + Flutter 复盘主页（日历视图）
10. Flutter 复盘录入界面（类型选择、文本输入、心情评分、学习时长、任务勾选）
11. AI 分析 SSE 流式输出（后端流式端点 + Flutter 流式展示组件）
12. 进度可视化（折线图、雷达图，使用 fl_chart）

### 阶段 3：学习规划模块
13. 初始计划生成（SSE 流式 + Prompt 模板 → 存储为计划 + 任务）
14. 每日任务清单界面（勾选完成、滑动跳过）
15. 每晚自动调整计划（Celery 任务，整合复盘数据）
16. 三模块数据打通（计划任务 → 复盘勾选 → AI 分析 → 计划调整）

### 阶段 4：打磨发布
17. 首页仪表盘（今日晨读预览、任务进度、连续打卡天数）
18. 性能优化（API 响应、LLM 超时重试、懒加载）
19. 错误处理（离线模式、LLM 降级、空状态）
20. 测试（后端 pytest ≥80% 覆盖率、Flutter Widget 测试、集成测试）
21. 部署上线（阿里云 ECS + RDS + Tair + Nginx + SSL + CI/CD）
22. 合规（ICP 备案、隐私政策、用户协议）

---

## 关键风险与应对

| 风险 | 应对措施 |
|------|---------|
| LLM 返回格式错误 | JSON 校验 + 最多重试 2 次 + 模板兜底内容 |
| 晨读生成任务失败 | 提前 2 天生成 + 保持 20+ 篇安全库存 |
| 系统 TTS 设备差异大 | 主流安卓机型测试 + 提供纯文本回退模式 |
| LLM API 费用超预算 | 批量生成（非按用户），积极缓存，简单任务用小模型 |
| ICP 备案耗时 2-4 周 | 阶段 0 就启动备案申请 |

---

## 验证方式

1. **后端验证**：`pytest` 运行全部测试用例，检查 API 端点、AI 集成、定时任务
2. **前端验证**：Flutter `flutter test` + 模拟器运行各页面流程
3. **集成验证**：Docker Compose 启动全栈，走通完整流程（注册 → 引导 → 晨读 → 复盘 → 计划生成 → 每日任务 → 复盘 → 计划自动调整）
4. **AI 输出验证**：验证 LLM 返回的 JSON 格式正确、内容与考公相关、建议具有可操作性
