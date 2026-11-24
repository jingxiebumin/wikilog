'use client';

import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react';
import styles from './button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: ReactNode;
}

/**
 * 统一的按钮组件
 *
 * @example
 * <Button variant="primary" size="md">保存</Button>
 * <Button variant="secondary" disabled>禁用</Button>
 * <Button variant="danger" size="sm">删除</Button>
 * <Button variant="ghost">取消</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        className={[
          styles.button,
          styles[`variant-${variant}`],
          styles[`size-${size}`],
          isDisabled && styles.disabled,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={isDisabled}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
