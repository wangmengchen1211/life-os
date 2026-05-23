# MindOS APP 上线架构约束文档

> 版本：v1.0 | 最后更新：2026-05-13

---

## 1. 用户故事

| 模块 | 用户故事 | 关键路径 |
|------|---------|----------|
| 仪表盘 | 作为用户，我希望打开 APP 就能看到今日问候、统计概览和心智摘要，以便快速把握生活节奏。 | `src/app/(main)/page.tsx` |
| 日记回音 | 作为用户，我希望随时记录日记并获得 AI 回音反馈，以便通过书写实现自我觉察。 | `src/app/(main)/diary/`、`src/components/diary/` |
| 思维藤蔓/知识库 | 作为用户，我希望将零散知识结构化为可视化蛛网，以便发现思维连接并持续积累认知资产。 | `src/app/(main)/knowledge/`、`src/components/knowledge/` |
| 心智日志 MindLog | 作为用户，我希望每天获得一份基于日记和行为数据的 AI 心智报告，以便客观认识自身状态变化。 | `src/components/mindlog/` |
| Todo 轻约 | 作为用户，我希望用极简方式管理待办事项并追踪完成率，以便保持行动力而不被工具绑架。 | `src/app/(main)/todos/`、`src/components/todos/` |
| 人生信笺 | 作为用户，我希望给未来的自己写信并在指定日期收到，以便跨越时间与自己对话。 | `src/app/(main)/letters/`、`src/components/letters/` |
| 设置面板 | 作为用户，我希望集中管理账号、AI 额度和数据同步配置，以便掌控系统行为和个人数据。 | `src/app/(main)/settings/`、`src/components/settings/` |

---

## 2. 验收标准

### 2.1 仪表盘

- **功能验收**：问候语正确展示、导航卡片可跳转、MindLog 摘要正常渲染
- **UI 验收**：分层排版呼吸感、单屏布局无需滚动、顶部预留灵动岛 48px 安全区
- **性能验收**：首屏加载 < 1.5s（本地缓存命中时 < 500ms）
- **平台验收**：Android WebView 无白屏、无横向溢出、触摸反馈正常

### 2.2 日记回音

- **功能验收**：创建/编辑/删除日记完整流程、AI 回音生成并正确展示、按周统计
- **UI 验收**：编辑器流畅无卡顿、长文本正确换行、回音区域视觉区分
- **性能验收**：列表滑动 60fps、AI 回音流式输出无闪烁
- **平台验收**：Android 输入法弹起不遮挡编辑器、返回键正确退出编辑

### 2.3 思维藤蔓/知识库

- **功能验收**：节点 CRUD、连接管理、D3 力导向图渲染、标签筛选
- **UI 验收**：蛛网动画流畅、节点可拖拽、缩放平滑、空状态引导
- **性能验收**：100 节点内渲染 < 1s、交互无丢帧
- **平台验收**：Android 触摸手势（pinch/pan）正确映射、无误触

### 2.4 心智日志 MindLog

- **功能验收**：摘要展示、详情报告加载、AI 生成触发并完成、历史记录可回溯
- **UI 验收**：加载/生成中/完成/空白四态明确、无闪烁、过渡动画自然
- **性能验收**：摘要渲染 < 300ms（缓存命中）、AI 生成超时 30s 有降级
- **平台验收**：Android sessionStorage 不可用时内存 fallback 正常、无空白

### 2.5 Todo 轻约

- **功能验收**：增删改查、勾选完成、今日统计、周报数据
- **UI 验收**：列表动画、勾选微交互、空状态鼓励文案
- **性能验收**：100 条 todo 列表渲染 < 500ms
- **平台验收**：Android 滑动手势不与系统返回冲突

### 2.6 人生信笺

