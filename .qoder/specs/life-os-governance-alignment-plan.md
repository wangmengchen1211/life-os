# life-os 治理对齐迁移 Plan

> **任务性质**：治理元任务。把 life-os 现有旧格式 spec/plan 迁移到 [`.qoder/specs/spec.template.md`](./spec.template.md) / [`.qoder/specs/plan.template.md`](./plan.template.md) 新模板，并按 [`.qoder/specs/design.template.md`](./design.template.md) 实例化 `life-os-design.md`。
> **依据**：[`.qoder/constitution.md`](../constitution.md) §2.3、§2.4、§2.5；[`.qoder/README.md`](../README.md) 项目级实例表。
> **特殊说明**：本 Plan 无前置业务 Spec（治理对齐本身就是产出新 Spec 的过程），关联 Spec 字段填迁移产物 `life-os-spec.md`，待本 Plan 完工后该 Spec 即作为后续 life-os 业务任务的项目 Spec 继承源。

---

## 1. 元信息

| 字段 | 值 |
|------|---|
| 项目 | life-os |
| 关联 Spec | `life-os-spec.md`（本 Plan 完工后产出，作为项目 Spec） |
| Feature 名 | 治理对齐迁移（旧 spec/plan → 新模板 + design 实例化） |
| 治理层级 | T2（内部治理资产，不动业务代码；不涉及资金 / 隐私 / 已上线表） |
| 状态 | 已完成 |
| 维护人 | 用户 |
| 创建 / 最近更新 | 2026-05-13 / 2026-05-13 |

---

## 2. 目标与边界

### 2.1 本 Plan 要交付的具体产出

1. `life-os-spec.md` —— 由 `mindos-spec.md` 按新 spec.template.md 重写而来，作为 life-os 项目 Spec。
2. `life-os-external-import-spec.md` —— 由 `mindos-external-import-spec.md` 按新 spec.template.md 重写而来，作为「飞书 / Obsidian 单向导入」功能 Spec。
3. `life-os-design.md` —— 按 design.template.md 实例化，沉淀已有 UI 设计共识（极简治愈 / 蓝绿白主色 / 毛玻璃卡片 / extralight 字重 / 紫粉局部色等）。
4. 同步更新 [`.qoder/README.md`](../README.md) 项目级实例表与 [`.qoder/constitution.md`](../constitution.md) §6.3 状态。
5. 旧文件 `mindos-spec.md`、`mindos-external-import-spec.md` **删除**（git 历史保留底稿，避免双源真相）。

### 2.2 不做什么（边界）

