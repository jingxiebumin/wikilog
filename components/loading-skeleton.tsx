/**
 * 骨架屏组件
 * 用于内容加载过程中的占位符，支持多行配置和 pulse 动画
 */

import styles from './loading-skeleton.module.css';

interface LoadingSkeletonProps {
  /**
   * 骨架屏行数，默认 3
   */
  lines?: number;
  /**
   * 宽度，支持百分比或像素值，默认 100%
   */
  width?: string;
  /**
   * 高度，支持像素值或其他单位，默认 16px
   */
  height?: string;
  /**
   * 圆角大小，默认 3px
   */
  borderRadius?: string;
  /**
   * CSS 类名
   */
  className?: string;
  /**
   * 最后一行的宽度（通常小于 100%）
   */
  lastLineWidth?: string;
}

/**
 * 加载骨架屏组件
 * 显示多条 pulse 动画的骨架线条，模拟内容加载状态
 */
export function LoadingSkeleton({
  lines = 3,
  width = '100%',
  height = '16px',
  borderRadius = '3px',
  className = '',
  lastLineWidth = '80%',
}: LoadingSkeletonProps) {
  const skeletonLines = Array.from({ length: lines }, (_, i) => i);

  return (
    <div
      className={`${styles.wrapper} ${className}`.trim()}
      aria-busy="true"
      aria-label="加载中"
      role="status"
    >
      {skeletonLines.map((index) => (
        <div
          key={index}
          className={styles.line}
          style={{
            width: index === lines - 1 ? lastLineWidth : width,
            height,
            borderRadius,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 表格行骨架屏变体
 * 用于表格加载状态，更好地模拟行结构
 */
export function TableSkeletonRow({ columns = 4 }: { columns?: number }) {
  const cols = Array.from({ length: columns }, (_, i) => i);

  return (
    <div className={styles.tableRow} aria-busy="true" role="status">
      {cols.map((index) => (
        <div
          key={index}
          className={styles.tableCell}
          style={{
            height: '20px',
            borderRadius: '3px',
          }}
        />
      ))}
    </div>
  );
}

/**
 * 卡片骨架屏变体
 * 用于卡片列表加载状态
 */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  const cards = Array.from({ length: count }, (_, i) => i);

  return (
    <div className={styles.cardGrid}>
      {cards.map((index) => (
        <div
          key={index}
          className={styles.card}
          aria-busy="true"
          role="status"
        >
          {/* 顶部图片区域 */}
          <div
            className={styles.cardImage}
            style={{
              height: '160px',
              borderRadius: '4px',
            }}
          />
          {/* 标题 */}
          <div
            className={styles.line}
            style={{
              height: '20px',
              marginTop: '12px',
              width: '90%',
              borderRadius: '3px',
            }}
          />
          {/* 描述 */}
          <div
            className={styles.line}
            style={{
              height: '14px',
              marginTop: '8px',
              width: '100%',
              borderRadius: '3px',
            }}
          />
          <div
            className={styles.line}
            style={{
              height: '14px',
              marginTop: '8px',
              width: '70%',
              borderRadius: '3px',
            }}
          />
        </div>
      ))}
    </div>
  );
}
