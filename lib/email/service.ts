import "server-only";
import type { EmailPurpose } from "./config";

export type TransactionalEmail = {
  to: string;
  purpose: EmailPurpose;
  subject: string;
  text: string;
  html: string;
};

export interface EmailProvider {
  send(message: TransactionalEmail): Promise<void>;
}

export class EmailUnavailableError extends Error {
  readonly code = "EMAIL_UNAVAILABLE";

  constructor() {
    super("邮件服务暂时不可用，请稍后重试。");
    this.name = "EmailUnavailableError";
  }
}

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function assertSafeLink(link: string) {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new TypeError("Email link must be an absolute URL.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new TypeError("Email link must use HTTPS outside local development.");
  }
}

export async function sendAccountLink(
  provider: EmailProvider,
  input: { to: string; purpose: EmailPurpose; link: string },
): Promise<void> {
  assertSafeLink(input.link);
  const verification = input.purpose === "email-verification";
  const action = verification ? "验证邮箱" : "重置密码";
  const subject = `wikilog · ${action}`;
  const text = `请打开以下链接以${action}：\n${input.link}\n\n如果这不是你的操作，请忽略此邮件。`;
  const html = `<p>请打开以下链接以${action}：</p><p><a href="${escapeHtml(input.link)}">${action}</a></p><p>如果这不是你的操作，请忽略此邮件。</p>`;

  try {
    await provider.send({ to: input.to, purpose: input.purpose, subject, text, html });
  } catch {
    throw new EmailUnavailableError();
  }
}
