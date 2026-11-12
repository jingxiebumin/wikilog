import "server-only";
import type { Session } from "@/lib/auth/types";
import { AuthError } from "@/lib/auth/errors";
import { ArticleSourceError, parseArticleSource } from "./parser";
import { getArticleCategories, listAdminArticles, publishArticleVersion, saveArticleDraft, setArticleVisibility } from "./repository";

const requireAdmin = (actor: Session) => {
  if (actor.role !== "admin" || actor.status !== "active") throw new AuthError("FORBIDDEN", "没有访问权限。");
};

export async function adminArticleList(actor: Session) {
  requireAdmin(actor);
  return listAdminArticles();
}

export async function adminUploadArticle(actor: Session, source: string) {
  requireAdmin(actor);
  if (Buffer.byteLength(source, "utf8") > 1024 * 1024) throw new AuthError("INVALID_INPUT", "MDX 文件不能超过 1 MB。");
  const categories = await getArticleCategories();
  let parsed;
  try {
    parsed = parseArticleSource(source, categories);
  } catch (error) {
    if (error instanceof ArticleSourceError) throw new AuthError("INVALID_INPUT", error.message);
    throw error;
  }
  await saveArticleDraft({ ...parsed, sourceMdx: source }, actor.id);
}

export async function adminPublishArticle(actor: Session, versionId: string) {
  requireAdmin(actor);
  await publishArticleVersion(versionId, actor.id);
}

export async function adminChangeArticleVisibility(actor: Session, slug: string, action: "hide" | "delete" | "restore") {
  requireAdmin(actor);
  await setArticleVisibility(slug, action, actor.id);
}
