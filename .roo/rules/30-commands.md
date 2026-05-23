# 30 — 命令与执行约束

## 包管理器

**唯一允许**：`pnpm`。遇 `npm` / `yarn` 一律拒绝执行并改写为 pnpm 等价命令。

## 工作目录

**所有 pnpm / next / cap / drizzle 命令必须在 `life-os/` 根目录下执行**。
若当前 shell cwd 不是 life-os 根，先 `cd "d:\AI\Qoder task\life-os"` 再执行。

## PowerShell 注意

- 用户 shell 为 PowerShell 5.1，**不支持 `&&`**；多命令用 `;` 分隔
- Vercel CLI 对中文主机名有兼容性问题

## 常用命令清单

### 开发
- `pnpm dev` — 启动 dev server（端口 3100，Turbopack）
- `pnpm build` — 生产构建（会启用 PWA 插件）
- `pnpm start` — 生产模式启动
- `pnpm lint` — ESLint

### Drizzle
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` / `pnpm db:studio`

### Capacitor
- `pnpm cap:sync` / `pnpm cap:build:android` / `pnpm cap:run:android` / `pnpm cap:open:android`
- 真机调试前确保 Android Studio 已配置 `local.properties` SDK 路径

## 禁止行为

- 严禁 `pnpm install --force` 重置 lockfile（除非用户明确要求）
- 严禁通过 `cat .env*` / `Get-Content .env*` 读取环境变量文件
- 严禁运行 `rm -rf` / `Remove-Item -Recurse` 删除 `src/`、`android/`、`.qoder/`
- 严禁 `git push --force` 到 main/master
