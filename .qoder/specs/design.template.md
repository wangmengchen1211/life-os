# Design 模板（项目设计规范）

> **使用方式**：每个项目复制本模板为 `.qoder/specs/<project>-design.md`，逐字段填写。**首次涉及 UI 改动前必须实例化**（宪法 §7「UI 设计强制对齐」）。
> **参考**：[awesome-design-md](https://github.com/VoltAgent/awesome-design-md)。
> **依据**：[`.qoder/constitution.md`](../constitution.md) §7。

---

## 1. 基调（一句话氛围）

> 一句话锁定整体气质，后续所有 token / 字阶 / 组件态都向此句对齐。

例：`极简留白 + 暖灰底色 + 微弱噪点纸感，强调内容呼吸感与情绪平和。`

候选氛围词参考：极简 / 赛博 / 拟物 / 新拟态 / 玻璃拟态 / 杂志风 / 复古胶片 / 涂鸦 / 暗黑工程感 / ……

---

## 2. Design Tokens（**仅写语义名，不写色值/具体数值**）

> 为什么不写色值：色值由实现层（Tailwind config / CSS 变量 / 主题文件）承载，本表只锁语义。这样换色不动 design.md。

### 2.1 颜色语义

| 语义名 | 用途 |
|--------|------|
| `bg/canvas` | 全局画布底色 |
| `bg/surface` | 卡片 / 浮层底色 |
| `bg/elev-1` `bg/elev-2` | 多层级浮起 |
| `fg/primary` | 主文字 |
| `fg/secondary` | 次要文字 |
| `fg/muted` | 弱化文字 / 占位 |
| `accent/primary` | 主动作色 |
| `accent/danger` | 危险 / 销毁动作 |
| `accent/success` | 成功反馈 |
| `accent/warning` | 警告反馈 |
| `border/subtle` `border/strong` | 边框 |

### 2.2 间距语义
- `space/xs` `space/sm` `space/md` `space/lg` `space/xl` `space/2xl`

### 2.3 圆角与阴影语义
- 圆角：`radius/sm` `radius/md` `radius/lg` `radius/full`
- 阴影：`shadow/elev-1` `shadow/elev-2` `shadow/focus`

### 2.4 动效语义
- `motion/instant`（≤80ms）
- `motion/fast`（120ms）
- `motion/standard`（200ms）
- `motion/emphasized`（320ms，仅强调反馈）

---

## 3. 字体阶梯（完整字阶表）

| 角色 | 用途 | 字号语义 | 行高语义 | 字重 |
|------|------|---------|---------|------|
| display | 大标题 / 启动页 | `text/display` | `leading/display` | 700 |
| h1 | 页面主标题 | `text/h1` | `leading/h1` | 700 |
| h2 | 模块标题 | `text/h2` | `leading/h2` | 600 |
| h3 | 卡片标题 | `text/h3` | `leading/h3` | 600 |
| h4 | 次级标题 | `text/h4` | `leading/h4` | 500 |
| body | 正文 | `text/body` | `leading/body` | 400 |
| body-strong | 正文加重 | `text/body` | `leading/body` | 600 |
| caption | 辅助说明 | `text/caption` | `leading/caption` | 400 |
| code | 代码片段 | `text/code` | `leading/code` | 400 (mono) |

> 字号 / 行高的具体像素由实现层决定，本表只锁语义与角色。

---

## 4. 组件 5 态规范

> 每个核心组件**必须**列出 5 态：default / hover / active / disabled / loading。
> 列出本项目实际使用的核心组件（按需扩充）。

### 4.1 Button（主按钮）

| 状态 | bg | fg | border | shadow | 备注 |
|------|----|----|--------|--------|------|
| default | `accent/primary` | `fg/on-accent` | none | `shadow/elev-1` | |
| hover | `accent/primary` 提亮 | 同上 | none | `shadow/elev-2` | `motion/fast` |
| active | `accent/primary` 压暗 | 同上 | none | inset | |
| disabled | `bg/elev-1` | `fg/muted` | none | none | 无指针 |
| loading | `accent/primary` | spinner | none | `shadow/elev-1` | 文案隐藏，spinner 占位 |

### 4.2 Input
| 状态 | … | … | … | … | 备注 |
|------|----|----|----|----|------|

### 4.3 Card
| 状态 | … | … | … | … | 备注 |
|------|----|----|----|----|------|

### 4.4 Modal / Dialog
| 状态 | … | … | … | … | 备注 |
|------|----|----|----|----|------|

> 其余组件按项目实际补充。

---

## 5. Do's & Don'ts（正反例对照）

### 5.1 Do's
- 优先使用语义 token，禁止硬编码色值。
- 标题与正文之间至少留 `space/md` 呼吸。
- 危险动作必须配合二次确认。

### 5.2 Don'ts
- 不要在 UI 代码里写 `#FF6600` 等具体色值，必须走 token。
- 不要使用未在本文件登记的组件库 API（防幻觉，宪法 §7）。
- 不要在 modal 中嵌套另一个 modal。

---

## 6. 响应式

### 6.1 断点（语义）
| 断点 | 含义 | 典型设备 |
|------|------|---------|
| `bp/sm` | 手机竖屏 | < 640px |
| `bp/md` | 平板 / 手机横屏 | 640–1024px |
| `bp/lg` | 桌面 | 1024–1440px |
| `bp/xl` | 大屏 | ≥ 1440px |

### 6.2 触控目标
- 最小可点击尺寸：44×44pt（移动端）。
- 相邻触控目标间距 ≥ `space/sm`。

### 6.3 折叠策略
- 主导航：`bp/md` 以下折叠为抽屉。
- 多列卡片：`bp/sm` 单列、`bp/md` 双列、`bp/lg` 三列起。
- 长文本：`bp/sm` 强制单列阅读宽度，禁止横向溢出。

---

## 7. Prompt Guide（即插即用的 AI 设计指令）

> 把以下片段复制到 AI 对话，可快速对齐本项目设计语言。

```
请遵循 .qoder/specs/<project>-design.md 设计规范：
1. 基调：<填入 §1 一句话>
2. 仅使用语义 token（§2 表），禁写具体色值。
3. 字体严格走 §3 字阶表。
4. 任何组件必须配齐 default/hover/active/disabled/loading 5 态。
5. 触控目标 ≥ 44×44pt，断点遵循 §6。
6. 不确定的组件 API 先 TODO，停止生成，向我确认。
```

---

## 8. 变更记录

| 日期 | 变更摘要 | 操作人 |
|------|---------|--------|
| YYYY-MM-DD | 初稿 | |
