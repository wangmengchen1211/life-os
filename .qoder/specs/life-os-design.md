# life-os 设计规范（design.md）

> **使用方式**：本文件为 life-os（业务名 MindOS）的设计单一事实源。**任何 UI 改动前必须先读本文件**（宪法 §7「UI 设计强制对齐」）。
> **依据**：[`.qoder/constitution.md`](../constitution.md) §7；模板 [`.qoder/specs/design.template.md`](./design.template.md)。
> **设计共识来源**（用户记忆沉淀，本文件每段引用对应来源）：
> - M1：`Life-OS UI 视觉与排版设计规范`（极简治愈 / 五色渐变 / 60–70% 文本占比 / 灵动岛留白）
> - M2：`LifeOS 首页纯卡片浮窗模式 UI 规范`（毛玻璃卡片 / 原位展开 / 无导航栏）
> - M3：`日记 AI 回信 UI 风格规范`（紫粉渐变局部色 / 治愈心情标签）
> - M4：`UI 主题迁移与仪表盘视觉统一优化`（蓝绿白主色 / extralight 字重 / 浮标 z-index）
> - M5：`UI 首页背景色与渐变效果优化`（青绿底色 / 五段流动渐变 / CSS Variables）

---

## 1. 基调（一句话氛围）

> **极简治愈 · 蓝绿白主色 · 毛玻璃浮窗 · extralight 字重 + 宽字距 · 五段流动渐变背景 · 安静呼吸感**

气质核心：**适合复盘回望的诗意工具**，文字呼吸感优先，留白充足，低饱和，无锐利边界。来源：M1 / M2 / M4 / M5 共同定义。

---

## 2. Design Tokens（**仅写语义名，不写色值 / 具体数值**）

> 实际色值由 [`life-os/src/app/globals.css`](../../life-os/src/app/globals.css) 的 CSS Variables 与 Tailwind config 承载（来源：M5）；本表只锁语义。

### 2.1 颜色语义

| 语义名 | 用途 | 来源 / 备注 |
|--------|------|-----------|
| `bg/canvas` | 全局画布底色（青绿调，提亮明度） | M5 五段流动渐变（青绿 → 深蓝绿 → 紫蓝） |
| `bg/canvas-gradient` | 五段流动渐变叠加层 | M5；具体停靠点由 globals.css CSS Variables 控制 |
| `bg/glow` | 柔光光斑（点缀呼吸感） | M5 提亮后的柔光 |
| `bg/surface-glass` | 毛玻璃卡片底色（半透白） | M2 + M4：白色半透明 + 毛玻璃 |
| `bg/surface-solid` | 不透明侧栏 / 浮窗底（用户浮标 / 「我的」面板） | M1 明确：**侧栏与用户浮窗完全不透明**，禁用毛玻璃 |
| `bg/elev-1` `bg/elev-2` | 多层级浮起（卡片堆叠） | 实现层用 backdrop-blur 强度梯度 |
| `fg/primary` | 主文字（**禁用纯黑**） | M2：无纯黑文字；用深蓝灰或深青灰 |
| `fg/secondary` | 次要文字 | |
| `fg/muted` | 弱化 / 占位 | |
| `fg/on-glass` | 毛玻璃卡片上的文字 | 与 `bg/surface-glass` 对比度 ≥ AA |
| `accent/primary` | 主动作色（薄荷 / 浅水绿） | M4：柔和绿底按钮 |
| `accent/diary-echo` | 日记「未来回音」回信卡片渐变（紫粉系） | M3：from-purple-50 via-indigo-50 to-pink-50 |
| `accent/mood-tag` | 心情标签（治愈青系） | M3：teal-50 底 / teal-600 字 |
| `accent/insight-card` | 洞见卡片底色（柔和青绿） | M1：建议调整为柔和青绿色 |
| `accent/danger` | 危险 / 销毁动作 | 仍需柔和，不破坏整体治愈氛围 |
| `accent/success` | 成功反馈 | |
| `accent/warning` | 警告反馈 | |
| `border/none` | 无边框（默认） | M2：所有元素**无边框线** |
| `border/glass` | 毛玻璃卡片白色细描边（仅特定场景） | M4：白色边框（仅卡片自身用） |

