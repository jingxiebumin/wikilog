import "server-only";
import type { Session } from "@/lib/auth/types";
import { AuthError } from "@/lib/auth/errors";
import { ArticleSourceError, parseArticleForm } from "./parser";
import { findArticleImageAccess } from "./repository";
import { findCurrentArticle, getArticleCategories, getArticleFormOptions, listAdminArticles, listCurrentArticles, saveCurrentArticle, setArticleVisibility, type ArticleListOptions } from "./repository";

const requireAdmin = (actor: Session) => {
  if (actor.role !== "admin" || actor.status !== "active") throw new AuthError("FORBIDDEN", "没有访问权限。");
};

export async function adminArticleList(actor: Session) {
  requireAdmin(actor);
  return listAdminArticles();
}

export async function adminCurrentArticleList(actor: Session, options?: ArticleListOptions) {
  requireAdmin(actor);
  return listCurrentArticles(options);
}

export async function adminArticleFormOptions(actor: Session) {
  requireAdmin(actor);
  return getArticleFormOptions();
}

export async function adminCurrentArticle(actor: Session, id: string) {
  requireAdmin(actor);
  return findCurrentArticle(id);
}

export async function adminSaveCurrentArticle(actor: Session, input: {
  id?: string; title: string; summary?: string; category: string; tags?: string[]; publishedAt: string;
  source?: string; sourceFilename?: string;
}) {
  requireAdmin(actor);
  if (input.id && input.source === undefined) {
    const existing = await findCurrentArticle(input.id);
    if (!existing) throw new AuthError("NOT_FOUND", "文章不存在。");
    input = { ...input, source: existing.sourceMdx, sourceFilename: existing.sourceFilename };
  }
  if (!input.source || !input.sourceFilename) throw new AuthError("INVALID_INPUT", "请选择 Markdown 正文文件。");
  try {
    const categories = await getArticleCategories();
    const parsed = parseArticleForm(input.source, input, categories);
    return await saveCurrentArticle({ ...parsed, sourceMdx: input.source, sourceFilename: input.sourceFilename, articleId: input.id }, actor.id);
  } catch (error) {
    if (error instanceof ArticleSourceError) throw new AuthError("INVALID_INPUT", error.message);
    throw error;
  }
}

export async function canReadArticleImage(storageKey: string, isAdmin: boolean): Promise<boolean> {
  const access = await findArticleImageAccess(storageKey);
  return Boolean(access && (access.published || isAdmin));
}

export async function adminChangeArticleVisibility(actor: Session, slug: string, action: "hide" | "delete" | "restore") {
  requireAdmin(actor);
  await setArticleVisibility(slug, action, actor.id);
}
