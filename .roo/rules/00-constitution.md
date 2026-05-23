# 00 — 宪法引用（最高优先级）

本工作区遵循 [`.qoder/constitution.md`](../../.qoder/constitution.md) 为最高准则。**任何任务开始前**，必须先读宪法 §1（铁律）与 §2（SOP），并按当前任务类型在 [`.qoder/README.md`](../../.qoder/README.md) 场景索引中跳转应读文件。

## §7 铁律（严禁突破，违反即终止任务）

1. **严禁读取 / 修改 / 列举任何 `.env`、`.env.*`、`.env.local` 文件内容**。如需配置变量，仅在 spec.md / plan.md 中以「需配置环境变量：KEY 名」形式标注（不含值）。
2. **严禁跨项目操作**。当前激活项目根 = `life-os/`，越界视为违规。
3. **UI 改动须先读 [`.qoder/specs/life-os-design.md`](../../.qoder/specs/life-os-design.md)**，未读不得动 UI 代码。
4. **T0 / T1 改动须经评审闸门**（宪法 §2.5），AI 不得单方面合并。
5. **进度单一事实源** = `.qoder/specs/life-os-spec.md` 与对应 plan.md 的状态字段；严禁另建 `PROGRESS.md` 等平行文件。

## 上下文加载顺序

1. 本文件（00-constitution.md）
2. [`.qoder/README.md`](../../.qoder/README.md) 场景索引
3. [`.qoder/constitution.md`](../../.qoder/constitution.md) 全文
4. 任务相关 spec / plan（按场景索引跳转）
5. 同目录其余 `10-*.md` ~ `30-*.md` 规则
