import "server-only";
import { AuthError } from "@/lib/auth/errors";
import type { SaveWikiPageDraftInput } from "./repository";

type JsonObject = Record<string, unknown>;

export async function readWikiJson(request: Request): Promise<JsonObject> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AuthError("INVALID_INPUT", "请求内容无效。");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthError("INVALID_INPUT", "请求内容无效。");
  }
  return value as JsonObject;
}

export function parseWikiDraftInput(value: JsonObject, slug = value.slug): SaveWikiPageDraftInput {
  if (
    typeof slug !== "string" ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    !Array.isArray(value.sourceArticleVersionIds) ||
    !value.sourceArticleVersionIds.every((id) => typeof id === "string") ||
    !Array.isArray(value.relatedSlugs) ||
    !value.relatedSlugs.every((relatedSlug) => typeof relatedSlug === "string")
  ) {
    throw new AuthError("INVALID_INPUT", "请填写标题、正文、有效来源和相关页面。");
  }
  if (!slug.trim() || !value.title.trim() || !value.body.trim() || value.sourceArticleVersionIds.length === 0) {
    throw new AuthError("INVALID_INPUT", "请填写标题、正文并至少选择一个有效来源。");
  }
  return {
    slug: slug.trim(),
    title: value.title.trim(),
    body: value.body.trim(),
    sourceArticleVersionIds: value.sourceArticleVersionIds as string[],
    relatedSlugs: value.relatedSlugs as string[],
  };
}

export function parseWikiMergeInput(value: JsonObject) {
  if (typeof value.sourceSlug !== "string" || typeof value.targetSlug !== "string" || !value.sourceSlug.trim() || !value.targetSlug.trim()) {
    throw new AuthError("INVALID_INPUT", "请选择要合并的两个 Wiki 页面。");
  }
  return { sourceSlug: value.sourceSlug.trim(), targetSlug: value.targetSlug.trim() };
}
