import "server-only";
import type { Session } from "@/lib/auth/types";
import { AuthError } from "@/lib/auth/errors";
import * as repository from "./repository";
import type { TaxonomyType } from "./repository";
import { enforceAdminManageRateLimit } from "@/lib/auth/admin-manage-rate-limit";
import type { RequestMeta } from "@/lib/auth/types";

type Repository = Pick<typeof repository, "listTaxonomy" | "createTaxonomyItem" | "renameTaxonomyItem" | "deleteTaxonomyItem">;

function requireAdmin(session: Session) {
  if (session.role !== "admin" || session.status !== "active" || session.passwordResetRequired) {
    throw new AuthError("FORBIDDEN", "没有访问权限。");
  }
}

function parseType(type: string): TaxonomyType {
  if (type === "category" || type === "tag") return type;
  throw new AuthError("INVALID_INPUT", "请选择分类或标签。");
}

function validateName(name: string): string {
  const value = name.trim();
  if (!value || value.length > 80) throw new AuthError("INVALID_INPUT", "名称必须填写且不能超过 80 个字符。");
  return value;
}

function validateSlug(slug: string): string {
  const value = slug.trim();
  if (value.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new AuthError("INVALID_INPUT", "标识只能使用小写英文、数字和连字符。");
  }
  return value;
}

export function createAdminSettingsService(data: Repository = repository) {
  return {
    async list(session: Session) {
      requireAdmin(session);
      return data.listTaxonomy();
    },
    async create(session: Session, input: { type: string; slug: string; name: string; meta?: RequestMeta }) {
      requireAdmin(session);
      const type = parseType(input.type);
      const slug = validateSlug(input.slug);
      const name = validateName(input.name);
      await enforceAdminManageRateLimit(`taxonomy:${type}:create:${slug}`, input.meta?.ip ?? "unknown");
      try {
        return await data.createTaxonomyItem(type, slug, name, session.id);
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
          throw new AuthError("CONFLICT", "该标识已存在，请使用其他标识。");
        }
        throw error;
      }
    },
    async rename(session: Session, input: { type: string; id: string; name: string; meta?: RequestMeta }) {
      requireAdmin(session);
      const type = parseType(input.type);
      const id = input.id.trim();
      const name = validateName(input.name);
      await enforceAdminManageRateLimit(`taxonomy:${type}:${id}`, input.meta?.ip ?? "unknown");
      const item = await data.renameTaxonomyItem(type, id, name, session.id);
      if (!item) throw new AuthError("NOT_FOUND", "分类或标签不存在。");
      return item;
    },
    async remove(session: Session, input: { type: string; id: string; meta?: RequestMeta }) {
      requireAdmin(session);
      const type = parseType(input.type);
      const id = input.id.trim();
      await enforceAdminManageRateLimit(`taxonomy:${type}:${id}`, input.meta?.ip ?? "unknown");
      const result = await data.deleteTaxonomyItem(type, id, session.id);
      if (result === "missing") throw new AuthError("NOT_FOUND", "分类或标签不存在。");
      if (result === "in-use") throw new AuthError("CONFLICT", "已有文章使用此分类或标签，不能删除。");
    },
  };
}

const service = createAdminSettingsService();
export const listAdminTaxonomy = service.list;
export const createAdminTaxonomyItem = service.create;
export const renameAdminTaxonomyItem = service.rename;
export const deleteAdminTaxonomyItem = service.remove;
