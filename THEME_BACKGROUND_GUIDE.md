# Wikilog 主题背景组件 - 集成指南

## 📋 概述

`ThemeBackground` 是一个 React 组件，提供完整的 Wikilog 主题视觉背景，包括：
- 蓝天 + 白云动画
- 绿草地（波浪形边界）
- 鹈鹕骑自行车循环动画
- 花朵和树木装饰元素

## 🚀 快速开始

### 1. 文件位置

```
app/
├── components/
│   └── ThemeBackground.tsx
└── styles/
    └── theme-background.module.css
```

### 2. 基础使用

```tsx
import { ThemeBackground } from '@/components/ThemeBackground';

export default function HomePage() {
  return (
    <main>
      <section>
        {/* 页面内容 */}
      </section>
      
      {/* 在页面底部使用 */}
      <ThemeBackground height={500} />
    </main>
  );
}
```

### 3. 组件 Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `height` | `number` | `520` | 容器高度（像素） |
| `animated` | `boolean` | `true` | 是否启用动画 |
| `className` | `string` | `''` | 自定义 CSS 类名 |

## 📐 响应式设计

组件已内置响应式支持，自动在不同设备上调整：

| 设备 | 宽度 | 高度 | 变化 |
|------|------|------|------|
| 桌面 | 1024px+ | 500-520px | 完整显示 |
| 平板 | 768-1024px | 300-350px | 缩小元素 |
| 手机 | 320-768px | 200-250px | 隐藏部分云和花 |
| 超小屏 | <320px | 150-200px | 只显示主要元素 |

## 🎨 颜色定制

如需修改颜色，编辑 `theme-background.module.css` 中的颜色变量：

```css
/* 天空颜色 */
.sky {
  background: linear-gradient(to bottom, #87ceeb 0%, #d8f0f9 50%, #e8f8fd 80%);
}

/* 草地颜色 */
.grass {
  background: linear-gradient(to bottom, #c8e6c9 0%, #a1d08f 85%, #9bc97a 100%);
}

/* 花朵颜色 */
.flowerPetal {
  background: #ff9800; /* 橙色 */
}

.flowerCenter {
  background: #ffd700; /* 金色 */
}
```

## ⚙️ 性能优化

### CSS 动画优化

组件使用 CSS 动画而非 JavaScript，性能开销极低：

- **白云漂浮**：20-30 秒循环，使用 `transform`
- **鹈鹕骑行**：12 秒循环，使用 `transform` 和 `left` 混合
- **脚踏板转圈**：0.8 秒循环，使用 `transform-origin` 实现

### 渲染优化

- 使用 CSS 伪元素创建白云，减少 DOM 节点
- SVG 内联优化，避免额外网络请求
- `will-change` 可选优化（如需要）

```css
.pelicanRider {
  will-change: transform;
}

.cloud1,
.cloud2,
.cloud3 {
  will-change: transform;
}
```

## ♿ 无障碍支持

### 已支持的无障碍特性

1. **语义标记**：使用 `role="img"` 和 `aria-label`
2. **动画减少**：`prefers-reduced-motion` 媒体查询支持
3. **色彩对比**：符合 WCAG AA 标准
4. **键盘导航**：不阻挡页面键盘交互

### 自定义无障碍标签

```tsx
<ThemeBackground 
  aria-label="Wikilog 主题背景：鹈鹕在蓝天白云下骑自行车"
/>
```

## 🔄 进阶用法

### 1. 禁用动画

```tsx
<ThemeBackground animated={false} />
```

### 2. 自定义高度

```tsx
<ThemeBackground height={300} />
```

### 3. 添加自定义类名

```tsx
<ThemeBackground className="my-custom-class" />
```

在 CSS 中覆盖：

```css
.myCustomClass {
  background: linear-gradient(...);
}
```

### 4. 条件渲染

```tsx
export default function HomePage() {
  const [showTheme, setShowTheme] = useState(true);

  return (
    <>
      {showTheme && <ThemeBackground height={400} />}
      <button onClick={() => setShowTheme(!showTheme)}>
        切换背景
      </button>
    </>
  );
}
```

