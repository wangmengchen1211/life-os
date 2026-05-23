# Copilot 约束架构 — life-os

> 本文件是 GitHub Copilot Chat 在 life-os 工作区的**默认 system instruction**。
> 与 [`.clinerules/`](../.clinerules/) 及 [`.roo/rules/`](../.roo/rules/) 共用同一组宪法，参见 [`.qoder/constitution.md`](../.qoder/constitution.md)。

## 项目背景

life-os（品牌名 MindOS）是一款**心智操作系统**形态的个人智能体应用，核心模块包括：仪表盘、心智日志（MindLog）、思维藤蔓（高频词图谱）、日记回音、人生信笺、第三方数据导入（飞书/Obsidian）。

详细产品定位、模块划分、视觉规范见：
- [`.qoder/specs/life-os-spec.md`](../.qoder/specs/life-os-spec.md) — 产品 Spec
- [`.qoder/specs/life-os-design.md`](../.qoder/specs/life-os-design.md) — 设计规范（**UI 改动必读**）
- [`APP-ARCHITECTURE.md`](../APP-ARCHITECTURE.md) — 架构概览
- [`DESIGN.md`](../DESIGN.md) — 设计速查

## 技术栈一页摘要

- Next.js 15 App Router + Turbopack + React 19 + TypeScript 5（strict）
- Tailwind CSS v4（通过 PostCSS，无独立 config）
- Drizzle ORM 0.45 + postgres 驱动 + idb（IndexedDB 客户端缓存）
- iron-session 8（cookie `mindos-session`）
- Capacitor 8 跨端（android 子目录）+ next-pwa（仅 production）
- ppu-paddle-ocr / onnxruntime-node / openai（OpenRouter 中转 api.ofox.ai）
- 包管理：**pnpm**（强制）
- 开发端口：**3100**

## 红线清单（必须遵守，违反即拒答）

1. **严禁读取 / 修改 / 列举任何 `.env`、`.env.*`、`.env.local` 文件内容**。
   需要新环境变量时，仅以「需配置环境变量：KEY 名」形式标注，不写值。
2. **严禁跨项目操作**。激活根 = `life-os/`，越界视为违规（不得引用 `../bubble_notes/`、`../gongkao-app/` 下文件）。
3. **UI 改动须先读 `.qoder/specs/life-os-design.md`**，否则停手并提示用户先读 design。
4. **T0 / T1 改动须经评审闸门**（宪法 §2.5），不得单方面给出"已合并"结论。
5. **进度单一事实源** = `.qoder/specs/life-os-spec.md` 与对应 plan.md 的状态字段；不要建议另开 PROGRESS.md。

## 命令约定

- 包管理器：**仅 pnpm**。若用户输入 `npm install x`，改写为 `pnpm add x` 后再执行。
- 工作目录：所有命令必须在 `life-os/` 根目录下执行。
- PowerShell 不支持 `&&`，多命令用 `;` 分隔。
- 常用命令：
  - 开发：`pnpm dev` / `pnpm build` / `pnpm lint`
  - 数据库：`pnpm db:generate` / `db:migrate` / `db:push` / `db:studio`
  - 跨端：`pnpm cap:sync` / `cap:build:android` / `cap:run:android`

## 编码约定

- 默认 Server Component；仅在必要时加 `'use client'`
- 路径别名 `@/*` → `src/*`
- 样式：Tailwind + `cva` + `clsx` + `tailwind-merge`（通常已封装为 `cn()`）
- 文案约定：「AI 用量」统一写作「心智点数」
- 心智日志区域**禁用滚动**

## 回复风格

- 中文回复（用户语言偏好）
- 简洁，先给结论后给依据
- 引用文件用 markdown 链接 `[显示名](file:///绝对路径)`
- 改动前先说明会改哪些文件
