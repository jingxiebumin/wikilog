import "server-only";
import type { Session } from "@/lib/auth/types";
import { AuthError } from "@/lib/auth/errors";
import { addFavorite, hasFavorite, listFavoritesForUser, removeFavorite } from "./repository";

const requireReader = (session: Session) => {
  if (session.role !== "reader" || session.status !== "active" || session.passwordResetRequired) {
    throw new AuthError("FORBIDDEN", "没有访问权限。");
  }
};

export async function readerFavorites(session: Session) {
  requireReader(session);
  return listFavoritesForUser(session.id);
}

export async function readerHasFavorite(session: Session, slug: string) {
  requireReader(session);
  return hasFavorite(session.id, slug);
}

export async function readerAddFavorite(session: Session, slug: string) {
  requireReader(session);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new AuthError("INVALID_INPUT", "文章不存在或当前不可收藏。");
  try {
    return await addFavorite(session.id, slug);
  } catch (error) {
    if (error instanceof Error && error.message === "文章不存在或当前不可收藏。") {
      throw new AuthError("NOT_FOUND", error.message);
    }
    throw error;
  }
}

export async function readerRemoveFavorite(session: Session, slug: string) {
  requireReader(session);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new AuthError("INVALID_INPUT", "请求无法完成。");
  await removeFavorite(session.id, slug);
}
