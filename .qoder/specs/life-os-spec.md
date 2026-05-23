# life-os 项目 Spec（业务名 MindOS）

> **使用方式**：本文件为 life-os 项目级 Spec，承载项目级决策（业务定位 / 技术栈 / 启动命令 / 数据模型 / 阶段进度 等）。功能 Spec（如 [`life-os-external-import-spec.md`](./life-os-external-import-spec.md)）从本 Spec 继承项目级字段，不重复登记。
> **依据**：[`.qoder/constitution.md`](../constitution.md) §0 双层结构、§2.2 Spec 驱动、§3 治理分级、§5 运行硬约束。
> **设计对齐**：UI 改动须先读 [`life-os-design.md`](./life-os-design.md)（宪法 §7）。

---

## 1. 元信息

| 字段 | 值 |
|------|---|
| Spec 类型 | 项目 Spec |
| 项目 | life-os（业务名 MindOS / 心智系统） |
| Feature 名 | N/A（项目级，不填 Feature） |
| 治理层级 | 项目级 Spec 不直接判定层级；各功能 Spec 自行判定（见宪法 §3） |
| 状态 | 实施中（阶段 4 进行中，阶段 0–3、6 已完成，阶段 5 体验打磨持续进行） |
| 维护人 | 用户 |
| 创建 / 最近更新 | 2026-05-13（由 `mindos-spec.md` 迁移到新模板） |
| 关联 Plan | `life-os-governance-alignment-plan.md`（治理对齐迁移）；后续业务 Plan 待立 |
| 关联 Design | [`life-os-design.md`](./life-os-design.md)（已实例化） |

---

## 2. 目标与边界

### 2.1 做什么（项目定位）

MindOS（心智系统）是一个**极简、治愈风格**的个人成长 Web 应用（PWA），面向**单用户**使用。三大核心模块 + 一套心智日志系统：

- **日记回音**：极简日记 + AI 温柔回应 + 情绪标签
- **思维藤蔓**：知识库 + 创作文章 + 关联图谱
- **Todo 轻约**：极简任务清单
- **MindLog 心智日志**：每日 / 每周 / 每月 AI 汇总，呈现全景式心智迁移
- **仪表盘**：70% MindLog 文字区 + 30% 模块侧边栏（图标 + 浮窗交互）

### 2.2 不做什么（边界）

- **不做用户系统**：单密码保护，无注册 / 多账号。
- **不做云同步 / 多端**：纯 Web PWA + IndexedDB 本地存储。
- **不做反向同步**：飞书 / Obsidian 仅单向只读导入，不回写。
- **不做实时交互图谱**：知识图谱为静态力导向。
- **不做小红书 / 抖音自动同步**：需外置 Python 微服务，本期不做。

### 2.3 干系人

- **受益方**：项目维护者本人（单用户）。
- **决策方**：项目维护者本人。
- **复核方**：项目维护者本人 + AI（按宪法 §3 单人降级条款产出影响分析）。

---

## 3. 依赖检索

> 项目已运行至阶段 4–6 部分交付，以下列出主要可复用资产。新功能开发前必须检索并复用，禁止重复造轮子。

### 3.1 已存在的相关模块

- `src/lib/db/`：IndexedDB 初始化（idb v8）、Object Store 定义、CRUD 操作封装
- `src/lib/ai/`：AIService 统一入口 + Anthropic / DeepSeek Provider（via ofox.ai）+ Prompt 模板
- `src/lib/auth/session.ts`：iron-session 单密码保护
- `src/lib/media/`：MediaSyncService（RSS 拉取 + 去重）+ rss-parser + url-patterns
- `src/lib/mindlog/`：MindLog 生成与格式化逻辑
- `src/lib/utils/time-theme.ts`：时间适应背景

### 3.2 已存在的 API / 端点

详见 §11.2「API 设计」附录。核心：
- `/api/auth/login`、`/api/knowledge/*`、`/api/diary/*`、`/api/todos/*`、`/api/dashboard`、`/api/mindlog/*`、`/api/reports/*`、`/api/media/*`、`/api/ai/stream`

### 3.3 已存在的数据模型 / 表

详见 §11.1「数据模型」附录。Object Store 列表：`config` / `knowledge_items` / `knowledge_links` / `diary_entries` / `diary_summaries` / `todos` / `sync_logs` / `reports`。

### 3.4 已存在的工具函数 / 公共组件

