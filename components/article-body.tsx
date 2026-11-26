import type { ArticleBlock } from "@/lib/content";
import Image from "next/image";

export type ArticleHeading = { id: string; text: string; level: 2 | 3 };

export function getArticleHeadings(blocks: ArticleBlock[]): ArticleHeading[] {
  const usedIds = new Map<string, number>();
  return blocks.flatMap((block, index) => {
    if (block.type !== "heading") return [];
    const baseId = block.text
      .toLocaleLowerCase("zh-CN")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "") || `section-${index + 1}`;
    const count = (usedIds.get(baseId) ?? 0) + 1;
    usedIds.set(baseId, count);
    return [{ id: count === 1 ? baseId : `${baseId}-${count}`, text: block.text, level: block.level ?? 2 }];
  });
}

export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  const headings = getArticleHeadings(blocks);
  let headingIndex = 0;
  return (
    <div className="article-body space-y-5 text-[16px] leading-relaxed text-zinc-800">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const heading = headings[headingIndex++];
          const HeadingTag = heading.level === 3 ? "h3" : "h2";
          return <HeadingTag id={heading.id} key={`${block.type}-${index}`}>{block.text}</HeadingTag>;
        }
        if (block.type === "list") {
          return <ul key={`${block.type}-${index}`}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
        }
        if (block.type === "code") {
          return (
            <pre key={`${block.type}-${index}`}>
              <code data-language={block.language}>{block.code}</code>
            </pre>
          );
        }
        if (block.type === "image") return <figure className="article-inline-image" key={`${block.type}-${index}`}><Image alt={block.alt} height={900} src={block.src} unoptimized width={1200} /><figcaption>{block.alt}</figcaption></figure>;
        return <p key={`${block.type}-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}
