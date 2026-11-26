/**
 * Wikilog 博客前台主布局
 *
 * 展示如何在 layout.tsx 中集成 PelicanBackground 组件
 */

import type { Metadata } from 'next';
import { PelicanBackground } from '@/components/PelicanBackground';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Wikilog - 知识库',
  description: '一个简洁而优雅的知识库网站',
};

/**
 * 根布局组件
 *
 * 这里演示了两种集成 PelicanBackground 的方式：
 * 1. 固定背景（fixed）- 不随页面滚动
 * 2. 相对背景（relative）- 随页面滚动
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ position: 'relative', margin: 0, padding: 0 }}>
        {/*
          方式 1: 固定背景（推荐用于页面顶部装饰）
          fixed={true} - 背景固定在视口，不随页面滚动
          opacity={0.3} - 透明度 30%，适度显示背景细节
        */}
        <PelicanBackground opacity={0.3} fixed={true} />

        {/*
          页面内容
          所有内容都在背景之上显示
        */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>

        {/*
          页脚（可选）
          放在所有内容之后
        */}
      </body>
    </html>
  );
}

/**
 * ==========================================
 * 使用指南
 * ==========================================
 *
 * 1. 基础使用（固定背景）
 * ```tsx
 * <PelicanBackground opacity={0.3} fixed={true} />
 * ```
 *
 * 2. 半透明背景（更浅）
 * ```tsx
 * <PelicanBackground opacity={0.15} fixed={true} />
 * ```
 *
 * 3. 更深的背景
 * ```tsx
 * <PelicanBackground opacity={0.5} fixed={true} />
 * ```
 *
 * 4. 相对定位背景（随页面滚动）
 * ```tsx
 * <PelicanBackground opacity={0.3} fixed={false} />
 * ```
 *
 * 5. 自定义类名
 * ```tsx
 * <PelicanBackground opacity={0.3} className="my-custom-class" />
 * ```
 *
 * ==========================================
 * Props 说明
 * ==========================================
 *
 * opacity (number, default: 0.3)
 *   - 背景透明度，范围 0-1
 *   - 0 = 完全透明（不可见）
 *   - 1 = 完全不透明
 *   - 推荐值：0.15-0.5
 *
 * fixed (boolean, default: true)
 *   - true = 固定背景，使用 position: fixed
 *   - false = 相对背景，使用 position: absolute
 *
 * className (string, default: '')
 *   - 自定义 CSS 类名
 *   - 用于进一步定制样式
 *
 * ==========================================
 */