- **功能验收**：撰写信笺、设置未来日期、到期后解锁阅读
- **UI 验收**：信封/信纸视觉隐喻、锁定状态不可偷看、解锁动画
- **性能验收**：列表懒加载、图片资源按需加载
- **平台验收**：Android 日期选择器兼容、通知权限正确请求

### 2.7 设置面板

- **功能验收**：飞书绑定/解绑、AI 额度查看、数据导出、密码修改
- **UI 验收**：分组清晰、操作有确认弹窗、危险操作红色警示
- **性能验收**：页面打开 < 500ms
- **平台验收**：OAuth 跳转后正确回调、WebView Cookie 保持

---

## 3. 系统约束

### 3.1 模块功能划分

| 模块 | 路径 | 技术类型 | 存储层 | 功能定级 |
|------|------|---------|--------|---------|
| 仪表盘 | `src/app/(main)/page.tsx` | 纯前端 | IndexedDB (读取) | 基础展示 |
| 日记回音 | `src/app/(main)/diary/` | 前后交互 + AI 调用 | IndexedDB + PostgreSQL | AI 生成 |
| 思维藤蔓 | `src/app/(main)/knowledge/` | 纯前端 | IndexedDB | 完整功能 |
| 心智日志 | `src/components/mindlog/` | 前后交互 + AI 调用 | sessionStorage + IndexedDB | AI 生成 |
| Todo 轻约 | `src/app/(main)/todos/` | 纯前端 | IndexedDB | 完整功能 |
| 人生信笺 | `src/app/(main)/letters/` | 前后交互 | PostgreSQL | 完整功能 |
| 设置面板 | `src/app/(main)/settings/` | 前后交互 | PostgreSQL | 基础展示 |
| 飞书集成 | `src/app/api/feishu/` | 前后交互 | PostgreSQL + IndexedDB | 完整功能 |

### 3.2 技术栈定级

| 层级 | 技术选型 | 版本 |
|------|---------|------|
| 前端框架 | Next.js (App Router) + React + Tailwind CSS v4 + Framer Motion | 15.3 / 19 / 4.0 / 12.x |
| 后端 | Next.js API Routes + Drizzle ORM + PostgreSQL | 15.3 / 0.45 / 15 |
| 原生壳 | Capacitor (Server URL 模式) | 8.3.3 |
| AI 服务 | Anthropic Claude + DeepSeek | SDK 0.95 / OpenAI 兼容 |
| 前端存储 | IndexedDB (`idb` 库) + sessionStorage (临时缓存) | idb 8.0 |
| 后端存储 | PostgreSQL (Docker) | 15-alpine |
| 部署 | Vercel (生产 Web) + Android Studio (APK 构建) | — |

### 3.3 架构约束清单

1. **Capacitor Server URL 模式**
   - 开发环境：`http://192.168.43.72:3100`（局域网 IP，手机与电脑同一网络）
   - 生产环境：公网域名（Vercel 部署地址）
   - 切换时需重新 `cap sync android`

2. **飞书 OAuth redirect_uri 约束**
   - `FEISHU_REDIRECT_URI` 必须与真机实际访问的 Server URL 一致
   - 飞书后台「安全设置 → 重定向 URL」需同时配置开发和生产地址
   - 真机调试时必须使用局域网 IP，不可用 `localhost`

3. **IndexedDB 端口/域隔离**
   - IndexedDB 按 Origin 隔离：`http://192.168.43.72:3100` 与 `https://mindos.vercel.app` 数据不互通
   - 切换 Server URL 后，前端本地数据需重新从服务端同步
   - 规划：后续需实现 IndexedDB ↔ PostgreSQL 双向同步策略

4. **PWA 仅生产启用**
   - `@ducanh2912/next-pwa` 与 Turbopack (`next dev --turbopack`) 不兼容
   - 开发模式下 PWA 插件必须禁用，仅在 `next build` 时启用
   - `next.config.js` 中通过 `process.env.NODE_ENV` 条件启用