- `src/components/ui/`：Radix UI 封装的基础组件
- `src/components/dashboard/`、`src/components/knowledge/`、`src/components/diary/`、`src/components/todos/`、`src/components/mindlog/`、`src/components/shared/`

### 3.5 相关历史 Spec / Plan

| 文件 | 状态 |
|------|------|
| [`life-os-external-import-spec.md`](./life-os-external-import-spec.md) | 已交付（飞书 / Obsidian 单向导入） |
| [`life-os-governance-alignment-plan.md`](./life-os-governance-alignment-plan.md) | 进行中（本次治理对齐） |
| `mindos-media-creation-spec.md` | 引用但本工作区未保存（已完成自媒体创作监测，文件可能已废弃） |

---

## 4. 技术栈（项目级锁定）

| 维度 | 选型 | 理由 / 来源 |
|------|------|------|
| 前端框架 | **Next.js 15（App Router）** | React 全栈框架，Server Components 降低 bundle 体积 |
| 样式 | **Tailwind CSS v4** | 治愈风格需精细色彩控制；原生 CSS Variables 支持 |
| 组件库 | **Radix UI Primitives + 自定义样式** | 无样式原语保证无障碍，完全掌控视觉风格 |
| 数据库 | **IndexedDB（idb v8）** | 纯客户端存储，零服务端依赖，离线优先 |
| AI（视觉/重型） | **Anthropic Claude via ofox.ai 中转** | 复杂分析任务，Anthropic SDK + 替换 base_url |
| AI（文本/轻型） | **DeepSeek via ofox.ai 中转** | 日记反馈、标签生成等文本任务，成本 ~1/10 |
| RSS 解析 | **fast-xml-parser** | 自媒体 RSS 内容解析，轻量高性能 |
| 动效 | **Framer Motion** | fade / slide 治愈系动效 |
| 访问保护 | **Middleware + iron-session** | 单用户无需完整认证，环境变量密码 + 加密 cookie |
| 包管理 | **pnpm** | 项目根目录执行命令（用户记忆） |
| 启动 / 构建命令 | `pnpm dev` / `pnpm build` / `pnpm start` | 在 `d:\AI\Qoder task\life-os\` 下执行 |
| 源码修改范围 | `d:\AI\Qoder task\life-os\src\`（业务代码）+ `d:\AI\Qoder task\life-os\public\`（静态资源） | 不得跨项目修改 `bubble_notes` / `gongkao-app` |

> **白名单晋升判断**：截至 2026-05-13，宪法 §4 仍为空白名单（经验积累期），本项目技术栈在项目 Spec 内自由登记，未晋升宪法级。

---

## 5. 受影响文件列表（项目级白名单）

> 项目级 Spec 列出整个项目的源码修改范围；具体功能 Spec / Plan 的白名单必须 ⊆ 本表。

- `d:\AI\Qoder task\life-os\src\app\` —— App Router（页面 / 布局 / API Route Handlers）
- `d:\AI\Qoder task\life-os\src\components\` —— UI 组件
- `d:\AI\Qoder task\life-os\src\lib\` —— 业务逻辑（db / ai / auth / media / mindlog / importer / utils）
- `d:\AI\Qoder task\life-os\src\hooks\` —— 自定义 Hooks
- `d:\AI\Qoder task\life-os\src\types\` —— TypeScript 类型
- `d:\AI\Qoder task\life-os\public\` —— PWA 图标 / 静态资源
- `d:\AI\Qoder task\life-os\next.config.js` / `tsconfig.json` / `package.json` / `postcss.config.mjs` / `eslint.config.mjs` —— 工具链配置
- `d:\AI\Qoder task\life-os\.env.example` —— 环境变量占位（仅 KEY 名）
- `d:\AI\Qoder task\life-os\android\` —— Capacitor 安卓壳（按需）
- `d:\AI\Qoder task\life-os\capacitor.config.ts` / `vercel.json` / `drizzle.config.ts` —— 部署 / 配置

> **黑名单（项目级永久禁动）**：`.env` / `.env.local` / `.env.*`（宪法 §7 铁律）；`node_modules/` / `.next/` / `.vercel/`（构建产物）；其他项目目录。

---

## 6. 任务清单（阶段进度，与 §11.3 实施步骤对应）

| # | 任务 | 状态 | 负责 | 关联 Plan |
|---|------|------|------|----------|
| 0 | 项目基座（Next.js + IndexedDB + 密码保护 + UI 基础设施） | 完成 | 人 + AI | 历史，无对应 plan 文件 |
| 1 | 日记回音模块（diary store + 极简编辑器 + DeepSeek 反馈 + 列表 + 详情） | 完成 | 人 + AI | 历史 |
| 2 | 思维藤蔓（知识库 + 创作文章 + RSS 同步 + 关联图谱 + AI 打标） | 完成 | 人 + AI | 历史 |
| 3 | Todo 轻约（todos store + 日视图 + 完成率统计） | 完成 | 人 + AI | 历史 |
| 4 | MindLog 系统 + 仪表盘重构（每日/每周/每月 MindLog + 70/30 布局 + 总结格式 + 风格调优） | 进行中 | 人 + AI | 待立 |
| 5 | 体验打磨（动效 / 预算监控 / 性能 / 设置页 / PWA） | 进行中 | 人 + AI | 历史 + 待续 |
| 6 | 外部源单向导入（Obsidian + 飞书 docx） | 完成 | 人 + AI | [`life-os-external-import-spec.md`](./life-os-external-import-spec.md) |
| 7 | 延后：飞书/Obsidian 双向同步 / 实时交互图谱 / 创作 metrics 抓取 / 短视频源 | 待办 | — | 待立 |

> **状态字段是进度单一事实源之一**（另一个是对应 plan.md 状态字段）。中断 / 完成时必须先回写本表与对应 plan。

---

## 7. 风险与回归点

| 风险 | 触发条件 | 缓解措施 |
|------|---------|---------|
| AI 中转站（ofox.ai）不稳定 | 网络抖动 / 中转站故障 | SSE 流式响应 + 30s 超时自动切 fallback；失败时标记"待处理"后台重试 |
| IndexedDB 存储上限 | 大量 RSS / 飞书文档导入 | 定期提示导出备份；大文件不存本地（仅存路径） |
| AI 费用失控 | Prompt 设计失误 / 用户高频触发 | 硬上限 `AI_MONTHLY_BUDGET_CNY`（默认 50 元）；轻型任务统一 DeepSeek（成本 1/10）；超预算降级为本地关键词提取 |
| RSS 源不稳定 | 公众号镜像失效 / WeWe RSS 中断 | 失败重试 + 连续 3 次失败侧边栏淡灰提示，不阻断主流程 |
| 单用户密码遗忘 | `ACCESS_PASSWORD_HASH` 丢失 | 用户自留底；丢失后只能重置环境变量 |
| 端口隔离引起开发体验割裂 | IndexedDB 按端口隔离（用户记忆已记录） | 开发环境固定端口；切端口前先导出数据 |

- **回归点**：每次 AI 集成调整 / 数据模型升级 / 仪表盘布局调整后，需手测「写日记 → AI 反馈 → 知识关联 → MindLog 汇总」全链路。
- **平行 Feature 耦合**：本项目所有 feature 共享 `knowledge_items` / `diary_entries` / `reports` 三大 store；任一 feature Spec 修改这些 Store 必须在该 feature Spec 与本项目 Spec §6 同步登记。

---

## 8. 验收标准（项目级，功能 + 安全双轨）

### 8.1 功能验收（项目里程碑级）
- [x] **基座**：`pnpm dev` → 拦截至 `/login` → 输入密码进入主页（阶段 0 已完成）
- [x] **数据库**：IndexedDB DevTools 确认 8 大 Store 结构，CRUD 测试通过
- [x] **AI 集成**：日记提交触发 SSE 流式 AI 回应；MindLog 触发完整报告生成
- [x] **模块联通**：写日记 → AI 反馈 → 知识关联 → MindLog 汇总全链路通
- [x] **仪表盘**：总结区显示昨日数据 + 模块侧边栏浮窗交互正常
- [x] **外部源导入**：Obsidian 本地 vault + 飞书 docx 单向导入通过（详见外部导入 Spec §2 AC）
- [ ] **阶段 4 完结验收**：MindLog 系统全量上线（每日/每周/每月 三档生成 + 展示页面 + 风格调优收官）
- [ ] **阶段 5 完结验收**：动效 / 预算 / 性能 / 设置页 / PWA 打磨收官

### 8.2 安全验收（治理层级未被突破）
- [ ] 实际改动文件集合 ⊆ 本 Spec §5 项目级白名单（按 feature 在 plan.md 收紧）
- [ ] 实际改动文件集合 ∩ §5 黑名单 = ∅
- [ ] 涉及 T0/T1 的改动已通过评审闸门（单人降级为 AI 影响分析报告 + 用户显式签收）
- [ ] **单人团队降级条款已在每个 feature Spec 中留痕**（外部源导入 Spec §6 已落实，可作样板）

### 8.3 验收签收
- 项目持续演进，无单一签收日；每个 feature 完工时在对应 feature Spec §8.3 签收。

---

## 9. 环境变量需求

> **铁律**：仅写 KEY 名，**严禁出现变量值**。AI 不得读取或修改任何 `.env` 文件。

| KEY 名 | 用途 | 是否必需 |
|--------|------|---------|
| `ACCESS_PASSWORD_HASH` | 单用户登录密码（bcrypt 哈希） | 必需 |
| `SESSION_SECRET` | iron-session 加密密钥（32 字符）；同时用于派生外部源 token AES-GCM key | 必需 |
| `ANTHROPIC_BASE_URL` | Anthropic 中转地址（ofox.ai） | 必需 |
| `ANTHROPIC_API_KEY` | Anthropic API key | 必需 |
| `DEEPSEEK_BASE_URL` | DeepSeek 中转地址（ofox.ai） | 必需 |
| `DEEPSEEK_API_KEY` | DeepSeek API key | 必需 |
| `AI_MONTHLY_BUDGET_CNY` | 每月 AI 调用预算硬上限（默认 50） | 可选（默认值） |
| `FEISHU_APP_ID` | 飞书 OAuth App ID | 仅启用飞书导入时必需 |
| `FEISHU_APP_SECRET` | 飞书 OAuth App Secret | 仅启用飞书导入时必需 |

---

## 10. 变更记录

| 日期 | 变更摘要 | 操作人 |
|------|---------|--------|
| 2026-05-13 | 由 `mindos-spec.md` 迁移到新 spec.template.md，补齐治理分级 / 单人降级 / .env 铁律 / 关联 Design 字段 | AI（治理对齐） |

---

## 11. 附录（非模板段，保留 mindos-spec.md 业务细节）

### 11.1 数据模型（IndexedDB Object Stores）

#### 配置
- **config** — id, ai_budget_limit_monthly, ai_budget_used_monthly, preferred_ai_provider, theme_preference, wechat_rss_urls(string[]), media_last_sync_at, media_last_sync_status

#### 知识库
- **knowledge_items** — id, type(link/text/file/creation_article/obsidian/feishu), title, source_url, raw_content, ai_summary, topic_tags(string[]), source_platform, publish_date(nullable), creation_metadata(object, nullable), externalId(string, nullable), externalUpdatedAt(string, nullable), created_at, updated_at
- **knowledge_links** — id, item_a_id, item_b_id, relation_type, ai_reason, created_at

#### 日记库
- **diary_entries** — id, content, mood_tags(string[]), key_themes(string[]), ai_feedback_id, word_count, created_at
- **diary_summaries** — id, period_type(week/month), period_start, period_end, summary_content, emotion_trend(object), keyword_cloud(object), created_at

#### Todo
- **todos** — id, title, date, is_completed, completed_at, created_at

#### 同步日志
- **sync_logs** — id, platform, sync_at, items_added, status, error_message(nullable)

#### 报告 / MindLog
- **reports** — id, type(daily_mindlog/weekly_mindlog/monthly_mindlog/diary_feedback), title, content(object), period_start, period_end, created_at

#### 索引
- `knowledge_items` —— 按 topic_tags、created_at 索引；新增 `by-external`（外部源去重）
- `diary_entries` —— 按 created_at 索引
- `todos` —— 按 date + is_completed 复合索引
- `reports` —— 按 type + period_start 复合索引

> **DB_VERSION**：当前 v3（v2 → v3 由外部源导入 feature 触发：追加 `obsidian` / `feishu` 类型 + externalId / externalUpdatedAt 字段 + by-external 索引）。

---

### 11.2 API 设计

```
/api/
├── auth/login              POST — 密码校验 + session
├── knowledge/
│   ├── route               GET / POST
│   ├── [id]/route          GET / PATCH / DELETE
│   ├── links/              GET / POST / DELETE
│   ├── graph/              GET — 关联图谱数据
│   └── tag                 POST — AI 打标 SSE
├── diary/
│   ├── route               GET / POST
│   ├── [id]/route          GET / PATCH / DELETE
│   └── feedback/[id]       POST — 触发 AI 反馈生成
├── todos/
│   ├── route               GET / POST
│   └── [id]/route          PATCH / DELETE
├── dashboard/              GET — 聚合仪表盘数据
├── mindlog/
│   ├── generate            POST — 触发 MindLog 生成（daily/weekly/monthly）
│   └── [id]                GET — 获取指定 MindLog
├── reports/[id]            GET
├── media/
│   ├── sync/trigger        POST — 手动触发媒体同步
│   ├── sync/status         GET  — 同步状态 + 日志
│   └── rss/test            POST — 测试 RSS URL 有效性
├── feishu/                 — 外部源导入（feature: external-import）
│   ├── oauth/url           GET
│   ├── oauth/callback      GET
│   ├── oauth/refresh       POST
│   ├── docs/list           GET — 代理文档列表
│   └── docs/content        GET — 代理文档正文
└── ai/stream               POST — 通用 AI 流式接口
```

设计原则：AI 接口使用 SSE 流式；数据操作主要在客户端 IndexedDB 完成，API 层处理 AI 调用与外部数据同步。

---

### 11.3 实施步骤（与 §6 任务清单对应）

#### 阶段 0：项目基座 ✅
1. 初始化 Next.js 15（App Router + TypeScript + Tailwind CSS v4）
2. 配置 IndexedDB（idb v8），定义 Object Store
3. Middleware 密码保护 + iron-session + `/login`
4. UI 基础设施：Tailwind 治愈色板、Radix UI、全局布局
5. 配置 `.env.example` + 基础部署

#### 阶段 1：日记回音 ✅
6. diary_entries / diary_summaries Store
7. 极简编辑器 + 字数统计
8. DeepSeek 集成：日记反馈 Prompt + SSE 流式
9. 日记列表（日历 + 情绪标记）
10. 详情 + AI 回信展示

#### 阶段 2：思维藤蔓 ✅
11. knowledge_items / knowledge_links Store
12. 快速捕获入口（URL/文本）
13. AI 打标（摘要 + 标签 + 关联）
14. 知识列表（类型/标签筛选 + 搜索）
15. 详情 + 关联卡片
16. 关联图谱（力导向）
17. 自媒体 RSS 同步（fast-xml-parser + MediaSyncService）
18. 创作文章类型识别 + AI 创作分析

#### 阶段 3：Todo 轻约 ✅
19. todos Store
20. Todo 页面（日视图 + 快速操作）
21. 完成率统计

#### 阶段 4：MindLog + 仪表盘重构 🔄
22. MindLog 生成逻辑（每日/每周/每月 Prompt）
23. 数据聚合（日记 + 知识库 + Todo 当期汇总）
24. 仪表盘左 70% MindLog 文字区（总结 + 完整报告 Tab）
25. 仪表盘右 30% 模块侧边栏（图标 + 浮窗）
26. 仪表盘总结格式（昨日关键词 / 日记数 / 知识库操作 / 情绪底色 / 一句话总结）
27. 每日/每周/每月 MindLog 展示页
28. UI 风格调优（详见 [`life-os-design.md`](./life-os-design.md)）

#### 阶段 5：体验打磨
29. 动效（fade 切换 / 卡片进入 / 浮窗展开）
30. AI 预算监控 + 降级兜底
31. 性能（骨架屏 / 懒加载）
32. 设置页（主题 / AI 预算 / RSS 配置）
33. PWA（离线 / 可安装）

#### 阶段 6：外部源单向导入 ✅
34. Obsidian vault 本地导入（File System Access API + webkitdirectory 兜底）
35. 飞书云文档 docx 导入（OAuth + drive/docx API）
36. 公共导入内核（incremental / 批次 / 进度 / 失败降级）
37. 设置页「外部源导入」面板

详见 [`life-os-external-import-spec.md`](./life-os-external-import-spec.md)。

#### 延后功能（独立 Feature Spec 待立）
- 飞书 / Obsidian 双向同步（反向：MindOS → 外部）
- 实时交互图谱
- 文件拖拽分享接收
- 小红书 / 抖音自动同步（外置 Python 微服务）
- 创作数据 public_metrics 抓取（阅读量 / 点赞）

---

### 11.4 系统架构

```
用户浏览器 (PWA)
    │ HTTPS
    ▼
