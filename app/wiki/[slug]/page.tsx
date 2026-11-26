import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WikiTopicContent } from "@/components/wiki-topic-content";
import { GlassCard } from "@/components/ui/GlassCard";
import { getPublishedWikiPage } from "@/lib/wiki/service";
import styles from "../wiki.module.css";

type WikiTopicPageProps = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: WikiTopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedWikiPage(slug);
  return page ? { title: page.title, description: page.body.slice(0, 160) } : { title: "主题未找到" };
}

export default async function WikiTopicPage({ params }: WikiTopicPageProps) {
  const { slug } = await params;
  const page = await getPublishedWikiPage(slug);
  if (!page) notFound();
  if (page.redirectTo) redirect(page.redirectTo);
  return <div className={`page ${styles.page}`}><GlassCard className="mx-auto max-w-[1000px] p-8 md:p-10"><WikiTopicContent page={page} /></GlassCard></div>;
}
