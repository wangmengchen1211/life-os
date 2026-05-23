# MindOS — 心智系统 设计规范

> 像写十四行诗一样排版文字，错落有致，有呼吸感。

---

## 1. Brand Identity

| 属性 | 值 |
|------|-----|
| 应用名 | MindOS — 心智系统 |
| 定位 | 安静写意的个人心智管理应用 |
| 设计哲学 | 诗意排版、治愈色调、呼吸留白 |
| 情绪关键词 | 安静、清透、错落、轻盈、写意 |

---

## 2. Color Palette

### 基础色

```css
:root {
  /* Primary — 柔和蓝绿 */
  --color-primary: #80cbc4;
  --color-primary-light: #b2dfdb;
  --color-primary-dark: #4db6ac;

  /* Background — 极浅暖白 */
  --color-bg: #fafaf8;
  --color-bg-alt: #f8f9fa;

  /* Surface — 白色微透 */
  --color-surface: rgba(255, 255, 255, 0.7);
  --color-surface-solid: #ffffff;

  /* Text */
  --color-text: #2d3748;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
}
```

### Accent Colors（低饱和度）

```css
:root {
  --accent-lavender: #b39ddb;   /* 日记回音 */
  --accent-mint: #80cbc4;       /* 思维藤蔓 */
  --accent-warm: #ffcc80;       /* Todo 轻约 */
}
```

### 情绪色系（极低饱和度）

```css
:root {
  --mood-serene: #b3d4e0;   /* 宁静蓝 */
  --mood-warm: #f0d9b5;     /* 柔暖 */
  --mood-green: #c8e6c9;    /* 微绿 */
  --mood-blush: #f8bbd0;    /* 淡粉 */
  --mood-mist: #d1c4e9;     /* 薄雾紫 */
}
```

### 禁止

- 任何饱和度 > 60% 的纯色
- 纯黑 `#000000` 作为文本色
- 高对比度撞色组合

---

## 3. Typography

### Font Stack

```css
font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
```

### 层级体系

| 层级 | 大小 | 字重 | 字距 | 用途 |
|------|------|------|------|------|
| h1 | 28–36px | 300 | 0.05em | 关键词、页面标题 |
| h2 | 20–24px | 400 | 0.02em | 副标题、模块名 |
| body | 15–16px | 400 | normal | 正文段落 |
| small | 13–14px | 400, italic | normal | 微词、注解、时间戳 |

### Tailwind 类映射

```html
<!-- h1 关键词 -->
<h1 class="text-3xl font-light tracking-wider text-gray-800">

<!-- h2 副标题 -->
<h2 class="text-xl font-normal tracking-wide text-gray-700">

<!-- 正文 -->
<p class="text-[15px] leading-[1.8] text-gray-600">

<!-- 微词注解 -->
<span class="text-sm italic text-gray-400 opacity-70">
```

### 排版规则

- 段落间距: `32–48px`（大量呼吸感）
- 行间距: `line-height: 1.8+`（宽松舒缓）
- 文字不强制居中，适当左对齐偏移
- 关键词加宽字间距 `tracking-wider / tracking-widest`
- 英文混排时保持自然断词

---

## 4. Spacing & Layout

### 基准网格

```
基础单位: 8px
```

| 场景 | 值 | Tailwind |
|------|-----|----------|
| 段落间距 | 32–48px | `space-y-8` / `space-y-12` |
| 组件内边距 | 20–32px | `p-5` / `p-8` |
| 页面边距 | 40–64px | `px-10` / `px-16` |
| 卡片间距 | 24px | `gap-6` |
| 圆角 | 12–16px | `rounded-xl` / `rounded-2xl` |

### 布局特征

- 大量留白，不填满空间
- 左右不对称（制造错落感）
- 仪表盘: 左 70% 文字区 + 右 30% 侧边栏

