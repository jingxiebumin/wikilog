"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/password-input";

const passwordError = (value: string) => value.length < 9 ? "密码至少需要 9 位。" : value.length > 200 ? "密码不能超过 200 位。" : "";
const emailError = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "请输入邮箱。";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? "" : "请输入有效的邮箱地址。";
};
const displayNameError = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "请输入昵称。";
  return normalized.length > 80 ? "昵称不能超过 80 个字符。" : "";
};
const requiredError = (value: string, label: string) => value ? "" : `请输入${label}。`;
const confirmationError = (password: string, confirmation: string) => {
  if (!confirmation) return "请再次输入密码。";
  return password === confirmation ? "" : "两次输入的密码不一致。";
};
const formValue = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) ?? "");

const jsonRequest = async (url: string, body: Record<string, string>) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; user?: { passwordResetRequired?: boolean } };
  if (!response.ok) throw new Error(payload.error ?? "请求无法完成，请稍后重试。");
  return payload;
};

function FormError({ message }: { message: string }) {
  return message ? <p className="form-error" role="alert">{message}</p> : null;
}

export function LoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);
  const [emailFieldError, setEmailFieldError] = useState("");
  const [passwordFieldError, setPasswordFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = formValue(form, "email");
    const password = formValue(form, "password");
    const nextEmailError = emailError(email);
    const nextPasswordError = passwordError(password);
    setError("");
    setEmailFieldError(nextEmailError);
    setPasswordFieldError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;
    setSubmitting(true);
    try {
      const result = await jsonRequest("/api/auth/login", { email, password });
      router.replace(result.user?.passwordResetRequired ? "/account/password" : "/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录无法完成，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form autoComplete="on" className="account-form" onSubmit={submit}>
      <FormError message={error} />
      <label className="form-field" htmlFor="login-email"><span>邮箱</span><input aria-describedby={emailFieldError ? "login-email-error" : undefined} aria-invalid={Boolean(emailFieldError)} autoComplete="username" id="login-email" name="email" onBlur={(event) => setEmailFieldError(emailError(event.currentTarget.value))} onChange={() => setEmailFieldError("")} placeholder="name@example.com" required type="email" /></label>
      {emailFieldError ? <span className="field-error" id="login-email-error" role="alert">{emailFieldError}</span> : null}
      <PasswordInput autoComplete="current-password" error={passwordFieldError} label="密码" name="password" onBlur={(event) => setPasswordFieldError(passwordError(event.currentTarget.value))} onChange={() => setPasswordFieldError("")} placeholder="至少 9 位密码" required />
      <button disabled={submitting} type="submit">{submitting ? "登录中…" : "登录"}</button>
    </form>
  );
}

export function RegisterForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);
  const [displayNameFieldError, setDisplayNameFieldError] = useState("");
  const [emailFieldError, setEmailFieldError] = useState("");
  const [passwordFieldError, setPasswordFieldError] = useState("");
  const [confirmationFieldError, setConfirmationFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const displayName = formValue(form, "displayName");
    const email = formValue(form, "email");
    const password = formValue(form, "password");
    const confirmation = formValue(form, "confirmation");
    const nextDisplayNameError = displayNameError(displayName);
    const nextEmailError = emailError(email);
    const nextPasswordError = passwordError(password);
    const nextConfirmationError = confirmationError(password, confirmation);
    setError("");
    setDisplayNameFieldError(nextDisplayNameError);
    setEmailFieldError(nextEmailError);
    setPasswordFieldError(nextPasswordError);
    setConfirmationFieldError(nextConfirmationError);
    if (nextDisplayNameError || nextEmailError || nextPasswordError || nextConfirmationError) return;
    setSubmitting(true);
    try {
      await jsonRequest("/api/auth/register", { displayName, email, password, confirmation });
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "注册无法完成，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form autoComplete="on" className="account-form" onSubmit={submit}>
      <FormError message={error} />
      <label className="form-field" htmlFor="register-display-name"><span>昵称</span><input aria-describedby={displayNameFieldError ? "register-display-name-error" : undefined} aria-invalid={Boolean(displayNameFieldError)} id="register-display-name" maxLength={80} name="displayName" onBlur={(event) => setDisplayNameFieldError(displayNameError(event.currentTarget.value))} onChange={() => setDisplayNameFieldError("")} placeholder="怎么称呼您" required /></label>
      {displayNameFieldError ? <span className="field-error" id="register-display-name-error" role="alert">{displayNameFieldError}</span> : null}
      <label className="form-field" htmlFor="register-email"><span>邮箱</span><input aria-describedby={emailFieldError ? "register-email-error" : undefined} aria-invalid={Boolean(emailFieldError)} autoComplete="email" id="register-email" maxLength={320} name="email" onBlur={(event) => setEmailFieldError(emailError(event.currentTarget.value))} onChange={() => setEmailFieldError("")} placeholder="name@example.com" required type="email" /></label>
      {emailFieldError ? <span className="field-error" id="register-email-error" role="alert">{emailFieldError}</span> : null}
      <PasswordInput autoComplete="new-password" error={passwordFieldError} label="密码" name="password" minLength={9} onBlur={(event) => setPasswordFieldError(passwordError(event.currentTarget.value))} onChange={() => setPasswordFieldError("")} placeholder="至少 9 位密码" required />
      <PasswordInput autoComplete="new-password" error={confirmationFieldError} label="确认密码" name="confirmation" onBlur={(event) => { const password = formValue(event.currentTarget.form as HTMLFormElement, "password"); setConfirmationFieldError(confirmationError(password, event.currentTarget.value)); }} onChange={() => setConfirmationFieldError("")} placeholder="再次输入密码" required />
      <button disabled={submitting} type="submit">{submitting ? "创建中…" : "创建读者账号"}</button>
    </form>
  );
}