5. **UA 标识与平台判断**
   - Capacitor 配置 `appendUserAgent: 'MindOS-App'`
   - 服务端通过 `User-Agent` 包含 `MindOS-App` 判断请求来源
   - 用于差异化 Session 有效期和 API 行为

6. **Session 策略**
   - APP 端：`iron-session` 有效期 30 天（移动端用户免频繁登录）
   - Web 端：Session 无固定过期（浏览器关闭后失效）
   - Session 密钥：`SESSION_SECRET` 至少 32 字符

7. **网络安全配置**
   - `android/app/src/main/res/xml/network_security_config.xml`
   - 必须包含开发 IP `192.168.43.72` 的 `cleartextTrafficPermitted="true"`
   - 生产版本需移除 cleartext 许可，强制 HTTPS

---

## 4. 详细技术实现

<details>
<summary>4.1 Capacitor 配置</summary>

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mindos.app',
  appName: 'MindOS',
  webDir: 'out', // Next.js static export 输出目录（备用，Server URL 模式下不使用）
  server: {
    // Server URL 模式：WebView 加载远程站点
    // 开发时使用局域网 IP，生产时使用公网域名
    url: process.env.CAPACITOR_SERVER_URL || 'http://192.168.43.72:3100',
    cleartext: true, // 开发模式使用 HTTP
    androidScheme: 'http', // 开发模式
    // @ts-expect-error appendUserAgent is supported at runtime
    appendUserAgent: 'MindOS-App', // 服务端通过 UA 识别来自 APP 的请求
  },
  ios: {
    contentInset: 'always',
    scheme: 'MindOS',
  },
  android: {
    backgroundColor: '#fefef9',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#fefef9',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
```

**关键配置说明：**
- `webDir: 'out'` — 仅在静态导出模式下使用，Server URL 模式下不生效
- `server.url` — WebView 实际加载的地址，环境变量 `CAPACITOR_SERVER_URL` 可覆盖
- `server.cleartext` — 允许 HTTP（开发专用，生产需关闭）
- `appendUserAgent` — 附加 UA 标识，服务端据此判断平台

</details>

<details>
<summary>4.2 环境变量</summary>

```bash
# .env.local 完整变量清单

# ===== 数据库 =====
DATABASE_URL=postgresql://mindos:mindos_dev_123@localhost:5432/mindos

# ===== 访问保护 =====
ACCESS_PASSWORD_HASH=              # bcryptjs 生成的密码哈希

# ===== Session =====
SESSION_SECRET=                    # 至少32字符的随机字符串

# ===== AI - Anthropic =====
ANTHROPIC_BASE_URL=                # 可选，自定义 API 端点
ANTHROPIC_API_KEY=                 # Anthropic API 密钥

# ===== AI - DeepSeek =====
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=                  # DeepSeek 标准版密钥
DEEPSEEK_PRO_API_KEY=              # DeepSeek Pro 版密钥

# ===== AI 预算 =====
AI_MONTHLY_BUDGET_CNY=50           # 月度 AI 调用预算（人民币）

# ===== Cron =====
CRON_SECRET=                       # 定时任务验证密钥

# ===== 飞书开放平台 =====
FEISHU_APP_ID=                     # 飞书应用 App ID
FEISHU_APP_SECRET=                 # 飞书应用 App Secret
FEISHU_REDIRECT_URI=http://192.168.43.72:3100/api/feishu/oauth/callback
# ⚠️ 真机调试时必须使用局域网 IP，不可用 localhost

# ===== Capacitor (可选) =====
CAPACITOR_SERVER_URL=http://192.168.43.72:3100
```

**注意事项：**
- `FEISHU_REDIRECT_URI` 必须与 Capacitor Server URL 的域/IP 一致
- 生产环境需替换为公网域名
- 所有密钥类变量禁止提交到 Git

</details>

<details>
<summary>4.3 数据库架构</summary>

**ORM：** Drizzle ORM v0.45  
**数据库：** PostgreSQL 15 (Docker)

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: mindos-db
    environment:
      POSTGRES_USER: mindos
      POSTGRES_PASSWORD: mindos_dev_123
      POSTGRES_DB: mindos
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Drizzle 命令：**
```bash
pnpm db:generate   # 生成迁移文件
pnpm db:migrate    # 执行迁移
pnpm db:push       # 推送 schema（开发用，跳过迁移文件）
pnpm db:studio     # 启动 Drizzle Studio 可视化
```

**数据库表（核心）：**
- `users` — 用户账号
- `diary_entries` — 日记条目（含 AI 回音）
- `letters` — 人生信笺
- `feishu_tokens` — 飞书 OAuth Token 存储
- `ai_usage_logs` — AI 调用量统计

</details>

<details>
<summary>4.4 前端存储架构</summary>

使用 `idb` 库（v8.0）管理 5 个独立 IndexedDB 数据库：

| 数据库名 | 用途 | 主要 Store |
|----------|------|-----------|
| `diary-db` | 日记本地缓存 | entries, drafts |
| `knowledge-db` | 知识节点与连接 | nodes, edges, tags |
| `todo-db` | 待办事项 | todos, categories |
| `mindlog-db` | 心智日志缓存 | reports, summaries |
| `feishu-auth-db` | 飞书认证状态 | tokens, user-info |

**存储策略：**
- IndexedDB 作为前端缓存层，减少 API 请求
- sessionStorage 用于组件级临时缓存（如 MindLog 摘要）
- 核心数据以 PostgreSQL 为 Source of Truth
- 前端优先读取本地缓存，后台静默同步

**容量与清理：**
- 单个数据库建议 < 50MB
- 过期数据自动清理（30 天未访问）
- 用户可在设置中手动清除缓存

</details>

<details>
<summary>4.5 飞书 OAuth 流程</summary>

```
┌─────────┐        ┌──────────┐        ┌──────────────┐
│  用户    │        │  MindOS  │        │  飞书开放平台  │
└────┬────┘        └────┬─────┘        └──────┬───────┘
     │  点击「绑定飞书」   │                      │
     │─────────────────>│                      │
     │                  │  302 重定向到飞书授权页   │
     │                  │─────────────────────>│
     │                  │                      │
     │  用户同意授权       │                      │
     │<────────────────────────────────────────│
     │                  │                      │
     │  回调 /api/feishu/oauth/callback?code=xxx │
     │─────────────────>│                      │
     │                  │  用 code 换 access_token │
     │                  │─────────────────────>│
     │                  │  返回 token + user_info │
     │                  │<─────────────────────│
     │                  │                      │
     │                  │  存储 token 到 DB      │
     │                  │  写入 IndexedDB 状态    │
     │  返回成功页面       │                      │
     │<─────────────────│                      │
```

**关键约束：**
1. `FEISHU_REDIRECT_URI` 必须在飞书后台「安全设置 → 重定向 URL」中注册
2. 真机调试时 redirect_uri 必须为 `http://192.168.43.72:3100/api/feishu/oauth/callback`
3. 生产环境需注册公网域名的回调地址
4. Token 有效期 2 小时，需实现 refresh_token 续期
5. scope 至少包含：`drive:drive:readonly`、`docx:document:readonly`

</details>

<details>
<summary>4.6 构建和部署命令</summary>

**开发命令：**
```bash
# 启动数据库
docker compose up -d

# 启动开发服务器（Turbopack 热重载，端口 3100）
pnpm dev

# 数据库迁移
pnpm db:push          # 开发快速推送
pnpm db:migrate       # 正式迁移

# Drizzle Studio（数据库可视化）
pnpm db:studio
```

**Capacitor 命令：**
```bash
# 同步 Web 资产到原生项目
pnpm cap:sync         # npx cap sync

# 仅复制 Web 资产（不更新插件）
pnpm cap:copy         # npx cap copy

# 用 Android Studio 打开项目
pnpm cap:open:android # npx cap open android

# 同步并构建 Android
pnpm cap:build:android # npx cap sync android

# 直接运行到连接的设备
pnpm cap:run:android   # npx cap run android
```

**生产构建：**
```bash
# Web 生产构建
pnpm build            # next build

# 启动生产服务
pnpm start            # next start

# APK 构建流程
# 1. 修改 capacitor.config.ts 中 server.url 为生产域名
# 2. cap sync
# 3. Android Studio → Build → Generate Signed APK
```

**代码质量：**
```bash
pnpm lint             # ESLint 检查
```

</details>

---

## 5. 下一阶段任务拆解

### P0 — 立即修复（阻塞上线）

| # | 任务 | 说明 | 涉及文件 |
|---|------|------|---------|
| 1 | MindLog 空白问题修复 | 创建缓存服务层 + 移除 key 重挂载 + 竞态保护 + Android fallback | `src/components/mindlog/` 全部 |
| 2 | 飞书 OAuth 生产环境配置 | 申请独立 App ID 或实现动态 redirect_uri 策略 | `src/app/api/feishu/`、`.env` |
| 3 | IndexedDB 数据持久化验证 | 验证端口切换后数据是否丢失，设计同步策略 | `src/lib/storage/` |

### P1 — 体验优化（上线前完成）

| # | 任务 | 说明 |
|---|------|------|
| 4 | 离线模式降级策略 | 网络断开时的 UI 提示 + 本地数据只读模式 |
| 5 | ErrorBoundary 完善 | 每个模块包裹独立 ErrorBoundary，防止局部崩溃白屏 |
| 6 | 加载状态统一 | 所有模块实现 loading / empty / error 三态 UI |
| 7 | 性能优化 | 首屏加载时间 < 2s（代码拆分 + 预加载 + 缓存优化） |

### P2 — 上线准备

| # | 任务 | 说明 |
|---|------|------|
| 8 | APP 签名密钥生成 | 生成 keystore 文件，安全保管 |
| 9 | Google Play 开发者账号 | 注册账号，完成身份验证 |
| 10 | 隐私政策和用户协议 | 编写并部署到公开 URL |
| 11 | 应用截图和商店描述 | 准备 Play Store 资料 |
| 12 | 生产环境变量配置 | Vercel 环境变量 + 生产 capacitor.config |
| 13 | 数据库迁移生产验证 | 在生产 PostgreSQL 执行迁移并验证 |

---

## 附录：MindLog 空白问题根因分析与经验总结

### 问题现象

MindLog 模块在特定操作序列下出现空白状态：组件已挂载但无内容渲染，既不显示摘要也不显示加载状态。在 Android WebView 环境中复现率更高。

---

### 根因 1：sessionStorage 缓存与初始化状态的同步矛盾

**文件：** `src/components/mindlog/mindlog-summary.tsx`

**问题描述：**  
`entry` 和 `loading` 两个 `useState` 的初始化器分别独立读取 sessionStorage，属于非原子操作。当 sessionStorage 中存在数据时，`entry` 被初始化为缓存值而 `loading` 被初始化为 `false`，但两者的读取时序不保证一致——如果在两次读取之间 sessionStorage 被外部清除，则出现 `entry = null` 且 `loading = false` 的"静默空白"状态。

**影响：** 组件认为"加载完成且无数据"，不会再触发请求，用户看到空白。

---

### 根因 2：组件 key 变化导致缓存完全失效

**文件：** `src/app/(main)/page.tsx` + `src/components/mindlog/mindlog-summary.tsx`

**问题描述：**  
`page.tsx` 中使用 `setMindlogKey(k => k + 1)` 强制卸载并重新挂载 `MindlogSummary` 组件。重新挂载时：
1. 组件完全重置，所有 state 回到初始值
2. `useEffect` 尚未运行，无法从 sessionStorage 恢复
3. sessionStorage 中可能存储的是上一轮的旧数据

导致短暂空白窗口（`useEffect` 执行前），在低性能设备上这个窗口可感知。

**影响：** 用户在生成完成后看到闪烁或短暂空白。

---

### 根因 3：生成完成后缓存未主动清理

**文件：** `src/components/mindlog/mindlog-generate.tsx`

**问题描述：**  
AI 生成新的 MindLog 报告后，数据保存到 IndexedDB，但 sessionStorage 中的旧摘要缓存未被清理。后续组件读取 sessionStorage 时拿到的是过时数据，与 IndexedDB 中的最新数据不一致。

**影响：** 用户看到旧数据或数据不一致，降低信任感。

---

### 根因 4：竞态条件与异步请求中止处理不完整

**文件：** `src/components/mindlog/mindlog-report.tsx`

**问题描述：**  
`mindlog-report.tsx` 中的异步数据请求完全没有 `isMounted` 保护或 `AbortController`。当用户快速切换 Tab（summary → report → summary），前一个 report 请求的回调可能尝试更新已卸载组件的状态，导致：
- React 警告（Can't perform state update on unmounted component）
- 内存泄漏
- 状态污染

**影响：** 在快速交互场景下状态混乱，偶发空白。

---

### 根因 5：Android/Capacitor 环境下 sessionStorage 可能不可用

**文件：** `src/components/mindlog/mindlog-summary.tsx`

**问题描述：**  
Android WebView 在某些配置下（隐私模式、特定 OEM 定制 ROM）可能禁用或限制 sessionStorage。当前代码仅用 `try/catch` 吞掉异常，没有 fallback 到内存存储。当 sessionStorage 完全不可用时，所有依赖它的缓存逻辑全部失效，每次组件挂载都从零开始。

**影响：** Android 设备上体验退化为"每次都重新加载"，且无错误提示。

---

### 修复方案总结

| # | 方案 | 具体措施 |
|---|------|---------|
| 1 | 创建缓存服务层 | 统一缓存入口：sessionStorage → 内存 Map fallback，提供原子读写 API |
| 2 | 移除 key 变化机制 | 用 `refreshTrigger` prop + `useEffect` 依赖替代 `key={n}` 强制重挂载 |
| 3 | 生成完成后主动失效缓存 | `mindlog-generate` 完成后调用 `cacheService.invalidate('mindlog-summary')` |
| 4 | 完整异步生命周期管理 | 所有异步操作加 `AbortController` + `useEffect` cleanup + `isMounted` ref |
| 5 | 平台检测与 Android 适配 | 启动时检测 sessionStorage 可用性，不可用时自动切换内存存储 |

---

### 防止重复的规范

**缓存策略规范：**
- 所有浏览器存储 API 必须通过统一服务层访问
- 缓存读写必须为原子操作（单次函数调用完成读+校验）
- 必须实现故障转移链：sessionStorage → 内存 Map → 默认值

**组件挂载规范：**
- 禁止使用动态 `key` 强制刷新，改用 `useEffect` 依赖驱动
- 组件刷新需求通过 prop 变化或 Context 通知实现

**异步操作规范：**
- 所有异步请求必须使用 `AbortController`
- `useEffect` 的 cleanup 必须中止未完成请求
- 状态更新前必须检查 `isMounted` ref

**平台适配规范：**
- 所有浏览器 API（sessionStorage/localStorage/IndexedDB）使用前必须进行可用性检测
- 不可用时必须有明确的 fallback 方案
- 禁止 `try/catch` 吞异常后无后续处理

**缓存失效规范：**
- 数据变更操作完成后必须显式失效相关缓存
- 缓存必须有 TTL（建议 MindLog 摘要 5 分钟）
- 提供手动清除缓存的用户入口
