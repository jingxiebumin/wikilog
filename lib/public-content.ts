import "server-only";
import {
  categories,
  findPublishedArticle,
  getCategory,
  getCategoryArticles,
  getTag,
  getTagArticles,
  publishedArticles,
  searchArticles as searchFixtureArticles,
  tagCatalog,
} from "@/lib/content";
import { hasDatabase } from "@/lib/db";
import {
  findCategoryFromDatabase,
  findPublishedArticleFromDatabase,
  findTagFromDatabase,
  listCategoriesFromDatabase,
  listCategoryArticlesFromDatabase,
  listPublishedArticlesFromDatabase,
  listTagArticlesFromDatabase,
  listTagsFromDatabase,
  searchPublishedArticlesFromDatabase,
} from "@/lib/content-repository";

export type { Article, ArticleBlock, Category, SearchResult } from "@/lib/content";

export async function listCategories() {
  return hasDatabase ? listCategoriesFromDatabase() : categories;
}

export async function getCategoryBySlug(slug: string) {
  return hasDatabase ? findCategoryFromDatabase(slug) : getCategory(slug);
}

export async function listTags() {
  if (hasDatabase) return listTagsFromDatabase();
  return tagCatalog.filter((tag) => getTagArticles(tag.slug).length > 0);
}

export async function getTagBySlug(slug: string) {
  return hasDatabase ? findTagFromDatabase(slug) : getTag(slug);
}

export async function listPublishedArticles() {
  return hasDatabase ? listPublishedArticlesFromDatabase() : publishedArticles();
}

export async function getPublishedArticle(slug: string) {
  return hasDatabase ? findPublishedArticleFromDatabase(slug) : findPublishedArticle(slug);
}

export async function listArticlesForCategory(slug: string) {
  return hasDatabase ? listCategoryArticlesFromDatabase(slug) : getCategoryArticles(slug);
}

export async function listArticlesForTag(slug: string) {
  return hasDatabase ? listTagArticlesFromDatabase(slug) : getTagArticles(slug);
}

export async function searchPublishedArticles(query: string) {
  return hasDatabase ? searchPublishedArticlesFromDatabase(query) : searchFixtureArticles(query);
}
