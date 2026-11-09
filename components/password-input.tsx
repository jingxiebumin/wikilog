"use client";

import { Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes, FocusEventHandler } from "react";
import { useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
};

export function PasswordInput({ label, error, id, name, onBlur, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? name;
  return (
    <label className="form-field" htmlFor={inputId}>
      <span>{label}</span>
      <span className="password-input-wrap">
        <input {...props} aria-describedby={error ? `${inputId}-error` : undefined} aria-invalid={Boolean(error)} id={inputId} name={name} onBlur={onBlur} type={visible ? "text" : "password"} />
        <button
          aria-label={visible ? "隐藏密码" : "显示密码"}
          className="password-visibility"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
        </button>
      </span>
      {error ? <span className="field-error" id={`${inputId}-error`} role="alert">{error}</span> : null}
    </label>
  );
}
