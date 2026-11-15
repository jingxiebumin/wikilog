import type { ArticleBlock } from "@/lib/content";
import Image from "next/image";

export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="article-body">
      {blocks.map((block, index) => {
        if (block.type === "heading") return <h2 key={`${block.type}-${index}`}>{block.text}</h2>;
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
