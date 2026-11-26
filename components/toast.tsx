/**
 * Toast 通知组件
 * 支持 success/error/info/warning 四种类型，自动消失，支持手动关闭
 */

'use client';

import React, { useCallback, useContext, createContext, useState, useEffect } from 'react';
import styles from './toast.module.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  show: (type: ToastType, message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Toast 提供者组件
 * 应该在应用根部使用，管理全局 Toast 状态
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `toast-${Date.now()}`;
    const toast: ToastMessage = { id, type, message, duration };

    setToasts((prev) => [...prev, toast]);

    // 自动消失
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className={styles.container}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * 使用 Toast 的 hook
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

/**
 * 单个 Toast 组件
 */
interface ToastProps {
  type: ToastType;
  message: string;
  duration?: number;
  onClose: () => void;
}

function Toast({ type, message, duration = 3000, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300); // 动画时间
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '⚠️',
    info: 'ℹ️',
    warning: '⚡',
  };

  const closeHandler = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`${styles.toast} ${styles[`toast-${type}`]} ${
        isExiting ? styles.exiting : ''
      }`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className={styles.icon} aria-hidden="true">
        {icons[type]}
      </span>
      <span className={styles.message}>{message}</span>
      <button
        className={styles.close}
        onClick={closeHandler}
        aria-label="关闭提示"
        type="button"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * 便捷方法：显示成功提示
 */
export function showSuccessToast(message: string, duration = 3000) {
  return { type: 'success' as const, message, duration };
}

/**
 * 便捷方法：显示错误提示
 */
export function showErrorToast(message: string, duration = 3000) {
  return { type: 'error' as const, message, duration };
}

/**
 * 便捷方法：显示信息提示
 */
export function showInfoToast(message: string, duration = 3000) {
  return { type: 'info' as const, message, duration };
}

/**
 * 便捷方法：显示警告提示
 */
export function showWarningToast(message: string, duration = 3000) {
  return { type: 'warning' as const, message, duration };
}
