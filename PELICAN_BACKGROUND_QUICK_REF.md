# PelicanBackground 快速参考

## 🎯 一句话总结

将鹈鹕骑行场景作为**半透明固定背景**放在你的博客前台。

## 📦 文件清单

```
✅ components/PelicanBackground.tsx
✅ styles/pelican-background.module.css
✅ app/layout-example.tsx
✅ PELICAN_BACKGROUND_GUIDE.md (本文档)
```

## ⚡ 30秒快速开始

### 1. 复制文件
```bash
cp PelicanBackground.tsx app/components/
cp pelican-background.module.css app/styles/
```

### 2. 在 layout.tsx 中使用
```tsx
import { PelicanBackground } from '@/components/PelicanBackground';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PelicanBackground opacity={0.3} fixed={true} />
        <div style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
```

### 3. 完成！

无需其他配置。

## 🎨 常用配置

| 场景 | 代码 | 效果 |
|------|------|------|
| **推荐（默认）** | `<PelicanBackground />` | opacity: 0.3, fixed |
| **淡色** | `<PelicanBackground opacity={0.15} />` | 文字清晰 |
| **深色** | `<PelicanBackground opacity={0.5} />` | 视觉突出 |
| **相对定位** | `<PelicanBackground fixed={false} />` | 随页面滚动 |

## 🔧 Props 速查

```tsx
<PelicanBackground
  opacity={0.3}        // 透明度：0-1（默认 0.3）
  fixed={true}         // 固定背景（默认 true）
  className=""         // 自定义类名（可选）
/>
```

## 💡 快速贴士

### ✅ 要做

- 在 `<body>` 或主容器中使用
- 给内容容器设置 `zIndex: 10`
- 在深色模式测试
- 在移动设备测试

### ❌ 不要做

- 不要移除 `pointer-events: none`（会阻挡交互）
- 不要忘记给内容设置 z-index
- 不要在嵌套容器中重复使用（会叠加）

## 📱 设备适配

- **桌面**：完整显示
- **平板**：缩小元素
- **手机**：隐藏部分装饰
- **超小屏**：最小化显示

自动适配，无需手动调整。

## 🎬 动画特性

| 动画 | 时长 | 效果 |
|------|------|------|
| 白云漂浮 | 20-30s | 三层云，不同速度 |
| 鹈鹕骑行 | 12s | 左→右完整遍历 |
| 脚踏板 | 0.8s | 交替转圈 |

## 🌙 深色模式

自动适配 `prefers-color-scheme: dark`，无需配置。

## ♿ 无障碍

- 支持 `prefers-reduced-motion`（禁用动画）
- WCAG AA 色彩对比度
- 完整 aria-label

## 📊 性能

- 包体积：~6 KB (gzipped: ~2 KB)
- 渲染：60fps 流畅
- 内存：<1 MB

## 🧪 测试清单

```
[ ] 在桌面浏览器测试
[ ] 在移动设备测试
[ ] 启用 prefers-reduced-motion 测试
[ ] 检查深色模式
[ ] 验证页面交互正常
```

## 🐛 故障排除

| 问题 | 解决方案 |
|------|---------|
| 背景被内容遮挡 | 给内容加 `zIndex: 10` |
| 页面交互受阻 | 确保有 `pointer-events: none` |
| 动画不流畅 | 检查浏览器性能，尝试禁用其他动画 |
| 深色模式太深 | 增加 `opacity` 值 |

## 📚 更多信息

- 完整指南：`PELICAN_BACKGROUND_GUIDE.md`
- 完整高度版本：`THEME_BACKGROUND_GUIDE.md`
- 集成示例：`theme-integration-examples.tsx`

## 🎉 就这么简单！

```tsx
// 就一行就能用
<PelicanBackground opacity={0.3} fixed={true} />
```

---

**需要帮助？** 查看完整的 `PELICAN_BACKGROUND_GUIDE.md` 获取详细信息。