- **不动 life-os 业务源码**（`d:\AI\Qoder task\life-os\` 下任何文件）。
- **不动 `.qoder/specs/exam-study-app-plan.md`**：经 `exam-study-app-plan.md` 内部第 5 行、第 102 行目录结构、Flutter+FastAPI+PostgreSQL 技术栈核对，**该文件归属 gongkao-app**，不属于本次 life-os 治理对齐范围；待 gongkao-app 自身治理对齐时再迁移。
- 不引入新业务功能、不调整现有 life-os 架构。
- 不读取 / 不修改任何 `.env` / `.env.*` / `.env.local`。

---

## 3. 依赖检索

- **复用对象**：
  - 旧 `mindos-spec.md`（信息源，迁移完成后删除）
  - 旧 `mindos-external-import-spec.md`（信息源，迁移完成后删除）
  - 已有用户记忆 5 条：`Life-OS UI视觉与排版设计规范` / `LifeOS首页纯卡片浮窗模式UI规范` / `日记AI回信UI风格规范` / `UI首页背景色与渐变效果优化` / `UI主题迁移与仪表盘视觉统一优化`，作为 design.md 的设计共识输入。
- **必须查阅的设计参考**：本 Plan 实例化 `life-os-design.md` 时遵循 [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 推荐结构（已由 design.template.md 固化）。

---

## 4. 耦合关系与文件边界（强制段）

### 4.1 白名单（本 Plan 允许修改 / 创建 / 删除的文件）

| 操作 | 路径 | 说明 |
|------|------|------|
| 创建 | `.qoder/specs/life-os-spec.md` | 项目 Spec，按 spec.template.md |
| 创建 | `.qoder/specs/life-os-external-import-spec.md` | 功能 Spec，按 spec.template.md |
| 创建 | `.qoder/specs/life-os-design.md` | 设计规范，按 design.template.md |
| 删除 | `.qoder/specs/mindos-spec.md` | 迁移完成后删除（git 历史保留底稿） |
| 删除 | `.qoder/specs/mindos-external-import-spec.md` | 同上 |
| 修改 | `.qoder/README.md` | §二项目级实例表更新 |
| 修改 | `.qoder/constitution.md` | §6.3 life-os design 状态由「未实例化」改为「已实例化」 |
| 修改 | `.qoder/specs/life-os-governance-alignment-plan.md` | 本文件状态字段回写 |

### 4.2 黑名单（依赖但禁止修改的文件）

- `d:\AI\Qoder task\life-os\` 下**所有业务源码** —— 本次纯治理对齐，禁动业务代码。
- `.qoder/specs/exam-study-app-plan.md` —— 归属 gongkao-app，本次范围外。
- `.qoder/specs/spec.template.md` / `plan.template.md` / `design.template.md` —— 模板本体，本次仅消费不修改。
- `.qoder/skills.md` / `.qoder/agents.md` / `.qoder/review.md` —— 与本次治理对齐无内容耦合。
- `.env` / `.env.*` / `.env.local` —— 宪法 §7 铁律，严禁读写。

### 4.3 平行 Feature 耦合声明

| 平行 Plan | 共享对象 | 修改通知机制 |
|-----------|---------|-----------|
| `gongkao-app` 未来治理对齐 plan（尚未创建） | `.qoder/README.md` 项目级实例表（共享同一张表） | 届时该 Plan 修改本表必须在 §6 登记，本 Plan 已完工故只读 |
| 无其他平行 Plan | — | — |

> 注：`.qoder/constitution.md` §6.3 表的修改属宪法变更，必须严格串行编辑，不与其他治理任务并行（依据：用户记忆「constitution.md 文件编辑需严格串行执行」）。

---

## 5. 任务执行清单（与 Spec §6 双向同步）

| # | 步骤 | 状态 | 触发的文件改动 | 备注 |
|---|------|------|--------------|------|
| 1 | 创建 `life-os-spec.md`（按 spec.template.md，迁移 mindos-spec.md） | ✅ 完成 | `.qoder/specs/life-os-spec.md` | 全部业务字段进入 §11 附录无丢失 |
| 2 | 创建 `life-os-external-import-spec.md`（按 spec.template.md，迁移 mindos-external-import-spec.md） | ✅ 完成 | `.qoder/specs/life-os-external-import-spec.md` | 关联 Spec 已指向 `life-os-spec.md` |
| 3 | 实例化 `life-os-design.md`（按 design.template.md + 已有 UI 记忆） | ✅ 完成 | `.qoder/specs/life-os-design.md` | 七段齐备，每段标注 M1–M5 来源 |
| 4 | 更新 README §二项目级实例表（life-os 三栏由「未生成 / 未实例化」改为新文件路径） | ✅ 完成 | `.qoder/README.md` | mindos-* 旧行已删；gongkao-app 行注明旧格式待迁 |
| 5 | 串行修改 constitution §6.3：life-os design 状态 → 已实例化 | ✅ 完成 | `.qoder/constitution.md` | 仅改一行，串行执行 |
| 6 | 删除旧文件 `mindos-spec.md`、`mindos-external-import-spec.md` | ✅ 完成 | `.qoder/specs/mindos-*.md` | git 历史保留底稿 |
| 7 | 安全验收（白/黑名单核对 + 状态字段回写） | ✅ 完成 | 本文件 §7 / §8 | T2 不触发评审闸门 |

> **中断或完成时，必须先回写本表与本 Plan §1 状态字段，再切换上下文**（宪法 §2.4）。

---

## 6. 风险与回归点

| 风险 | 触发条件 | 缓解方案 |
|------|---------|---------|
| 迁移过程信息丢失 | 旧 spec 字段在新模板找不到归宿 | 按新模板逐字段比对，无对应字段的内容并入「附录 / 历史决策」段；删除旧文件前用户口头确认或在 §7 留痕 |
| design.md 凭主观写偏离已有 UI 共识 | brainstorm 时遗忘已 fetch 的 5 条 UI 记忆 | design 各段须显式引用对应记忆条目 ID 或一句话出处 |
| constitution.md 串行编辑被打断 | 同时触发其他 .qoder 编辑 | 编辑该文件时不并行其他工具调用（用户记忆已有此约束） |
| README 索引表与 constitution §6.3 不一致 | 改一处忘改另一处 | §7.3 文件范围验收要求两处都勾选 |

- **回归测试范围**：本任务无业务代码改动，无需运行业务测试；仅人工核对治理文件链路（README → constitution §6 → 实例文件）能否走通。
- **平行 Plan 同步登记记录**：N/A（当前无并行进行中的 Plan）。

---

## 7. 验收勾选清单（强制段，三栏齐勾方可关闭 Plan）

### 7.1 功能验收
- [x] `life-os-spec.md` 已创建，覆盖 mindos-spec.md 全部业务字段（技术栈 / 架构 / 数据模型 / API / 阶段进度等，§11 附录承载所有非模板段）
- [x] `life-os-external-import-spec.md` 已创建，覆盖 mindos-external-import-spec.md 全部 AC、约束、影响分析、签收段
- [x] `life-os-design.md` 已创建，含基调 / Tokens / 字阶 / 5 态组件 / Do's & Don'ts / 响应式 / Prompt Guide 七段
- [x] README §二项目级实例表 life-os 行已更新；mindos-* 旧行已移除
- [x] constitution §6.3 life-os 状态已改为「已实例化（2026-05-13）」并加链接
- [x] 旧文件 `mindos-spec.md`、`mindos-external-import-spec.md` 已删除

### 7.2 安全验收（治理层级未被突破）
- [x] 实际改动文件集合 ⊆ 本 Plan §4.1 白名单（创建 3 / 删除 2 / 修改 3，全部命中白名单）
- [x] 实际改动文件集合 ∩ 本 Plan §4.2 黑名单 = ∅（life-os 业务源码、exam-study-app-plan.md、模板本体、skills/agents/review、.env 全部未触碰）
- [x] 未读取 / 未修改任何 `.env` 文件
- [x] T0/T1 改动已通过评审闸门 —— **N/A**：本 Plan 判定 T2
- [x] 涉及 UI 的改动已先读取并对齐 `life-os-design.md` —— **N/A**：本 Plan 不动 UI 代码，design.md 本身即本 Plan 产出

### 7.3 文件范围验收
- [x] 提交记录中实际涉及的文件清单已与 §4.1 比对（8 项操作全部一一对应）
- [x] 越界改动（若有）已记录到《风险与回归点》并经用户确认 —— 无越界改动

---

## 8. 总结与回写

- 关闭 Plan 时回写：本 Plan 触发的 review.md 候选条目（首次触发不入册，仅本 plan 留候选）：
  - _暂无候选条目_（治理对齐过程未发现 ≥ 2 次复发的踩坑模式）
- 完工日期：2026-05-13
- 完工人：用户 + AI 协作（用户决策范围与处置策略，AI 执行迁移与回写）

---

## 9. 变更记录

| 日期 | 变更摘要 | 操作人 |
|------|---------|--------|
| 2026-05-13 | 初稿；锁定迁移范围与白/黑名单；旧文件采用「删除」策略 | AI（用户确认范围） |
| 2026-05-13 | 全部 7 步任务执行完毕；§7 三栏验收齐勾；状态回写「已完成」 | AI |
