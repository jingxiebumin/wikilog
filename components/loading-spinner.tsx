/**
 * 加载旋转动画组件
 * 显示 SVG 旋转圈或纯 CSS 加载动画，可选文字提示
 */

import styles from './loading-spinner.module.css';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  /**
   * 尺寸：sm (24px) | md (32px) | lg (48px)
   */
  size?: SpinnerSize;
  /**
   * 加载提示文字，如 "加载中…"
   */
  text?: string;
  /**
   * CSS 类名
   */
  className?: string;
  /**
   * 加载动画颜色，默认使用 CSS 变量 --green
   */
  color?: string;
}

const sizeMap: Record<SpinnerSize, string> = {
  sm: '24px',
  md: '32px',
  lg: '48px',
};

/**
 * 加载旋转动画组件
 * 使用 SVG 圆圈 + CSS 动画实现
 */
export function LoadingSpinner({
  size = 'md',
  text,
  className = '',
  color = 'var(--green)',
}: LoadingSpinnerProps) {
  const spinnerSize = sizeMap[size];

  return (
    <div
      className={`${styles.container} ${className}`.trim()}
      role="status"
      aria-label={text || '加载中'}
      aria-busy="true"
    >
      <svg
        className={styles.svg}
        style={{
          width: spinnerSize,
          height: spinnerSize,
          color,
        }}
        viewBox="0 0 50 50"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.2"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="31.4 94.2"
          strokeLinecap="round"
          className={styles.spinner}
        />
      </svg>

      {text && <p className={styles.text}>{text}</p>}
    </div>
  );
}

/**
 * 加载条组件
 * 显示进度条形式的加载动画
 */
export function LoadingBar({ indeterminate = true }: { indeterminate?: boolean }) {
  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : 50}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="加载进度"
    >
      <div
        className={indeterminate ? styles.barIndeterminate : styles.barDeterminate}
      />
    </div>
  );
}

/**
 * 点脉冲加载动画组件
 * 显示 3 个脉冲点
 */
export function LoadingDots({ text = '加载中' }: { text?: string }) {
  return (
    <div className={styles.dotsContainer} role="status" aria-label={text}>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
      {text && <span className={styles.dotsText}>{text}</span>}
    </div>
  );
}
