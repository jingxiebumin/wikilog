import "server-only";
import type { Session } from "@/lib/auth/types";
import { AuthError } from "@/lib/auth/errors";
import { ArticleSourceError, parseArticleSource } from "./parser";
import { removeOrQueueArticleImages, storeArticleImages, type ArticleImage } from "./image-storage";
import { findArticleImageAccess, getArticleCategories, listAdminArticles, publishArticleVersion, saveArticleDraft, setArticleVisibility } from "./repository";

const requireAdmin = (actor: Session) => {
  if (actor.role !== "admin" || actor.status !== "active") throw new AuthError("FORBIDDEN", "没有访问权限。");
};

export async function adminArticleList(actor: Session) {
  requireAdmin(actor);
  return listAdminArticles();
}

export async function adminUploadArticle(actor: Session, source: string, images: ArticleImage[] = []) {
  requireAdmin(actor);
  if (Buffer.byteLength(source, "utf8") > 1024 * 1024) throw new AuthError("INVALID_INPUT", "MDX 文件不能超过 1 MB。");
  const categories = await getArticleCategories();
  const storedImages = images.length ? await storeArticleImages(images) : [];
  try {
    const assetMap = Object.fromEntries(storedImages.map((image) => [image.name, image.key]));
    const parsed = parseArticleSource(source, categories, assetMap);
    await saveArticleDraft({ ...parsed, sourceMdx: source, images: storedImages }, actor.id);
  } catch (error) {
    await removeOrQueueArticleImages(storedImages.map(({ key }) => key));
    if (error instanceof ArticleSourceError) throw new AuthError("INVALID_INPUT", error.message);
    throw error;
  }
}

export async function canReadArticleImage(storageKey: string, isAdmin: boolean): Promise<boolean> {
  const access = await findArticleImageAccess(storageKey);
  return Boolean(access && (access.published || isAdmin));
}

export async function adminPublishArticle(actor: Session, versionId: string) {
  requireAdmin(actor);
  await publishArticleVersion(versionId, actor.id);
}

export async function adminChangeArticleVisibility(actor: Session, slug: string, action: "hide" | "delete" | "restore") {
  requireAdmin(actor);
  await setArticleVisibility(slug, action, actor.id);
}
