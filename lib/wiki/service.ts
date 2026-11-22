import "server-only";
import type { Session } from "@/lib/auth/types";
import { AuthError } from "@/lib/auth/errors";
import { enforceAdminManageRateLimit } from "@/lib/auth/admin-manage-rate-limit";
import type { RequestMeta } from "@/lib/auth/types";
import * as repository from "./repository";
import type { SaveWikiPageDraftInput } from "./repository";

type WikiRepository = Pick<typeof repository,
  | "listPublishedWikiPages"
  | "findPublishedWikiPage"
  | "searchPublishedWikiPages"
  | "listAdminWikiPages"
  | "getWikiPageHistory"
  | "saveWikiPageDraft"
  | "publishWikiPageVersion"
  | "mergeWikiPages"
>;

function requireAdmin(session: Session) {
  if (session.role !== "admin" || session.status !== "active" || session.passwordResetRequired) {
    throw new AuthError("FORBIDDEN", "没有访问权限。");
  }
}

export function createWikiService(wikiRepository: WikiRepository = repository) {
  return {
    listPublishedPages: () => wikiRepository.listPublishedWikiPages(),
    getPublishedPage: (slug: string) => wikiRepository.findPublishedWikiPage(slug),
    searchPublishedPages: (query: string, limit?: number) => wikiRepository.searchPublishedWikiPages(query, limit),
    async listAdminPages(session: Session) {
      requireAdmin(session);
      return wikiRepository.listAdminWikiPages();
    },
    async getPageHistory(session: Session, slug: string) {
      requireAdmin(session);
      return wikiRepository.getWikiPageHistory(slug);
    },
    async savePageDraft(session: Session, input: SaveWikiPageDraftInput, meta?: RequestMeta) {
      requireAdmin(session);
      await enforceAdminManageRateLimit(`wiki:${input.slug}`, meta?.ip ?? "unknown");
      return wikiRepository.saveWikiPageDraft(input, session.id);
    },
    async publishPageVersion(session: Session, pageId: string, versionId: string, meta?: RequestMeta) {
      requireAdmin(session);
      await enforceAdminManageRateLimit(`wiki:${pageId}`, meta?.ip ?? "unknown");
      return wikiRepository.publishWikiPageVersion(pageId, versionId, session.id);
    },
    async mergePages(session: Session, sourceSlug: string, targetSlug: string, meta?: RequestMeta) {
      requireAdmin(session);
      await enforceAdminManageRateLimit(`wiki:${targetSlug}`, meta?.ip ?? "unknown");
      return wikiRepository.mergeWikiPages(sourceSlug, targetSlug, session.id);
    },
  };
}

const wikiService = createWikiService();

export const listPublishedWikiPages = wikiService.listPublishedPages;
export const getPublishedWikiPage = wikiService.getPublishedPage;
export const searchPublishedWikiPages = wikiService.searchPublishedPages;
export const listAdminWikiPages = wikiService.listAdminPages;
export const getAdminWikiPageHistory = wikiService.getPageHistory;
export const saveAdminWikiPageDraft = wikiService.savePageDraft;
export const publishAdminWikiPageVersion = wikiService.publishPageVersion;
export const mergeAdminWikiPages = wikiService.mergePages;
