# life-os — 飞书 / Obsidian 单向导入 功能 Spec

> **使用方式**：本文件为 life-os 的功能 Spec。项目级决策（技术栈 / 启动命令 / 源码修改范围 / 锁定 AI 模型 / 单用户访问保护 / IndexedDB 存储事实源等）**从** [`life-os-spec.md`](./life-os-spec.md) **继承**，本 Spec 仅登记功能级差异。
> **依据**：[`.qoder/constitution.md`](../constitution.md) §2.2、§3 单人降级条款、§5 运行硬约束、§7 .env 铁律。
> **设计对齐**：UI 改动须先读 [`life-os-design.md`](./life-os-design.md)。

---

## 1. 元信息

| 字段 | 值 |
|------|---|
| Spec 类型 | 功能 Spec |
| 项目 | life-os |
| Feature 名 | 飞书 / Obsidian 单向导入（external-import） |
| 治理层级 | **T1**（涉及外部 API 集成 + 用户可见主流程 + 新增数据字段；不涉及资金 / 隐私删除 / 已上线核心表变更） |
| 状态 | 已交付（按宪法 §3 单人降级条款，CR 降级为 AI 影响分析报告 + 用户显式签收，详见 §11.1） |
| 维护人 | 用户 |
| 创建 / 最近更新 | 2026-05-13（由 `mindos-external-import-spec.md` 迁移） |
| 关联 Plan | 历史交付，未保留 plan 文件（迁移前为口头实施） |
| 关联 Design | [`life-os-design.md`](./life-os-design.md)（设置页外部源面板 UI 须对齐） |

---

## 2. 目标与边界

### 2.1 做什么（用户故事）

- **US-1**：把 Obsidian 本地 vault 里的笔记批量导入到思维藤蔓（知识库）
  - 原因：已有的笔记资产不想手动重录；导入后可复用 DeepSeek 打标 / 关联建议，让它们被 MindLog 感知。
  - 关键偏好：vault 在本地，不上云；授权一次后续增量导入无感。

- **US-2**：把飞书云文档里的自有文档批量导入知识库
  - 原因：日常零散素材写在飞书；希望与思维藤蔓统一沉淀。
  - 关键偏好：仅导入自己账号下的云文档（`docx` 类型），Wiki 权限复杂本期不做。

### 2.2 不做什么（本期边界）

- 反向同步：LifeOS → 飞书 / Obsidian 的回写
- Obsidian Local REST API 插件路径
- 云盘（iCloud / 坚果云 / OneDrive）中转
- 飞书 Wiki 知识库 API
- Obsidian 附件（图片 / PDF）转存，仅保留原始相对路径文本
- 飞书富结构 blocks 还原（本期取 raw_content 纯文本）

### 2.3 干系人

- **受益方 / 决策方 / 复核方**：项目维护者本人。
- 单人降级条款适用：CR 降级为 AI 影响分析报告 + 用户显式签收（详见 §11.1）。

---

## 3. 依赖检索（继承项目 Spec §3，本节仅补功能特异部分）

### 3.1 复用对象
- 项目 Spec [`life-os-spec.md`](./life-os-spec.md) §11.1 数据模型：`knowledge_items` Store（追加 type 联合 + externalId / externalUpdatedAt 字段 + by-external 索引）
- 项目 Spec §11.2 API 设计：复用 `/api/knowledge/tag` 打标接口的 SSE 解析逻辑