## 🎬 动画详解

### 白云漂浮动画

```css
@keyframes drift {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(50px);
  }
}

.cloud1 { animation: drift 20s infinite ease-in-out; }
.cloud2 { animation: drift 25s infinite ease-in-out reverse; }
.cloud3 { animation: drift 30s infinite ease-in-out; }
```

### 鹈鹕骑行动画

```css
@keyframes ride {
  0% {
    left: -150px;
  }
  100% {
    left: calc(100% + 150px);
  }
}

.pelicanRider {
  animation: ride 12s infinite linear;
}
```

## 🖼️ 集成示例

### 作为页面底部装饰

```tsx
// app/page.tsx
import { ThemeBackground } from '@/components/ThemeBackground';

export default function HomePage() {
  return (
    <>
      <header>{/* 导航栏 */}</header>
      <main>{/* 主要内容 */}</main>
      <footer>
        <ThemeBackground height={450} />
        <div style={{ background: '#fff', padding: '20px' }}>
          <p>&copy; 2024 Wikilog. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
```

### 作为特定页面的背景

```tsx
// app/about/page.tsx
import { ThemeBackground } from '@/components/ThemeBackground';

export default function AboutPage() {
  return (
    <div style={{ position: 'relative' }}>
      <ThemeBackground height={500} />
      <div style={{ position: 'relative', zIndex: 10, padding: '40px' }}>
        <h1>关于我们</h1>
        <p>{/* 内容 */}</p>
      </div>
    </div>
  );
}
```

## 🐛 常见问题

### 1. 鹈鹕显示不完整

**原因**：容器高度不足或 viewBox 设置不当

**解决**：
```tsx
<ThemeBackground height={550} />
```

### 2. 动画不流畅

**原因**：浏览器性能或其他动画干扰

**解决**：
```css
.pelicanRider {
  will-change: transform;
}
```

### 3. 颜色与主题不匹配

**原因**：CSS 变量未同步

**解决**：编辑 `theme-background.module.css` 中的具体颜色值

### 4. 移动设备显示异常

**原因**：响应式断点不适配

**解决**：在 CSS 中调整媒体查询断点

## 📱 浏览器兼容性

| 浏览器 | 版本 | 支持 |
|--------|------|------|
| Chrome | 90+ | ✅ |
| Firefox | 88+ | ✅ |
| Safari | 14+ | ✅ |
| Edge | 90+ | ✅ |
| IE 11 | - | ❌ |

## 🔧 自定义扩展

### 修改鹈鹕颜色

编辑 `ThemeBackground.tsx` 中的 SVG 路径颜色：

```tsx
{/* 身体 */}
<ellipse cx="90" cy="60" rx="25" ry="32" fill="#f5e6d3" ... />
```

### 添加更多装饰元素

```tsx
{/* 新增小蝴蝶或蜜蜂 */}
<Butterfly />
<Bee />
```

### 季节主题切换

```tsx
interface ThemeBackgroundProps {
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
}

export const ThemeBackground: React.FC<ThemeBackgroundProps> = ({
  season = 'spring',
  ...
}) => {
  const seasonColors = {
    spring: { sky: '#87ceeb', grass: '#c8e6c9' },
    summer: { sky: '#00bfff', grass: '#90ee90' },
    autumn: { sky: '#ffa500', grass: '#daa520' },
    winter: { sky: '#b0e0e6', grass: '#f0f8ff' },
  };
  // ...
};
```

## 📚 相关文件

| 文件 | 描述 |
|------|------|
| `ThemeBackground.tsx` | React 组件主文件 |
| `theme-background.module.css` | 样式文件 |
| `THEME_DESIGN.md` | 设计规范文档 |

## 🤝 反馈和改进

如有问题或改进建议，请提交 Issue 或 Pull Request。

---

**最后更新**：2024 年
**组件版本**：1.0.0
**维护者**：Wikilog Team