> **铁律**：禁止在 UI 代码里硬编码 `#FFFFFF` / `#000000` / `rgb(...)` 等具体色值；必须走 token。

### 2.2 间距语义

`space/xs` `space/sm` `space/md` `space/lg` `space/xl` `space/2xl` `space/breath`（呼吸专用，>= space/2xl，用于段落与卡片之间）

> M1 强制：标题与正文之间至少留 `space/breath`；首页文本占据 60–70%，留白宽松。

### 2.3 圆角与阴影语义

- 圆角：`radius/sm`、`radius/md`、`radius/lg`、`radius/2xl`（毛玻璃卡片专用，**大圆角**）、`radius/full`
- 阴影：`shadow/elev-1`（卡片）、`shadow/elev-2`（浮窗展开）、`shadow/glow`（柔光氛围）、`shadow/focus`

### 2.4 动效语义

- `motion/instant`（≤80ms）—— 即时反馈
- `motion/fast`（120ms）—— 微交互
- `motion/standard`（200ms）—— 一般状态切换
- `motion/emphasized`（320ms）—— 强调反馈（仪表盘卡片悬浮）
- `motion/expand`（440ms ease-out）—— **首页卡片原位展开至全屏**（M2 核心动效）
- `motion/breath`（>1.6s 循环）—— 背景渐变 / 柔光呼吸

### 2.5 模糊（毛玻璃）

- `blur/sm`（卡片堆叠下层）
- `blur/md`（首页 5 张卡片，M2 默认）
- `blur/lg`（弹窗背板）

---

## 3. 字体阶梯

> **字重核心**：默认 `extralight`（200）+ 宽字距（M4），仅在加重时上 400/600。**无衬线**。

| 角色 | 用途 | 字号语义 | 行高语义 | 字重 | 字距 |
|------|------|---------|---------|------|------|
| display | 启动页 / 大标题 | `text/display` | `leading/display` | 200（extralight） | `tracking/wide` |
| h1 | 页面主标题（如「思维藤蔓」） | `text/h1` | `leading/h1` | 200 | `tracking/wide` |
| h2 | 模块标题 | `text/h2` | `leading/h2` | 300 | `tracking/wide` |
| h3 | 卡片标题 | `text/h3` | `leading/h3` | 400 | `tracking/normal` |
| h4 | 次级标题（如「未来回音」标签） | `text/h4` | `leading/h4` | 500 | `tracking/normal` |
| body | 正文（日记 / MindLog） | `text/body` | `leading/body-loose` | 400 | `tracking/relaxed` |
| body-strong | 正文加重 | `text/body` | `leading/body` | 600 | `tracking/normal` |
| caption | 辅助说明 / 时间戳 | `text/caption` | `leading/caption` | 300 | `tracking/wide` |
| code | 代码片段 / 路径 | `text/code` | `leading/code` | 400（mono） | `tracking/normal` |

> **M1 强制**：RSS 导入说明等设置页文字字号必须与本表标题体系对齐，禁止单独定义。

---

## 4. 组件 5 态规范

### 4.1 Button（主按钮）

| 状态 | bg | fg | border | shadow | 备注 |
|------|----|----|--------|--------|------|
| default | `accent/primary` | `fg/on-accent` | `border/none` | `shadow/elev-1` | 柔和绿底（M4） |
| hover | `accent/primary` 提亮 | 同上 | none | `shadow/elev-2` | `motion/fast` |
| active | `accent/primary` 压暗 | 同上 | none | inset | |
| disabled | `bg/elev-1` | `fg/muted` | none | none | 无指针；**仍不出现纯黑** |
| loading | `accent/primary` | spinner | none | `shadow/elev-1` | 文案隐藏，spinner 占位 |

### 4.2 Input（登录页 + 设置页通用）

| 状态 | bg | fg | border | shadow | 备注 |
|------|----|----|--------|--------|------|
| default | `bg/surface-glass` 浅 | `fg/primary` | `border/glass`（白色细描边，M4） | none | 登录页样板 |
| hover | 同上 | `fg/primary` | `border/glass` 提亮 | none | |
| active / focus | 同上 | `fg/primary` | `accent/primary` 1px 描边 | `shadow/focus` | 治愈绿描边，无锐利感 |
| disabled | `bg/elev-1` | `fg/muted` | none | none | |
| loading | 同 default | spinner 右侧 | `border/glass` | none | |

