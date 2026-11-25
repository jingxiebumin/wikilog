'use client';

import React from 'react';
import styles from '@/app/styles/pelican-background.module.css';

interface PelicanBackgroundProps {
  /**
   * 背景透明度（0-1）
   * @default 0.3
   */
  opacity?: number;

  /**
   * 是否使用 fixed 定位（固定背景）
   * @default true
   */
  fixed?: boolean;

  /**
   * 自定义 className
   */
  className?: string;
}

/**
 * 鹈鹕骑行半透明背景组件
 *
 * 用于博客前台作为页面背景，支持透明度调节和固定/相对定位
 *
 * 使用示例：
 * 在 layout.tsx 中导入并使用
 * import { PelicanBackground } from '@/components/PelicanBackground';
 *
 * 然后在组件中添加：
 * PelicanBackground opacity={0.3} fixed={true}
 *
 * 或在特定页面中：
 * PelicanBackground opacity={0.2} fixed={false}
 */
export const PelicanBackground: React.FC<PelicanBackgroundProps> = ({
  opacity = 0.3,
  fixed = true,
  className = '',
}) => {
  const positionClass = fixed ? styles.fixed : styles.relative;

  return (
    <div
      className={`${styles.backgroundWrapper} ${positionClass} ${className}`}
      style={{ opacity: Math.max(0, Math.min(1, opacity)) }}
      role="img"
      aria-label="Wikilog 博客背景：蓝天白云下鹈鹕骑自行车"
    >
      {/* 天空背景 */}
      <div className={styles.sky} />

      {/* 白云 */}
      <div className={`${styles.cloud} ${styles.cloud1}`} />
      <div className={`${styles.cloud} ${styles.cloud2}`} />
      <div className={`${styles.cloud} ${styles.cloud3}`} />

      {/* 草地 */}
      <div className={styles.grass}>
        {/* 波浪形边界 */}
        <svg
          className={styles.waveBorder}
          viewBox="0 0 1200 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: '-50px', left: 0, width: '100%', height: '100px' }}
        >
          <path
            d="M0,50 Q75,20 150,50 T300,50 T450,50 T600,50 T750,50 T900,50 T1050,50 T1200,50 L1200,0 L0,0 Z"
            fill="#e8f8fd"
            opacity="0.6"
          />
          <path
            d="M0,55 Q100,30 200,55 T400,55 T600,55 T800,55 T1000,55 T1200,55 L1200,0 L0,0 Z"
            fill="#d8f0f9"
            opacity="0.4"
          />
        </svg>

        {/* 小花 */}
        <Flower className={`${styles.flower} ${styles.flower1}`} />
        <Flower className={`${styles.flower} ${styles.flower2}`} />
        <Flower className={`${styles.flower} ${styles.flower3}`} />
        <Flower className={`${styles.flower} ${styles.flower4}`} />

        {/* 小树 */}
        <Tree className={`${styles.tree} ${styles.tree1}`} />
        <Tree className={`${styles.tree} ${styles.tree2}`} />
      </div>

      {/* 鹈鹕骑自行车 */}
      <PelicanBicycle className={styles.pelicanRider} />
    </div>
  );
};

/**
 * 花朵组件
 */
const Flower: React.FC<{ className: string }> = ({ className }) => (
  <div className={className}>
    <div className={styles.flowerStem} />
    <div className={styles.flowerPetal} />
    <div className={styles.flowerPetal} />
    <div className={styles.flowerPetal} />
    <div className={styles.flowerCenter} />
  </div>
);

/**
 * 树木组件
 */
const Tree: React.FC<{ className: string }> = ({ className }) => (
  <div className={className}>
    <div className={styles.treeFoliage} />
    <div className={styles.treeTrunk} />
  </div>
);

/**
 * 鹈鹕骑自行车 SVG 组件
 */