export function PasswordForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [passwordFieldError, setPasswordFieldError] = useState("");
  const [confirmationFieldError, setConfirmationFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = formValue(form, "currentPassword");
    const password = formValue(form, "password");
    const confirmation = formValue(form, "confirmation");
    const nextCurrentPasswordError = requiredError(currentPassword, "当前密码");
    const nextPasswordError = passwordError(password);
    const nextConfirmationError = confirmationError(password, confirmation);
    setError("");
    setCurrentPasswordError(nextCurrentPasswordError);
    setPasswordFieldError(nextPasswordError);
    setConfirmationFieldError(nextConfirmationError);
    if (nextCurrentPasswordError || nextPasswordError || nextConfirmationError) return;
    setSubmitting(true);
    try {
      await jsonRequest("/api/auth/password", { currentPassword, password, confirmation });
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "密码修改无法完成，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form autoComplete="on" className="account-form" onSubmit={submit}>
      <FormError message={error} />
      <PasswordInput autoComplete="current-password" error={currentPasswordError} label="当前密码" name="currentPassword" onBlur={(event) => setCurrentPasswordError(requiredError(event.currentTarget.value, "当前密码"))} onChange={() => setCurrentPasswordError("")} placeholder="输入当前密码" required />
      <PasswordInput autoComplete="new-password" error={passwordFieldError} label="新密码" name="password" minLength={9} onBlur={(event) => setPasswordFieldError(passwordError(event.currentTarget.value))} onChange={() => setPasswordFieldError("")} placeholder="至少 9 位密码" required />
      <PasswordInput autoComplete="new-password" error={confirmationFieldError} label="确认新密码" name="confirmation" onBlur={(event) => { const password = formValue(event.currentTarget.form as HTMLFormElement, "password"); setConfirmationFieldError(confirmationError(password, event.currentTarget.value)); }} onChange={() => setConfirmationFieldError("")} placeholder="再次输入新密码" required />
      <button disabled={submitting} type="submit">{submitting ? "保存中…" : "保存密码"}</button>
    </form>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [emailFieldError, setEmailFieldError] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = formValue(form, "email");
    const currentPassword = formValue(form, "currentPassword");
    const nextEmailError = emailError(email);
    const nextCurrentPasswordError = requiredError(currentPassword, "当前密码");
    setError("");
    setEmailFieldError(nextEmailError);
    setCurrentPasswordError(nextCurrentPasswordError);
    if (nextEmailError || nextCurrentPasswordError) return;
    setSubmitting(true);
    try {
      await jsonRequest("/api/auth/email", { currentPassword, email });
      router.push("/account");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "邮箱修改无法完成，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form autoComplete="on" className="account-form" onSubmit={submit}>
      <FormError message={error} />
      <label className="form-field" htmlFor="current-email"><span>当前邮箱</span><input id="current-email" readOnly value={currentEmail} /></label>
      <PasswordInput autoComplete="current-password" error={currentPasswordError} label="当前密码" name="currentPassword" onBlur={(event) => setCurrentPasswordError(requiredError(event.currentTarget.value, "当前密码"))} onChange={() => setCurrentPasswordError("")} placeholder="输入当前密码" required />
      <label className="form-field" htmlFor="new-email"><span>新邮箱</span><input aria-describedby={emailFieldError ? "new-email-error" : undefined} aria-invalid={Boolean(emailFieldError)} autoComplete="email" id="new-email" name="email" onBlur={(event) => setEmailFieldError(emailError(event.currentTarget.value))} onChange={() => setEmailFieldError("")} placeholder="new-name@example.com" required type="email" /></label>
      {emailFieldError ? <span className="field-error" id="new-email-error" role="alert">{emailFieldError}</span> : null}
      <button disabled={submitting} type="submit">{submitting ? "保存中…" : "保存邮箱"}</button>
    </form>
  );
}