### 4.3 Card（首页毛玻璃卡片，M2 核心）

| 状态 | bg | fg | border | shadow | 备注 |
|------|----|----|--------|--------|------|
| default | `bg/surface-glass` + `blur/md` | `fg/on-glass` | `border/glass` | `shadow/elev-1` | 大圆角 `radius/2xl` |
| hover | 提亮 5% + `blur/md` | 同上 | `border/glass` 提亮 | `shadow/elev-2` | `motion/emphasized` |
| active（按下） | 压暗 5% + `blur/md` | 同上 | 同上 | `shadow/elev-1` | `motion/fast` |
| disabled | `bg/elev-1` + `blur/sm` | `fg/muted` | none | none | 不再用于交互 |
| **expanded** | `bg/canvas` + 卡片内容铺满 | 同上 | none | none | M2：原位展开至全屏，`motion/expand`；返回时缩回原位 |

> **M4 z-index 规则**：卡片展开后右上角叉号浮标 z-index < 「我的」浮标，避免重叠（已在 M4 修复）。

### 4.4 Modal / Dialog（浮窗）

| 状态 | bg | fg | border | shadow | 备注 |
|------|----|----|--------|--------|------|
| default | `bg/surface-solid`（**不透明**，M1） | `fg/primary` | none | `shadow/elev-2` | 用户浮窗 / 「我的」面板 |
| hover（关闭按钮） | 同上 | `accent/primary` | none | `shadow/elev-2` | |
| active | 同上 | `accent/primary` 压暗 | none | inset | |
| disabled | N/A | — | — | — | 浮窗一般不 disabled，整体收起 |
| loading | 同 default | spinner 居中 | none | `shadow/elev-2` | |

### 4.5 Tag / Chip（心情标签 / 主题标签）

| 状态 | bg | fg | border | shadow | 备注 |
|------|----|----|--------|--------|------|
| default | `accent/mood-tag`（teal-50 类） | teal-600 类 | none | none | M3 心情标签样板 |
| hover | 提亮 | 同上 | none | none | |
| active（已选中） | `accent/mood-tag` 加深 | 反白 | none | `shadow/elev-1` | |
| disabled | `bg/elev-1` | `fg/muted` | none | none | |
| loading | N/A | — | — | — | tag 不需要 loading |

### 4.6 Diary AI 回信卡片（特异组件，M3）

| 状态 | bg | fg | border | 备注 |
|------|----|----|--------|------|
| default | `accent/diary-echo`（紫粉渐变 from-purple-50 via-indigo-50 to-pink-50） | `fg/primary` | none | 标题标签固定为「未来回音」 |

> 此组件不参与 5 态规范（仅展示，无交互态）。

---

## 5. Do's & Don'ts

### 5.1 Do's

- ✅ 优先使用语义 token；色值 / 字号 / 间距全部走 token。
- ✅ 标题与正文之间至少留 `space/breath` 呼吸（M1）。
- ✅ 首页文本占据 60–70% 屏幕；顶部预留灵动岛空间（M1）。
- ✅ 毛玻璃卡片使用 `radius/2xl` + `border/glass` + `shadow/elev-1`（M2 + M4）。
- ✅ 文字层级严格走 §3 字阶；extralight 为默认字重（M4）。
- ✅ 危险动作配合二次确认 + `accent/danger`（治愈版，不刺眼）。
- ✅ 心情标签必走 `accent/mood-tag`（M3 治愈青）。
- ✅ 日记 AI 回信卡片必用紫粉渐变 + 「未来回音」固定标题（M3）。
- ✅ 浮窗 z-index 遵循：背景 < 内容 < 卡片 < 卡片关闭叉号 < 「我的」浮标（M4）。

### 5.2 Don'ts

