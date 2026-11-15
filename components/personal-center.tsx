"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CircleUserRound } from "lucide-react";
import { EmailForm, PasswordForm } from "@/components/account-forms";

type Profile = {
  id: string;
  email: string;
  displayName: string;
  role: "reader" | "admin";
  phone: string | null;
  gender: "male" | "female" | "other" | "undisclosed" | null;
  introduction: string | null;
  createdAt: string | Date;
  avatarKey: string | null;
};

type Tab = "basic" | "email" | "password";
const genderLabels: Record<NonNullable<Profile["gender"]>, string> = {
  male: "男",
  female: "女",
  other: "其他",
  undisclosed: "不愿透露",
};

export function PersonalCenter({ initialProfile, activeTab = "basic", forcePasswordChange = false }: { initialProfile: Profile; activeTab?: Tab; forcePasswordChange?: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [tab, setTab] = useState<Tab>(activeTab);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [phone, setPhone] = useState(initialProfile.phone ?? "");
  const [gender, setGender] = useState(initialProfile.gender ?? "");
  const [introduction, setIntroduction] = useState(initialProfile.introduction ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File>();
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  async function saveBasics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, phone, gender, introduction }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; profile?: Profile };
      if (!response.ok || !result.profile) throw new Error(result.error ?? "资料保存失败，请稍后重试。");
      setProfile(result.profile);
      setDisplayName(result.profile.displayName);
      setPhone(result.profile.phone ?? "");
      setGender(result.profile.gender ?? "");
      setIntroduction(result.profile.introduction ?? "");
      setNotice("基本信息已保存。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "资料保存失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  function resetBasics() {
    setDisplayName(profile.displayName);
    setPhone(profile.phone ?? "");
    setGender(profile.gender ?? "");
    setIntroduction(profile.introduction ?? "");
    setError("");
    setNotice("");
  }

  function closeAvatarDialog() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview("");
    setAvatarFile(undefined);
    setAvatarError("");
    setAvatarOpen(false);
  }

  async function uploadAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!avatarFile) return;
    setAvatarBusy(true);
    setAvatarError("");
    try {
      const form = new FormData();
      form.set("avatar", avatarFile);
      const response = await fetch("/api/auth/avatar", { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { error?: string; avatarKey?: string };
      if (!response.ok || !result.avatarKey) throw new Error(result.error ?? "头像上传失败。");
      setProfile((current) => ({ ...current, avatarKey: result.avatarKey ?? null }));
      closeAvatarDialog();
      router.refresh();
    } catch (caught) {
      setAvatarError(caught instanceof Error ? caught.message : "头像上传失败，请稍后重试。");
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <section className="personal-center">
      <aside className="personal-profile-summary">
        <button aria-label="更换头像" className="personal-avatar" onClick={() => setAvatarOpen(true)} type="button">
          {profile.avatarKey ? <Image alt="个人头像" height={104} src="/api/auth/avatar" unoptimized width={104} /> : <CircleUserRound aria-hidden="true" size={58} strokeWidth={1.2} />}
          <span aria-hidden="true">+</span>
        </button>
        <h2>{profile.displayName || "未设置昵称"}</h2>
        <dl>
          <div><dt>邮箱</dt><dd>{profile.email}</dd></div>
          <div><dt>手机号</dt><dd>{profile.phone || "-"}</dd></div>
          <div><dt>性别</dt><dd>{profile.gender ? genderLabels[profile.gender] : "-"}</dd></div>
          <div><dt>个人介绍</dt><dd className="personal-introduction">{profile.introduction || "-"}</dd></div>
          <div><dt>角色</dt><dd>{profile.role === "admin" ? "管理员" : "读者"}</dd></div>
          <div><dt>创建日期</dt><dd>{new Date(profile.createdAt).toLocaleDateString("zh-CN")}</dd></div>
        </dl>
      </aside>
      <div className="personal-profile-editor">
        {!forcePasswordChange ? <div aria-label="个人中心设置" className="personal-tabs" role="tablist">
          <button aria-selected={tab === "basic"} onClick={() => setTab("basic")} role="tab" type="button">基础信息</button>
          <button aria-selected={tab === "email"} onClick={() => setTab("email")} role="tab" type="button">修改邮箱</button>
          <button aria-selected={tab === "password"} onClick={() => setTab("password")} role="tab" type="button">修改密码</button>
        </div> : null}
        {tab === "basic" ? (
          <form className="account-form personal-profile-form" onSubmit={saveBasics}>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {notice ? <p className="account-notice" role="status">{notice}</p> : null}
            <label className="form-field" htmlFor="profile-display-name"><span>昵称</span><input id="profile-display-name" maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label>
            <label className="form-field" htmlFor="profile-phone"><span>手机号</span><input autoComplete="tel" id="profile-phone" onChange={(event) => setPhone(event.target.value)} placeholder="中国大陆 11 位号码或 + 国家区号" value={phone} /></label>
            <fieldset className="profile-gender-field"><legend>性别</legend>{([["male", "男"], ["female", "女"], ["other", "其他"], ["undisclosed", "不愿透露"]] as const).map(([value, label]) => <label key={value}><input checked={gender === value} name="gender" onChange={() => setGender(value)} type="radio" value={value} />{label}</label>)}</fieldset>
            <label className="form-field" htmlFor="profile-introduction"><span>个人介绍</span><textarea id="profile-introduction" maxLength={500} onChange={(event) => setIntroduction(event.target.value)} rows={5} value={introduction} /></label>
            <div className="profile-form-actions"><button disabled={submitting} type="submit">{submitting ? "保存中…" : "保存"}</button><button className="button-secondary" disabled={submitting} onClick={resetBasics} type="button">重置</button></div>
          </form>
        ) : tab === "email" ? <EmailForm currentEmail={profile.email} /> : <PasswordForm requireDisplayName={forcePasswordChange && !profile.displayName} />}
      </div>
      {avatarOpen ? <dialog aria-labelledby="avatar-dialog-title" className="admin-reader-dialog avatar-dialog" open>
        <form className="account-form" onSubmit={uploadAvatar}>
          <h2 id="avatar-dialog-title">上传头像</h2>
          {avatarError ? <p className="form-error" role="alert">{avatarError}</p> : null}
          <div className="avatar-preview">{avatarPreview ? <Image alt="头像预览" height={132} src={avatarPreview} unoptimized width={132} /> : <CircleUserRound aria-hidden="true" size={58} />}</div>
          <label className="form-field"><span>JPEG、PNG 或 WebP，最大 5 MB</span><input accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            const file = event.target.files?.[0];
            if (avatarPreview) URL.revokeObjectURL(avatarPreview);
            setAvatarPreview("");
            setAvatarFile(undefined);
            if (!file) return;
            if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
              setAvatarError("请选择 5 MB 以内的 JPEG、PNG 或 WebP 图片。");
              return;
            }
            setAvatarError("");
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
          }} type="file" /></label>
          <div className="profile-form-actions"><button disabled={!avatarFile || avatarBusy} type="submit">{avatarBusy ? "上传中…" : "确认并上传"}</button><button className="button-secondary" disabled={avatarBusy} onClick={closeAvatarDialog} type="button">取消</button></div>
        </form>
      </dialog> : null}
    </section>
  );
}