const PelicanBicycle: React.FC<{ className: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="-20 -10 240 170"
    preserveAspectRatio="xMidYMid meet"
  >
    {/* 鹈鹕下的阴影 */}
    <ellipse cx="100" cy="135" rx="50" ry="8" fill="rgba(0,0,0,0.2)" />

    {/* 自行车 */}
    <g id="bicycle">
      {/* 自行车架（红色） */}
      <line x1="40" y1="100" x2="140" y2="100" stroke="#c41e3a" strokeWidth="5" strokeLinecap="round" />
      <line x1="140" y1="100" x2="160" y2="70" stroke="#c41e3a" strokeWidth="5" strokeLinecap="round" />
      <line x1="160" y1="70" x2="140" y2="100" stroke="#c41e3a" strokeWidth="5" strokeLinecap="round" />
      <line x1="80" y1="100" x2="80" y2="70" stroke="#c41e3a" strokeWidth="5" strokeLinecap="round" />

      {/* 后轮 */}
      <circle cx="40" cy="100" r="30" fill="none" stroke="#2b2b2b" strokeWidth="6" />
      <circle cx="40" cy="100" r="4" fill="#444" />
      {/* 轮辐 */}
      <g stroke="#777" strokeWidth="2" opacity="0.8">
        <line x1="40" y1="70" x2="40" y2="130" />
        <line x1="10" y1="100" x2="70" y2="100" />
        <line x1="20" y1="80" x2="60" y2="120" />
        <line x1="60" y1="80" x2="20" y2="120" />
      </g>

      {/* 前轮 */}
      <circle cx="160" cy="100" r="30" fill="none" stroke="#2b2b2b" strokeWidth="6" />
      <circle cx="160" cy="100" r="4" fill="#444" />
      {/* 轮辐 */}
      <g stroke="#777" strokeWidth="2" opacity="0.8">
        <line x1="160" y1="70" x2="160" y2="130" />
        <line x1="130" y1="100" x2="190" y2="100" />
        <line x1="140" y1="80" x2="180" y2="120" />
        <line x1="180" y1="80" x2="140" y2="120" />
      </g>

      {/* 脚踏板 */}
      <g stroke="#d6342c" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="80" cy="100" r="12" fill="none" stroke="#d6342c" strokeWidth="3" />
        <line x1="80" y1="88" x2="80" y2="68" />
        <line x1="92" y1="100" x2="112" y2="100" />
      </g>

      {/* 车把 */}
      <path d="M 160 70 Q 150 50 140 48" stroke="#2b2b2b" strokeWidth="6" fill="none" strokeLinecap="round" />
    </g>

    {/* 鹈鹕 */}
    <g id="pelican">
      {/* 身体 */}
      <ellipse cx="90" cy="60" rx="25" ry="32" fill="#f5e6d3" stroke="#2c3e50" strokeWidth="2.5" />

      {/* 翅膀（左侧） */}
      <ellipse cx="82" cy="60" rx="12" ry="20" fill="#e8d4b8" stroke="#2c3e50" strokeWidth="2" />

      {/* 颈部 */}
      <path d="M 95 32 Q 100 20 105 8" stroke="#f5e6d3" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M 95 32 Q 100 20 105 8" stroke="#2c3e50" strokeWidth="1" fill="none" />

      {/* 头 */}
      <circle cx="108" cy="4" r="14" fill="#f5e6d3" stroke="#2c3e50" strokeWidth="2.5" />

      {/* 眼睛 */}
      <circle cx="116" cy="2" r="4" fill="#1d1d1d" />
      <circle cx="117" cy="1" r="1.5" fill="#fff" />

      {/* 喙（嘴袋形） */}
      <g>
        {/* 上颚 */}
        <path d="M 120 6 L 170 2 Q 175 4 173 10 L 125 12 Q 122 10 120 10 Z" fill="#d4a574" stroke="#2c3e50" strokeWidth="1.5" />
        {/* 下颚袋 */}
        <ellipse cx="150" cy="15" rx="20" ry="10" fill="#d4a574" stroke="#2c3e50" strokeWidth="1.5" opacity="0.8" />
        {/* 嘴角线 */}
        <line x1="130" y1="12" x2="135" y2="22" stroke="#2c3e50" strokeWidth="1" />
        <line x1="170" y1="12" x2="168" y2="22" stroke="#2c3e50" strokeWidth="1" />
      </g>

      {/* 腿部 */}
      <g>
        <line x1="85" y1="90" x2="82" y2="110" stroke="#d4a574" strokeWidth="3" strokeLinecap="round" />
        <circle cx="82" cy="112" r="3" fill="#d4a574" />
      </g>

      <g>
        <line x1="95" y1="90" x2="98" y2="110" stroke="#d4a574" strokeWidth="3" strokeLinecap="round" />
        <circle cx="98" cy="112" r="3" fill="#d4a574" />
      </g>
    </g>
  </svg>
);

export default PelicanBackground;