### 3.2 必须查阅的官方文档
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)（Obsidian vault 选择 + 权限恢复）
- [飞书开放平台 - drive/v1/files API](https://open.feishu.cn/document/) + `docx/v1/documents/{docToken}/raw_content` API
- [Web Crypto API - SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)（AES-GCM token 加解密）

### 3.3 设计参考
- 设置页「外部源导入」面板 UI 须遵循 [`life-os-design.md`](./life-os-design.md) §1 基调 + §2 Tokens + §4 Card / Button 5 态。

---

## 4. 技术栈（功能特异部分，其余继承项目 Spec §4）

| 维度 | 选型 | 理由 |
|------|------|------|
| frontmatter 解析 | **极简正则**（不引新依赖） | Obsidian YAML frontmatter 简单，正则足够 |
| 飞书请求 | **原生 fetch**（不引新依赖） | 走服务端 Route Handler 代理 |
| token 加密 | **Web Crypto API + AES-GCM** | 浏览器原生，key 由 `SESSION_SECRET` 派生 |
| 浏览器 API | **File System Access API + `<input webkitdirectory>` 兜底** | Chromium 桌面端用 FSAA；其他浏览器降级 |

> 不新增 npm 依赖（原 Spec 明确约束）。

---

## 5. 受影响文件列表（功能白名单）

> 本表 ⊆ 项目 Spec §5 项目级白名单。

### 5.1 新增

| 路径 | 用途 |
|------|------|
| `src/lib/obsidian/vault-adapter.ts` | File System Access API 封装 |
| `src/lib/obsidian/markdown-parser.ts` | frontmatter + 正文提取 |
| `src/lib/obsidian/handle-store.ts` | vault directory handle 持久化 |
| `src/lib/feishu/client.ts` | 飞书 API 封装（服务端） |
| `src/lib/feishu/token-crypto.ts` | token AES-GCM 加 / 解密 |
| `src/lib/importer/importer-core.ts` | 批次调度 + 增量判定 + 打标异步触发 |
| `src/lib/importer/tagging.ts` | 复用 `/api/knowledge/tag` 的 SSE 解析 |
| `src/app/api/feishu/oauth/url/route.ts` | 生成授权 URL |
| `src/app/api/feishu/oauth/callback/route.ts` | code 换 token |
| `src/app/api/feishu/oauth/refresh/route.ts` | refresh_token 续期 |
| `src/app/api/feishu/docs/list/route.ts` | 代理文档列表 |
| `src/app/api/feishu/docs/content/route.ts` | 代理文档正文 |
| `src/components/settings/external-import.tsx` | 外部源导入卡片容器 |
| `src/components/settings/obsidian-connect.tsx` | Obsidian 交互 |
| `src/components/settings/feishu-connect.tsx` | 飞书交互 |

### 5.2 修改

| 路径 | 修改用途 |
|------|---------|
| `src/lib/storage/knowledge-store.ts` | `KnowledgeItem.type` 联合追加 `'feishu' \| 'obsidian'`；新增 `externalId?` / `externalUpdatedAt?`；新增 `by-external` 索引；DB_VERSION `2 → 3`；新增 `upsertByExternalId` 方法 |
| `src/app/(main)/settings/page.tsx` | 追加外部源组件 |
| `.env.example` | 新增飞书相关 KEY 占位（仅 KEY 名） |
| `src/lib/db/schema.ts` | 注释同步外部字段（Drizzle schema 历史残留，保事实源一致） |
| `.qoder/specs/life-os-spec.md` | 阶段 6 章节登记本功能 |

### 5.3 黑名单

- 项目 Spec §5 黑名单全部继承（`.env*` / 其他项目目录 / `node_modules` / 构建产物）。
- `src/lib/db/index.ts` 现有 IndexedDB 初始化逻辑：仅在 `oldVersion < 3` 分支追加，**不改 keyPath / 不删字段**。

---

## 6. 任务清单（已交付，状态留痕）

| # | 任务 | 状态 | 负责 | 关联 Plan |
|---|------|------|------|----------|
| 1 | knowledge-store.ts 升级 v3（type 联合 + externalId / externalUpdatedAt + by-external 索引 + upsertByExternalId） | 完成 | AI + 人 | 历史 |
| 2 | obsidian/vault-adapter.ts + markdown-parser.ts + handle-store.ts | 完成 | AI + 人 | 历史 |
| 3 | importer-core.ts + tagging.ts（批次 + 增量 + 打标异步） | 完成 | AI + 人 | 历史 |
| 4 | feishu/client.ts + token-crypto.ts | 完成 | AI + 人 | 历史 |
| 5 | feishu OAuth 5 个 Route Handler（url / callback / refresh / list / content） | 完成 | AI + 人 | 历史 |
| 6 | settings/external-import.tsx + obsidian-connect.tsx + feishu-connect.tsx | 完成 | AI + 人 | 历史 |
| 7 | .env.example 飞书 KEY 占位 + 项目 Spec 阶段章节更新 | 完成 | AI + 人 | 历史 |
| 8 | 实机验证 §8.1 全部 AC | 完成 | 人 | 历史 |

---

## 7. 风险与回归点

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| IndexedDB upgrade 失败导致已有数据读不出 | 中 | 严格使用 `if (oldVersion < 3)` 分支、只增字段 / 索引、不改 keyPath |
| 飞书 App 未申请 scope 导致 403 | 中 | 设置页文档卡片提示必须 scope 列表；API 层将飞书错误码透出到 UI |
| File System Access API 权限重新被收回 | 低 | `queryPermission` 失败时 UI 回退到「重新授权」按钮，不崩溃 |
| token 明文泄漏 | 中 | AES-GCM 加密 + key 来自 `SESSION_SECRET` 派生；不通过网络回传 |
| 导入大 vault 阻塞主线程 | 中 | 并发 3、批次 20 条一刷 UI；不做 100% 全量同步触发 |
| 飞书 API 字段名差异（用户记忆已记录） | 低 | 统一在 `feishu/client.ts` 适配层兜底，message / refresh_expires_in 等字段差异在此屏蔽 |
| Capacitor 真机调试 OAuth 回调（用户记忆已记录） | 低 | 真机调试需用局域网 IP 而非 localhost，已在设置页提示文档说明 |

- **回归点**：
  - 已有 v2 用户升级 v3 后，原有 `knowledge_items` CRUD 必须无回归（IndexedDB DevTools 验证）。
  - `/api/knowledge/tag` 既是新功能复用入口，又被原有捕获流程使用，必须双向回归。
- **平行 Feature 耦合**：
  - 与项目 Spec §11.1 `knowledge_items` Store 共享：本 Feature 修改了字段联合 + 新增字段 + 索引，已在 §5 受影响文件列表登记并升级 DB_VERSION。
  - 后续 feature 若再升级 `knowledge_items` Store，必须以 v3 为基线（不可平行升级两个版本）。

---

## 8. 验收标准（功能 + 安全双轨）

### 8.1 功能验收

#### AC-1 Obsidian 路径
- [x] AC-1.1 连接 vault：点击「连接 Obsidian vault」可通过 File System Access API 选择目录；目录 handle 持久化到 IndexedDB，下次打开页面自动恢复，最多出现一次「恢复授权」提示
- [x] AC-1.2 扫描：读取 vault 下所有 `.md` 文件（递归子目录），过滤 `.obsidian/`、`node_modules/`、`.git/`、`.trash/`
- [x] AC-1.3 入库：每条 `.md` 生成一条 `knowledge_items`，`type='obsidian'`、`externalId='obsidian:<relativePath>'`、`externalUpdatedAt=mtimeISO`
- [x] AC-1.4 增量：再次导入时，`externalId` 已存在且 `externalUpdatedAt` 未变的条目跳过；已变则 update
- [x] AC-1.5 兜底：检测到 `window.showDirectoryPicker` 不存在时，UI 切换为 `<input webkitdirectory>` 单次全量上传模式
- [x] AC-1.6 打标：入库后异步调用 `/api/knowledge/tag` 打标；失败不回滚入库、不阻断后续条目

#### AC-2 飞书路径
- [x] AC-2.1 OAuth：设置页填写 `App ID/App Secret/Redirect URI` 并保存后，「连接飞书」按钮打开飞书 OAuth 授权窗；回调后 access/refresh token 加密存入 IndexedDB（AES-GCM + `SESSION_SECRET` 派生 key）
- [x] AC-2.2 过期处理：access_token 过期时自动 refresh；refresh 仍失败 → 清除本地 token、提示用户重新授权
- [x] AC-2.3 列表拉取：调用飞书 `drive/v1/files` 列出当前用户云空间中 type=docx 的文档，带分页
- [x] AC-2.4 选择导入：UI 呈现勾选清单，点击「导入所选」逐条拉 `docx/v1/documents/{docToken}/raw_content` 并入库，`type='feishu'`、`externalId='feishu:<docToken>'`
- [x] AC-2.5 增量：同 AC-1.4，以 `externalUpdatedAt` 对比飞书 `modified_time`
- [x] AC-2.6 打标：同 AC-1.6

#### AC-3 公共行为
- [x] AC-3.1 进度：UI 展示「进度 n / 总数」+ 当前文件名；整体时长可预估
- [x] AC-3.2 失败处理：单条失败记录到本地内存日志，列出失败文件名 + 原因；不阻断整体导入
- [x] AC-3.3 并发：外部抓取并发 3，IndexedDB 写入串行
- [x] AC-3.4 隔离：外部源导入写入的 `knowledge_items` 不自动进入关联图谱构建（避免一次性爆量），关联由后续打标流程的 `/api/knowledge/link` 按现有逻辑异步产生

### 8.2 安全验收（治理层级未被突破）
- [x] 实际改动文件集合 ⊆ §5 受影响文件白名单
- [x] 实际改动文件集合 ∩ §5.3 黑名单 = ∅
- [x] 未读取 / 未修改任何 `.env` / `.env.local` 文件（仅在 `.env.example` 登记 KEY 占位）
- [x] T1 改动通过单人降级 CR：AI 影响分析报告（§11.1）+ 用户显式签收（§8.3）
- [x] 涉及 UI 的改动已对齐 [`life-os-design.md`](./life-os-design.md)

### 8.3 验收签收（单人降级条款留痕）
- [x] 用户确认 §11.1 AI 影响分析报告已阅读
- [x] 用户确认 §8.1 所有 AC 在开发完成后已实机验证通过
- [x] 用户确认「单人 CR 降级」在本次改动中已留痕

> **签收日期**：交付时已完成（具体日期参考 git history）；本次治理迁移日 2026-05-13 仅为格式重写，未引入业务变更。

---

## 9. 环境变量需求

> **铁律**：仅写 KEY 名，**严禁出现变量值**。AI 不得读取或修改任何 `.env` 文件。

| KEY 名 | 用途 | 是否必需 |
|--------|------|---------|
| `FEISHU_APP_ID` | 飞书 OAuth App ID（服务端 Route Handler 使用，不下发前端） | 仅启用飞书导入时必需 |
| `FEISHU_APP_SECRET` | 飞书 OAuth App Secret（服务端 Route Handler 使用，不下发前端） | 仅启用飞书导入时必需 |
| `SESSION_SECRET` | 复用项目级（iron-session）；本 Feature 用其派生 token AES-GCM key | 必需（继承项目 Spec） |

> 占位写入 `.env.example`；实际值由用户在 `.env.local` 配置，AI 严禁触碰。

---

## 10. 变更记录

| 日期 | 变更摘要 | 操作人 |
|------|---------|--------|
| 2026-05-13 | 由 `mindos-external-import-spec.md` 迁移到新 spec.template.md；补齐与 `life-os-spec.md` 项目 Spec 的继承关系；将原 §6 AI 影响分析报告下沉到附录 §11.1；§8 验收清单按已交付状态勾选 | AI（治理对齐） |

---

## 11. 附录（非模板段，保留 mindos-external-import-spec.md 的关键留痕）

### 11.1 AI 影响分析报告（单人降级条款 §3¹ 留痕）

#### 11.1.1 涉及模块
- 前端：设置页、知识库 store、新增 Obsidian / Feishu / Importer lib
- 服务端：新增 5 个 API Route（飞书代理）
- 数据层：IndexedDB knowledge-db upgrade `v2 → v3`

#### 11.1.2 风险点（与 §7 一致，签收时口径）

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| IndexedDB upgrade 失败导致已有数据读不出 | 中 | 严格使用 `if (oldVersion < 3)` 分支、只增字段 / 索引、不改 keyPath |
| 飞书 App 未申请 scope 导致 403 | 中 | 设置页文档卡片提示必须 scope 列表；API 层将飞书错误码透出到 UI |
| File System Access API 权限重新被收回 | 低 | `queryPermission` 失败时 UI 回退到「重新授权」按钮，不崩溃 |
| token 明文泄漏 | 中 | AES-GCM 加密 + key 来自 `SESSION_SECRET`；不通过网络回传 |
| 导入大 vault 阻塞主线程 | 中 | 并发 3、批次 20 条一刷 UI；不做 100% 全量同步触发 |

#### 11.1.3 回滚路径
- **代码**：Git revert 对应 PR
- **数据**：新增字段 / 不回改旧字段；无需数据回滚（v3 → v2 不支持）
- **用户侧**：设置页「清除外部源 token / 断开 vault」按钮一键清状态

---

### 11.2 浏览器兼容与机密管理细则

- File System Access API 仅 Chromium 桌面端可用；其他浏览器降级为 `<input webkitdirectory>`
- 飞书 OAuth 回调页需同源（Next.js Route Handler `/api/feishu/oauth/callback`）
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 放入 `.env.local`（`.env.example` 登记占位）；服务端仅通过 Route Handler 使用，**不下发到前端**
- 用户的 access / refresh token 加密后存 IndexedDB（单用户、本地机）
