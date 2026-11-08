import "server-only";
import { AuthError } from "./errors";

export const normalizeEmail = (email: string): string => email.trim().toLocaleLowerCase("en-US");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (normalized.length > 320 || !emailPattern.test(normalized)) {
    throw new AuthError("INVALID_INPUT", "请输入有效的邮箱地址。");
  }
  return normalized;
}

export function validateDisplayName(displayName: string): string {
  const value = displayName.trim();
  if (value.length < 1 || value.length > 80) {
    throw new AuthError("INVALID_INPUT", "昵称长度需为 1 到 80 个字符。");
  }
  return value;
}

export function validatePassword(password: string): string {
  if (password.length < 12 || password.length > 200) {
    throw new AuthError("INVALID_INPUT", "密码长度需为 12 到 200 个字符。");
  }
  return password;
}

export function requireSamePassword(password: string, confirmation: string): void {
  if (password !== confirmation) throw new AuthError("INVALID_INPUT", "两次输入的密码不一致。");
}

export function requireNonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new AuthError("INVALID_INPUT", `${label}不能为空。`);
  if (normalized.length > 500) throw new AuthError("INVALID_INPUT", `${label}过长。`);
  return normalized;
}
