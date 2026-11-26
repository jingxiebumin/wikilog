/**
 * Wikilog 博客前台集成示例
 *
 * 这个文件展示了如何将 ThemeBackground 组件集成到博客前台中
 */

import React from 'react';
import { ThemeBackground } from '@/ThemeBackground';

/**
 * 博客首页示例 - ThemeBackground 作为底部装饰
 */
export function BlogHomePage() {
  return (
    <div className="blog-home">
      {/* 顶部导航 */}
      <header className="blog-header">
        <nav>
          <h1>🌿 Wikilog</h1>
          <ul>
            <li><a href="/">首页</a></li>
            <li><a href="/blog">博客</a></li>
            <li><a href="/about">关于</a></li>
          </ul>
        </nav>
      </header>

      {/* 主要内容区域 */}
      <main className="blog-main">
        <section className="hero">
          <h1>欢迎来到 Wikilog</h1>
          <p>一个简洁而优雅的知识库网站</p>
        </section>

        {/* 文章列表 */}
        <section className="articles">
          <h2>最新文章</h2>
          <article className="article-card">
            <h3>React 最佳实践</h3>
            <p>探讨如何编写高效和可维护的 React 代码...</p>
            <a href="/blog/1">阅读更多 →</a>
          </article>
          <article className="article-card">
            <h3>CSS 动画性能优化</h3>
            <p>详解如何使用 transform 和 will-change 优化动画性能...</p>
            <a href="/blog/2">阅读更多 →</a>
          </article>
        </section>
      </main>

      {/* 底部主题背景 */}
      <ThemeBackground height={500} />

      {/* 页脚 */}
      <footer className="blog-footer">
        <p>&copy; 2024 Wikilog. All rights reserved.</p>
        <p>Designed with 🦆 and ❤️</p>
      </footer>

      <style jsx>{`
        .blog-home {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .blog-header {
          background: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 20px 40px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .blog-header nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
        }

        .blog-header h1 {
          font-size: 24px;
          color: #548878;
          margin: 0;
        }

        .blog-header ul {
          display: flex;
          list-style: none;
          gap: 30px;
          padding: 0;
        }

        .blog-header a {
          text-decoration: none;
          color: #333;
          font-weight: 500;
          transition: color 0.3s;
        }

        .blog-header a:hover {
          color: #548878;
        }

        .blog-main {
          flex: 1;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          padding: 60px 40px;
        }

        .hero {
          text-align: center;
          margin-bottom: 60px;
        }

        .hero h1 {
          font-size: 48px;
          color: #202522;
          margin-bottom: 20px;
        }

        .hero p {
          font-size: 18px;
          color: #666;
        }

        .articles {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
        }

        .articles h2 {
          grid-column: 1 / -1;
          color: #548878;
          font-size: 28px;
          margin-bottom: 20px;
        }

        .article-card {
          background: #f9faf8;
          border-left: 4px solid #548878;
          padding: 20px;
          border-radius: 4px;
          transition: transform 0.3s, box-shadow 0.3s;
        }

        .article-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .article-card h3 {
          color: #202522;
          margin-top: 0;
        }

        .article-card p {
          color: #666;
          line-height: 1.6;
        }

        .article-card a {
          color: #548878;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s;
        }

        .article-card a:hover {
          color: #3d6056;
        }

        .blog-footer {
          background: #f9faf8;
          text-align: center;
          padding: 30px 20px;
          color: #666;
          border-top: 1px solid #e0e0e0;
        }

        .blog-footer p {
          margin: 5px 0;
        }

        @media (max-width: 768px) {
          .blog-header {
            padding: 15px 20px;
          }

          .blog-header nav {
            flex-direction: column;
            gap: 15px;
          }

          .blog-header ul {
            gap: 15px;
          }

          .blog-main {
            padding: 30px 20px;
          }

          .hero h1 {
            font-size: 32px;
          }

          .hero p {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * 博客文章页面示例 - ThemeBackground 在侧栏
 */
export function BlogPostPage() {
  return (
    <div className="blog-post">
      <header className="post-header">
        <h1>React 最佳实践</h1>
        <p>发布于 2024-01-15 | 阅读时间 5 分钟</p>
      </header>

      <div className="post-layout">
        <main className="post-content">
          <article>
            <h2>介绍</h2>
            <p>
              在过去的几年中，React 已经成为前端开发中最流行的库之一。
              本文将探讨如何编写高效和可维护的 React 代码...
            </p>

            <h2>最佳实践</h2>
            <ol>
              <li>使用函数式组件和 Hooks</li>
              <li>合理使用状态管理</li>
              <li>避免不必要的重渲染</li>
              <li>编写可测试的代码</li>
              <li>遵循命名规范</li>
            </ol>

            {/* 更多内容... */}
          </article>
        </main>

        <aside className="post-sidebar">
          <ThemeBackground height={400} />

          <div className="sidebar-widget">
            <h3>相关文章</h3>
            <ul>
              <li><a href="/blog/2">CSS 动画性能优化</a></li>
              <li><a href="/blog/3">TypeScript 入门指南</a></li>
              <li><a href="/blog/4">Web 性能优化</a></li>
            </ul>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .blog-post {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .post-header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 2px solid #548878;
          padding-bottom: 20px;
        }

        .post-header h1 {
          color: #202522;
          font-size: 36px;
          margin-bottom: 10px;
        }

        .post-header p {
          color: #999;
          font-size: 14px;
        }

        .post-layout {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 40px;
        }

        .post-content {
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .post-content h2 {
          color: #548878;
          margin-top: 30px;
          margin-bottom: 15px;
        }

        .post-content p,
        .post-content ol {
          color: #666;
          line-height: 1.8;
          margin-bottom: 15px;
        }

        .post-content li {
          margin-bottom: 10px;
        }

        .post-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .sidebar-widget {
          background: #f9faf8;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #548878;
        }

        .sidebar-widget h3 {
          color: #548878;
          margin-top: 0;
        }

        .sidebar-widget ul {
          list-style: none;
          padding: 0;
        }

        .sidebar-widget li {
          margin-bottom: 10px;
        }

        .sidebar-widget a {
          color: #548878;
          text-decoration: none;
          transition: color 0.3s;
        }

        .sidebar-widget a:hover {
          color: #3d6056;
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .post-layout {
            grid-template-columns: 1fr;
          }

          .post-header h1 {
            font-size: 24px;
          }

          .post-content {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * 关于页面示例 - 整页背景
 */
export function AboutPage() {
  return (
    <div className="about-page">
      <div className="background-wrapper">
        <ThemeBackground height={450} />
      </div>

      <div className="about-content">
        <section className="about-section">
          <h1>关于 Wikilog</h1>
          <p>
            Wikilog 是一个简洁而优雅的知识库网站，致力于分享高质量的技术文章和学习资源。
            我们相信知识应该被优雅地呈现，而不是被复杂的界面所淹没。
          </p>
        </section>

        <section className="about-section">
          <h2>设计理念</h2>
          <ul>
            <li>🎨 <strong>简洁美观</strong>：通过最小化设计传达信息</li>
            <li>📱 <strong>响应式设计</strong>：在所有设备上完美展示</li>
            <li>⚡ <strong>高性能</strong>：快速加载和流畅交互</li>
            <li>♿ <strong>可访问性</strong>：确保所有用户都能使用</li>
          </ul>
        </section>

        <section className="about-section">
          <h2>使用的技术栈</h2>
          <div className="tech-stack">
            <span className="tech-tag">React</span>
            <span className="tech-tag">Next.js</span>
            <span className="tech-tag">TypeScript</span>
            <span className="tech-tag">Tailwind CSS</span>
            <span className="tech-tag">Vercel</span>
          </div>
        </section>
      </div>

      <style jsx>{`
        .about-page {
          min-height: 100vh;
          background: white;
        }

        .background-wrapper {
          position: relative;
          margin-bottom: -100px;
          z-index: 1;
        }

        .about-content {
          position: relative;
          z-index: 10;
          max-width: 800px;
          margin: 0 auto;
          padding: 60px 40px 40px;
          background: white;
        }

        .about-section {
          margin-bottom: 50px;
        }

        .about-section h1 {
          color: #202522;
          font-size: 42px;
          margin-bottom: 20px;
        }

        .about-section h2 {
          color: #548878;
          font-size: 28px;
          margin-bottom: 20px;
        }

        .about-section p {
          color: #666;
          font-size: 16px;
          line-height: 1.8;
          margin-bottom: 15px;
        }

        .about-section ul {
          list-style: none;
          padding: 0;
        }

        .about-section li {
          color: #666;
          font-size: 16px;
          line-height: 1.8;
          margin-bottom: 15px;
          padding-left: 20px;
          position: relative;
        }

        .about-section li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 8px;
          width: 6px;
          height: 6px;
          background: #548878;
          border-radius: 50%;
        }

        .about-section strong {
          color: #202522;
        }

        .tech-stack {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .tech-tag {
          display: inline-block;
          background: #f0f4f1;
          color: #548878;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          border: 1px solid #548878;
        }

        @media (max-width: 768px) {
          .about-section h1 {
            font-size: 28px;
          }

          .about-section h2 {
            font-size: 20px;
          }

          .about-content {
            padding: 40px 20px 20px;
          }
        }
      `}</style>
    </div>
  );
}

export default BlogHomePage;
