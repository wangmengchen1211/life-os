# 30 — 命令与执行约束

## 包管理器

**唯一允许**：`pnpm`。遇 `npm` / `yarn` 一律拒绝执行并改写为 pnpm 等价命令。

## 工作目录

**所有 pnpm / next / cap / drizzle 命令必须在 `life-os/` 根目录下执行**。
若当前 shell cwd 不是 life-os 根，先 `cd "d:\AI\Qoder task\life-os"` 再执行。
（参考记忆 `pnpm命令需在项目根目录执行`、`Node脚本需在项目根目录执行`）

## PowerShell 注意

- 用户 shell 为 PowerShell 5.1，**不支持 `&&`**；多命令用 `;` 分隔
- 中文路径已知正常，但 Vercel CLI 对中文主机名有兼容性问题（参考记忆 `Vercel CLI 中文主机名兼容性问题`）

## 常用命令清单

### 开发
- `pnpm dev` — 启动 dev server（端口 3100，Turbopack）
- `pnpm build` — 生产构建（会启用 PWA 插件）
- `pnpm start` — 生产模式启动
- `pnpm lint` — ESLint

### Drizzle
- `pnpm db:generate` — 生成迁移文件
- `pnpm db:migrate` — 应用迁移
- `pnpm db:push` — 直接推 schema（开发态）
- `pnpm db:studio` — 启动 Drizzle Studio

### Capacitor
- `pnpm cap:sync` — 同步 web 资源到原生工程
- `pnpm cap:build:android` — sync android 平台
- `pnpm cap:run:android` — 在 android 设备/模拟器运行
- `pnpm cap:open:android` — 用 Android Studio 打开
- 真机调试前确保 Android Studio 已配置 `local.properties` SDK 路径（参考记忆 `Android项目需local.properties声明SDK路径`）

## 禁止行为

- 严禁 `pnpm install` 时使用 `--force` 重置 lockfile（除非用户明确要求）
- 严禁通过 `cat .env*` / `Get-Content .env*` 读取环境变量文件
- 严禁运行 `rm -rf` / `Remove-Item -Recurse` 删除 `src/`、`android/`、`.qoder/`
- 严禁 `git push --force` 到 main/master