- ❌ **不要使用纯黑文字**（`#000`）—— 必须用 `fg/primary` 的深蓝灰 / 深青灰（M2）。
- ❌ **不要给元素加边框线**（除 `border/glass` 卡片描边外）（M2）。
- ❌ 不要在 UI 代码里硬编码任何色值 / 字号像素 / margin 像素（必须走 token）。
- ❌ 不要让侧栏 / 用户浮窗使用毛玻璃（必须 `bg/surface-solid` 不透明，M1）。
- ❌ 不要使用未在本文件登记的组件库 API（防幻觉，宪法 §7）；不确定的方法 / 属性必须先 TODO 停止生成，向用户确认。
- ❌ 不要在 modal 中嵌套另一个 modal。
- ❌ 不要在洞见模块出现「暂无足够画像数据」的占位 tab（M1 已移除该兜底，直接不显示）。
- ❌ 不要破坏五段流动渐变背景（青绿 → 深蓝绿 → 紫蓝），不要替换为单色（M5）。

---

## 6. 响应式

### 6.1 断点（语义）

| 断点 | 含义 | 典型设备 |
|------|------|---------|
| `bp/sm` | 手机竖屏（**主战场**，含 Capacitor 安卓壳） | < 640px |
| `bp/md` | 平板 / 手机横屏 | 640–1024px |
| `bp/lg` | 桌面 / PWA | 1024–1440px |
| `bp/xl` | 大屏 | ≥ 1440px |

### 6.2 触控目标

- 最小可点击尺寸：**44 × 44pt**（移动端 + Capacitor 安卓）。
- 相邻触控目标间距 ≥ `space/sm`。
- 首页 5 张毛玻璃卡片：每张高度满足 `bp/sm` 单列、≥ 120pt（M2）。

### 6.3 折叠策略

- **首页**：`bp/sm` 单列纵向 5 张卡片；`bp/md` 双列；`bp/lg` 仍以单列阅读宽度为主（治愈氛围不被打破）。
- **仪表盘 70/30 布局**：`bp/sm` 折叠为「上 70% MindLog 文字 + 下 30% 模块图标横滑」；`bp/md` 起按 70/30 横排。
- **长文本**（日记 / MindLog 报告）：`bp/sm` 强制单列阅读宽度（最大 60ch），禁止横向溢出。
- **导航**：M2 已废除顶部导航栏 + 底部 Tab，仅保留右上角「我的」小圆点入口。所有断点统一。

### 6.4 灵动岛 / 安全区

- iOS / Capacitor 顶部预留灵动岛空间（`space/lg` 起步，M1）。
- 安卓状态栏区域 padding-top 自适应。
- 底部小白条 / 手势区预留 `space/md`。

---

## 7. Prompt Guide（即插即用 AI 设计指令）

> 把以下片段复制到 AI 对话，可快速对齐 life-os 设计语言。

```
请遵循 .qoder/specs/life-os-design.md 设计规范：
1. 基调：极简治愈 · 蓝绿白主色 · 毛玻璃浮窗 · extralight 字重 + 宽字距 · 五段流动渐变背景 · 安静呼吸感。
2. 仅使用语义 token（§2 表），禁写具体色值 / 字号像素；色值由 globals.css CSS Variables 承载。
3. 字体严格走 §3 字阶；默认 extralight (200)，仅在 body-strong / 按钮等场景上 400+。
4. 任何组件必须配齐 default / hover / active / disabled / loading 5 态（参考 §4）。
5. 触控目标 ≥ 44×44pt；首页保持 M2 纯卡片浮窗模式（无导航栏 / 无 Tab，仅「我的」小圆点入口）；卡片用大圆角 + `radius/2xl` + 毛玻璃 + 白色细描边。
6. 禁用纯黑文字；禁用元素边框线（除卡片白色细描边）；侧栏 / 用户浮窗必须不透明。
7. 心情标签走 accent/mood-tag（治愈青）；日记 AI 回信卡片走 accent/diary-echo（紫粉渐变 + 固定「未来回音」标题）。
8. 任何 UI 改动须经过 §5 Do's & Don'ts 自检；不确定的组件 API 先 TODO 停止生成，向用户确认（宪法 §7 防幻觉）。
```

---

## 8. 变更记录

| 日期 | 变更摘要 | 操作人 |
|------|---------|--------|
| 2026-05-13 | 初稿；基于 5 条用户记忆（M1–M5）结构化沉淀已有 UI 共识；不引入新视觉决策 | AI（治理对齐） |