```html
<!-- 仪表盘主布局 -->
<div class="flex gap-8 max-w-[1200px] mx-auto px-10">
  <main class="w-[70%] space-y-12">...</main>
  <aside class="w-[30%] space-y-8">...</aside>
</div>
```

---

## 5. Components

### 卡片 Card

```html
<div class="bg-white/60 backdrop-blur-sm border border-black/5 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
  ...
</div>
```

关键属性:
- `background: rgba(255, 255, 255, 0.6)`
- `backdrop-filter: blur(8px)`
- `border: 1px solid rgba(0, 0, 0, 0.05)`
- `border-radius: 16px`
- `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04)`

### 按钮 Button

```html
<!-- 主按钮 -->
<button class="px-5 py-2.5 rounded-xl text-sm font-normal text-teal-700 bg-teal-50/80 hover:bg-teal-100/90 transition-colors duration-200">

<!-- 幽灵按钮 -->
<button class="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50/80 transition-colors duration-200">
```

### Tab 标签

```html
<!-- 底部细线指示器，无背景色切换 -->
<div class="border-b border-gray-100">
  <button class="pb-3 text-sm text-gray-800 border-b-2 border-teal-400">
    当前
  </button>
  <button class="pb-3 text-sm text-gray-400 hover:text-gray-600">
    其他
  </button>
</div>
```

### 浮窗 Modal

```html
<motion.div class="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
  <motion.div
    initial={{ opacity: 0, scale: 0.96, y: 8 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.98 }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    class="bg-white/90 backdrop-blur-md rounded-2xl p-8 max-w-lg w-full shadow-lg"
  >
    ...
  </motion.div>
</motion.div>
```

### 图标

- 库: `lucide-react`
- 尺寸: 18–20px
- 描边: `strokeWidth={1.5}`

```html
<Icon size={18} strokeWidth={1.5} class="text-gray-400" />
```

---

## 6. Motion & Animation

### 框架: Framer Motion

### 动效规范

| 场景 | 配置 |
|------|------|
| 元素进入 | `type: "spring", stiffness: 300, damping: 30` |
| 元素退出 | `ease: "easeOut", duration: 0.2` |
| 文字出现 | `y: 8 → 0, opacity: 0 → 1, duration: 0.4` |
| 页面切换 | `layout` 动画 |
| 悬浮反馈 | `scale: 1.02, duration: 0.15` |

### 常用 Variant

```tsx
// 渐入上移
const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 300, damping: 30 }
};

// 列表 stagger
const stagger = {
  animate: { transition: { staggerChildren: 0.06 } }
};
```

### 禁止

- 弹跳效果 (bounce)
- 闪烁 / 脉冲动画
- 位移 > 16px 的滑动
- duration > 600ms 的慢动效

---

## 7. Responsive Strategy

| 断点 | 宽度 | 策略 |
|------|------|------|
| Desktop (最佳) | ≥ 1024px | 双栏布局，侧边栏可见 |
| Tablet | 768–1023px | 侧边栏折叠为可展开面板 |
| Mobile | < 768px | 单栏，侧边栏变底部导航 |

- 设计方式: **Desktop-first**
- 最大内容宽度: `max-w-[1200px]`
- 移动端文字区全宽，保持呼吸间距

---

## 8. Do's and Don'ts

### Do's ✓

- 大量留白，让内容呼吸
- 文字错落有致，不死板对齐
- 色彩柔和、低饱和、治愈感
- 动效轻盈自然，如微风拂过
- 字间距宽松，阅读无压力
- 圆角柔和，边界温润

### Don'ts ✗

- 禁止高饱和度纯色（saturation > 60%）
- 禁止密集紧凑排版
- 禁止生硬等宽网格（严格 12 列）
- 禁止粗重边框（border > 1px）和深阴影
- 禁止突兀弹跳动效
- 禁止信息过载、一屏塞满内容
- 禁止纯黑文字和纯白无暖底背景
