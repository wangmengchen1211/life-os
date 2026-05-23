# 20 — 编码风格与目录约定

## 路径与目录

- 路径别名：`@/*` → `src/*`（见 [`tsconfig.json`](../tsconfig.json)）
- App Router 根：`src/app/`
- 路由分组：`src/app/(main)/` 为登录后主壳；`src/app/(auth)/` 为认证页（如存在）
- API 路由：`src/app/api/<resource>/route.ts`
- 服务端工具：`src/lib/server/**`；客户端工具：`src/lib/client/**`；同构：`src/lib/**`
- UI 组件：`src/components/`；shadcn 风格基础件按需放在 `src/components/ui/`

## 组件约定

- **默认 Server Component**；仅在需要 hooks / 浏览器 API / 事件时才加 `'use client'`
- Server Component 中**严禁** import 含 `'use client'` 链的纯客户端工具
- 表单 / 交互组件优先 `react-hook-form` + Radix UI；动效用 `framer-motion`
- 样式：Tailwind 原子类 + `cva` 变体；条件类用 `clsx` + `tailwind-merge`（已通过 `cn()` 工具封装时直接复用）

## UI 改动前置义务

**首次或大幅改动 UI 前必须先读** [`.qoder/specs/life-os-design.md`](../.qoder/specs/life-os-design.md)。未读不得动 UI，违反即停手。

## 文案与字段

- 所有"AI 用量"文案统一替换为"心智点数"（参考记忆 `AI用量文案替换为心智点数`）
- 心智日志金色字体色号：参考记忆 `心智日志金色字体色号规范`
- 心智日志区域**禁用滚动**（参考记忆 `仪表盘MindLog区域禁用滚动`）

## TypeScript

- `strict: true`，禁止使用 `any`（必要时 `unknown` + 类型守卫）
- 导出类型用 `export type`，避免运行时副作用
- 服务端环境变量通过 `process.env.KEY` 读取，但**禁止把 `.env*` 文件内容写入代码或 spec**
