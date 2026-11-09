"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/password-input";

const passwordError = (value: string) => value.length < 9 ? "密码至少需要 9 位。" : value.length > 200 ? "密码不能超过 200 位。" : "";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [passwordFieldError, setPasswordFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = passwordError(password);
    setPasswordFieldError(validationError);
    if (!email || validationError) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await jsonRequest("/api/auth/login", { email, password });
      router.push(result.user?.passwordResetRequired ? "/account/password" : "/account");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录无法完成，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <FormError message={error} />
      <label className="form-field" htmlFor="login-email"><span>邮箱</span><input id="login-email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required type="email" value={email} /></label>
      <PasswordInput autoComplete="current-password" error={passwordFieldError} label="密码" name="password" onBlur={() => setPasswordFieldError(passwordError(password))} onChange={(event) => setPassword(event.target.value)} placeholder="至少 9 位密码" required value={password} />
      <button disabled={submitting} type="submit">{submitting ? "登录中…" : "登录"}</button>
    </form>
  );
}

export function RegisterForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(initialError);
  const [passwordFieldError, setPasswordFieldError] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validateConfirmation = () => confirmation && password !== confirmation ? "两次输入的密码不一致。" : "";
  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextPasswordError = passwordError(password);
    const nextConfirmationError = validateConfirmation();
    setPasswordFieldError(nextPasswordError);
    setConfirmationError(nextConfirmationError);
    if (!displayName || !email || nextPasswordError || nextConfirmationError) return;
    setSubmitting(true);
    setError("");
    try {
      await jsonRequest("/api/auth/register", { displayName, email, password, confirmation });
      router.push("/account");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "注册无法完成，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <FormError message={error} />
      <label className="form-field" htmlFor="register-display-name"><span>昵称</span><input id="register-display-name" maxLength={80} name="displayName" onChange={(event) => setDisplayName(event.target.value)} placeholder="怎么称呼你" required value={displayName} /></label>
      <label className="form-field" htmlFor="register-email"><span>邮箱</span><input id="register-email" maxLength={320} name="email" onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required type="email" value={email} /></label>
      <PasswordInput autoComplete="new-password" error={passwordFieldError} label="密码" name="password" minLength={9} onBlur={() => setPasswordFieldError(passwordError(password))} onChange={(event) => setPassword(event.target.value)} placeholder="至少 9 位密码" required value={password} />
      <PasswordInput autoComplete="new-password" error={confirmationError} label="确认密码" name="confirmation" onBlur={() => setConfirmationError(validateConfirmation())} onChange={(event) => { setConfirmation(event.target.value); setConfirmationError(""); }} placeholder="再次输入密码" required value={confirmation} />
      <button disabled={submitting} type="submit">{submitting ? "创建中…" : "创建读者账号"}</button>
    </form>
  );
}

export function PasswordForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(initialError);
  const [passwordFieldError, setPasswordFieldError] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const validateConfirmation = () => confirmation && password !== confirmation ? "两次输入的密码不一致。" : "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextPasswordError = passwordError(password);
    const nextConfirmationError = validateConfirmation();
    setPasswordFieldError(nextPasswordError);
    setConfirmationError(nextConfirmationError);
    if (!currentPassword || nextPasswordError || nextConfirmationError) return;
    setSubmitting(true);
    setError("");
    try {
      await jsonRequest("/api/auth/password", { currentPassword, password, confirmation });
      router.push("/account");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "密码修改无法完成，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <FormError message={error} />
      <PasswordInput autoComplete="current-password" label="当前密码" name="currentPassword" onChange={(event) => setCurrentPassword(event.target.value)} placeholder="输入当前密码" required value={currentPassword} />
      <PasswordInput autoComplete="new-password" error={passwordFieldError} label="新密码" name="password" minLength={9} onBlur={() => setPasswordFieldError(passwordError(password))} onChange={(event) => setPassword(event.target.value)} placeholder="至少 9 位密码" required value={password} />
      <PasswordInput autoComplete="new-password" error={confirmationError} label="确认新密码" name="confirmation" onBlur={() => setConfirmationError(validateConfirmation())} onChange={(event) => { setConfirmation(event.target.value); setConfirmationError(""); }} placeholder="再次输入新密码" required value={confirmation} />
      <button disabled={submitting} type="submit">{submitting ? "保存中…" : "保存密码"}</button>
    </form>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
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
    <form className="account-form" onSubmit={submit}>
      <FormError message={error} />
      <label className="form-field" htmlFor="current-email"><span>当前邮箱</span><input id="current-email" readOnly value={currentEmail} /></label>
      <PasswordInput autoComplete="current-password" label="当前密码" name="currentPassword" onChange={(event) => setCurrentPassword(event.target.value)} placeholder="输入当前密码" required value={currentPassword} />
      <label className="form-field" htmlFor="new-email"><span>新邮箱</span><input id="new-email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="new-name@example.com" required type="email" value={email} /></label>
      <button disabled={submitting} type="submit">{submitting ? "保存中…" : "保存邮箱"}</button>
    </form>
  );
}
