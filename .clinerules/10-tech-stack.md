# 10 — 技术栈与运行环境

## 核心栈

- **框架**：Next.js 15（App Router）+ Turbopack（dev）+ React 19
- **语言**：TypeScript 5（`strict: true`，路径别名 `@/*` → `src/*`）
- **样式**：Tailwind CSS v4（无独立 `tailwind.config`，通过 [`postcss.config.mjs`](../postcss.config.mjs) 启用）
- **状态/数据**：Drizzle ORM 0.45 + `postgres` 驱动；客户端缓存用 `idb`（IndexedDB）
- **会话**：`iron-session` 8（cookie 名 `mindos-session`）
- **AI**：`@anthropic-ai/sdk`、`openai`（OpenRouter 中转 `api.ofox.ai`）、`ppu-paddle-ocr`、`onnxruntime-node`
- **跨端**：Capacitor 8（android 子目录）+ `@ducanh2912/next-pwa`（仅 production 启用）
- **图表**：`recharts`、`d3-force`、`d3-zoom`、`d3-selection`
- **包管理**：**pnpm**（强制；遇 `npm install / yarn add` 一律拒绝并改用 `pnpm add`）
- **Node 模块外置**：`@napi-rs/canvas`、`ppu-paddle-ocr`、`onnxruntime-node` 由 webpack `externals` 排除（见 [`next.config.js`](../next.config.js)）

## 运行端口与地址

- **开发端口**：3100（`pnpm dev` → `next dev --turbopack -p 3100`）
- **绑定地址**：默认 0.0.0.0；Capacitor 真机调试需用局域网 IP（参考记忆 `Capacitor真机调试飞书OAuth回调需用局域网IP`）
- **数据库**：本地 docker postgres（[`docker-compose.yml`](../docker-compose.yml)）

## 关键约束

- IndexedDB 数据按端口隔离，开发环境切端口会丢数据（参考记忆 `IndexedDB数据按端口隔离导致开发环境数据不可见`）
- Capacitor APP 因 IP 变更会白屏，IP 改动须同步 `capacitor.config.ts` 的 `server.url`
- Tailwind v4 类名扫描通过 PostCSS 插件完成，无独立 config
