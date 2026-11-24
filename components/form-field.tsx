'use client';

import React, {
  ReactNode,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  forwardRef,
  ReactElement,
  cloneElement,
  isValidElement,
} from 'react';
import styles from './form-field.module.css';

interface FormFieldProps {
  label?: ReactNode;
  error?: string;
  help?: string;
  required?: boolean;
  children: ReactElement;
}

/**
 * 表单域包装组件，统一标签、错误提示、帮助文本的样式
 *
 * @example
 * <FormField label="邮箱" error={error} help="用于登录和通知">
 *   <input type="email" />
 * </FormField>
 */
export const FormField = forwardRef<
  HTMLDivElement,
  FormFieldProps
>(({ label, error, help, required = false, children }, ref) => {
  const childProps = (children as any)?.props || {};
  const id = childProps.id || childProps.name;
  const errorId = error ? `${id}-error` : undefined;
  const helpId = help ? `${id}-help` : undefined;

  return (
    <div ref={ref} className={styles.field}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-label="required">*</span>}
        </label>
      )}

      {/* 克隆子元素以添加 aria 属性 */}
      {isValidElement(children) &&
      children.type !== 'input' &&
      children.type !== 'textarea' &&
      children.type !== 'select'
        ? children
        : isValidElement(children)
        ? cloneElement(children as ReactElement<any>, {
            'aria-invalid': error ? 'true' : undefined,
            'aria-describedby': [errorId, helpId].filter(Boolean).join(' ') || undefined,
          })
        : null}

      {error && (
        <div id={errorId} className={styles.error} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            ⚠️
          </span>
          {error}
        </div>
      )}

      {help && !error && (
        <div id={helpId} className={styles.help}>
          {help}
        </div>
      )}
    </div>
  );
});

FormField.displayName = 'FormField';

/**
 * 密码输入字段（带显示/隐藏按钮）
 */
interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const PasswordInput = forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ label, error, ...props }, ref) => {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <FormField label={label} error={error}>
      <div className={styles.passwordWrapper}>
        <input
          ref={ref}
          type={isVisible ? 'text' : 'password'}
          autoComplete="current-password"
          {...props}
        />
        <button
          type="button"
          className={styles.visibilityToggle}
          onClick={() => setIsVisible(!isVisible)}
          aria-label={isVisible ? '隐藏密码' : '显示密码'}
          aria-pressed={isVisible}
        >
          {isVisible ? '👁️' : '👁️‍🗨️'}
        </button>
      </div>
    </FormField>
  );
});

PasswordInput.displayName = 'PasswordInput';