Next.js App Router
    ├── Server Components ──── 页面渲染（SSR/SSG 混合）
    ├── Route Handlers ─────── API 端点 (/api/*)
    │       └── AI Service ───→ ofox.ai 中转站 (Claude/DeepSeek)
    │
    ├── Client Components ──── 交互界面
    │       └── IndexedDB (idb v8) ──→ 本地数据持久化
    │
    └── Cron / 定时逻辑 ────── 客户端定时触发
```

**关键架构决策**：
1. **数据存储**：IndexedDB 纯客户端 + 离线优先；idb v8 Promise API。
2. **单用户访问保护**：Middleware 拦截 + cookie session + bcrypt 比对 + iron-session 加密 cookie（无需 Redis）。
3. **AI 调用分级**：重型 → Claude；轻型 → DeepSeek；统一 `AIService` 路由 + 预算控制。
4. **离线 PWA**：IndexedDB + Service Worker；AI 离线时标记"待处理"。

---

### 11.5 仪表盘与 MindLog 系统

#### 仪表盘布局（70/30）

```
┌─────────────────────────────────────────────────────────────┐
│                        MindOS 仪表盘                         │
├───────────────────────────────────┬─────────────────────────┤
│     MindLog 文字区 (70%)          │   模块侧边栏 (30%)      │
│  ┌─────────────────────────────┐  │  ┌───────────────────┐  │
│  │ 仪表盘总结                   │  │  │  📖 日记回音      │  │
│  │ 昨日关键词 · 日记数 · 知识    │  │  │  🌿 思维藤蔓      │  │
│  │ 操作数 · 情绪底色 · 一句话   │  │  │  ✓  Todo 轻约     │  │
│  └─────────────────────────────┘  │  └───────────────────┘  │
│  ┌─────────────────────────────┐  │  点击图标 → 展开浮窗    │
│  │ 完整报告 Tab（日/周/月）     │  │                         │
│  └─────────────────────────────┘  │                         │
└───────────────────────────────────┴─────────────────────────┘
```

> **UI 风格细则**：诗意排版 / 呼吸感 / 安静写意 / 低饱和 / 微动效；具体 token / 字阶 / 5 态见 [`life-os-design.md`](./life-os-design.md)。

#### MindLog 字段表

**每日**：核心关键词 / 心念标记 / 情绪底色 / 洞见闪光 / 迭代微词
**每周**：本周关键词 / 反复心念 / 主导情绪流 / 汇聚洞见 / 模式提醒 / 迭代微词
**每月**：本月关键词 / 心智地貌 / 核心张力 / 认知迁移 / 暗涌与伏笔 / 迭代微词

---

### 11.6 个人工具简化策略

| 功能 | 简化策略 |
|------|---------|
| 飞书 & Obsidian 导入 | 单向只读，手动触发，增量去重（externalId） |
| 主题图谱 | 静态力导向，不实时缩放 |
| 词云 | CSS grid + 字号映射，不引入重型库 |
| 时间适应背景 | CSS Variables + JS 时段判断，3 档切换 |
| 用户系统 | 单密码保护，无用户管理 |
| 数据备份 | IndexedDB 导出 JSON，手动下载 |

---

### 11.7 项目目录结构（参考）

```
life-os/
├── src/
│   ├── app/                        # App Router
│   │   ├── (auth)/login/page.tsx
│   │   ├── (main)/                 # 受保护主应用
│   │   │   ├── page.tsx            # 仪表盘
│   │   │   ├── knowledge/ diary/ todos/ settings/
│   │   ├── api/                    # Route Handlers
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/                 # ui / dashboard / knowledge / diary / todos / mindlog / shared
│   ├── lib/                        # db / ai / auth / media / mindlog / importer / utils
│   ├── hooks/
│   └── types/
├── public/icons/
├── android/                        # Capacitor 安卓壳
├── vercel.json / next.config.js / tsconfig.json / package.json
└── .env.example
```

---

### 11.8 工作流推演记录（自媒体创作监测，历史保留）

数据流闭环：
```
公众号发文 → WeWe RSS 更新 → 手动/定时触发同步 → knowledge_items 入库
→ DeepSeek 创作分析 → creation_metadata 写入 → 仪表盘 MindLog 更新
→ 月度 MindLog 含"公共表达"维度
```

降级路径：
```
RSS 失败 → sync_logs(status=fail) → 下次重试
→ 连续 3 次失败 → 侧边栏淡灰提示 → 不弹窗不阻断
→ 用户修复 RSS URL → 恢复
```
