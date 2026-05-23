> **【副本说明 / Sync Notice】**
> 本目录为 `d:/AI/Qoder task/.qoder/` 的**只读副本**，用于让 VSCode 单根工作区（仅打开 `life-os/`）中的 AI agent（Cline / Roo / Copilot）能够直接读取宪法与 specs。
> 源仓库（父目录 `.qoder/`）发生变更后，需手动 sync 到本副本。请勿在本副本中独立修改治理文件，否则会与源仓库脱钩。
> 同步命令（在 `d:/AI/Qoder task/` 下执行）：
> `Copy-Item .qoder\constitution.md,.qoder\agents.md,.qoder\skills.md,.qoder\review.md,.qoder\README.md -Destination life-os\.qoder\ -Force; Copy-Item .qoder\specs\* -Destination life-os\.qoder\specs\ -Recurse -Force`

---

# `.qoder/` —— Qoder 工作区治理目录索引

> **目的**：让 AI 一打开本文件，就能根据当前任务**场景瞬间定位**应读文件，减少思考步骤。
> **必读（最高优先级，违反即违规）**：[`constitution.md`](./constitution.md) —— 工作区核心宪法，元规范，跨项目护栏。
> **使用方式**：每次接到新任务，AI 的**第一动作**是读完本 README 与 constitution.md（宪法 §2.1）。

---

## 一、场景索引（按当前任务直接跳转应读文件序列）

| 场景 | 必读文件序列 |
|------|------------|
| **新功能开发** | [constitution.md](./constitution.md) → [specs/spec.template.md](./specs/spec.template.md) → [specs/plan.template.md](./specs/plan.template.md) |
| **修改已有功能** | constitution.md → 对应 `<project>-spec.md` → 对应 `<feature>-plan.md` |
| **修 bug** | constitution.md → [review.md](./review.md) → 对应 `<feature>-spec.md` / `<feature>-plan.md` |
| **UI 设计 — bubble_notes** | constitution.md → `specs/bubble_notes-design.md`（未实例化时先按 [design.template.md](./specs/design.template.md) 创建） |
| **UI 设计 — gongkao-app** | constitution.md → `specs/gongkao-app-design.md`（未实例化时先按 [design.template.md](./specs/design.template.md) 创建） |
| **UI 设计 — life-os** | constitution.md → `specs/life-os-design.md`（未实例化时先按 [design.template.md](./specs/design.template.md) 创建） |
| **调用 / 新增 skill** | constitution.md → [skills.md](./skills.md) |
| **调用 / 新增 agent** | constitution.md → [agents.md](./agents.md) |
| **任务收尾 / 上下文压缩** | constitution.md §2.6 → [review.md](./review.md) → 回写对应 spec.md / plan.md 状态字段 |
| **新建项目** | constitution.md → [specs/spec.template.md](./specs/spec.template.md)（先产出项目 Spec，再产出功能 Spec） |
| **修订宪法本身** | constitution.md（先读现状）→ 走宪法修订流程，写专项决议 |

---

## 二、目录地图

### 工作区级单件（全局唯一，跨项目共用）

| 文件 | 一句话职责 |
|------|----------|
| [constitution.md](./constitution.md) | 元规范 / 全局护栏 / 强制铁律 |
| [README.md](./README.md) | 本文件 —— 全局索引与场景跳转 |
| [review.md](./review.md) | 踩坑模式库（同类 bug ≥ 2 次写入） |
| [skills.md](./skills.md) | 技能准入清单（成功使用 ≥ 2 次 + 显著提效） |
| [agents.md](./agents.md) | Agent 清单 + 强制权限边界 |

### 项目级模板（每项目实例化）

| 文件 | 一句话职责 |
|------|----------|
| [specs/spec.template.md](./specs/spec.template.md) | 项目 Spec / 功能 Spec 模板 |
| [specs/plan.template.md](./specs/plan.template.md) | 任务 Plan 模板（含耦合与文件边界段） |
| [specs/design.template.md](./specs/design.template.md) | 项目设计规范模板 |

### 项目级实例（按需生成）

| 项目 | spec | plan | design |
|------|------|------|--------|
| bubble_notes | `specs/bubble_notes-spec.md`（未生成） | `specs/bubble_notes-*-plan.md`（未生成） | `specs/bubble_notes-design.md`（未实例化） |
| gongkao-app | `specs/gongkao-app-spec.md`（未生成） | `specs/exam-study-app-plan.md`（旧格式，待 gongkao-app 治理对齐时迁移） | `specs/gongkao-app-design.md`（未实例化） |
| life-os | [`specs/life-os-spec.md`](./specs/life-os-spec.md)（已迁移） | [`specs/life-os-governance-alignment-plan.md`](./specs/life-os-governance-alignment-plan.md)（治理对齐，进行中）<br>[`specs/life-os-external-import-spec.md`](./specs/life-os-external-import-spec.md)（功能 Spec，已交付） | [`specs/life-os-design.md`](./specs/life-os-design.md)（**已实例化** 2026-05-13） |

> 历史 spec / plan 文件（mindos-* 等）在模板上线后由各项目自行迁移：life-os 已于 2026-05-13 完成迁移并删除旧文件；gongkao-app 待自身治理对齐时迁移。

### 承载目录

| 目录 | 用途 |
|------|------|
| `specs/` | 项目 Spec / 功能 Spec / Plan / Design（与模板同栖） |
| `agents/` | Agent 定义文件（按需新增，同步登记到 [agents.md](./agents.md)） |
| `skills/` | Skill 定义文件（按需新增，同步登记到 [skills.md](./skills.md)） |
| `repowiki/` | Qoder 项目 Wiki 自动生成内容（不归 SOP 管） |

---

## 三、维护守则（违反即违规）

1. **新增 / 删除 `.qoder/` 下任何文件**，必须同步更新：
   - 本文件（README.md）的「场景索引」与「目录地图」；
   - [constitution.md](./constitution.md) §6 治理文件索引表。
2. **新增 skill / agent**，必须先满足准入门槛（成功使用 ≥ 2 次 + 显著提效），同步更新 skills.md / agents.md。
3. **首次涉及某项目的 UI 改动**，必须先按 [design.template.md](./specs/design.template.md) 实例化对应 `<project>-design.md`，再动 UI 代码（宪法 §7）。
4. **AI 严禁**读取或修改任何 `.env` / `.env.*`，仅可在 spec.md / plan.md 中标注「需配置环境变量：KEY 名」（不含值）。
5. **进度单一事实源**：仅以 Qoder 原生任务 / Spec 视图 + spec.md / plan.md 状态字段为准；严禁另开 `PROGRESS.md` 等平行文件。

---

## 四、SOP 一图速览

```
任务到达
  ├─ §2.1 触发 Hook：读 README + constitution
  ├─ §2.2 Spec：按 spec.template.md 产出 / 更新
  ├─ §2.3 Plan：按 plan.template.md 产出（必含白/黑名单 + 验收清单）
  ├─ §2.4 Code：声明改动范围 → 编码 → 回写状态
  ├─ §2.5 验收：功能 + 安全 + 评审闸门（任一失败回 §2.3）
  └─ §2.6 总结：回写状态 + （≥2 次同类 bug 入 review.md）
```

详见 [`constitution.md`](./constitution.md) §2。
