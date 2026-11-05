import type { Metadata } from "next";
import { ArrowUpRight, Mail, MoveDownRight } from "lucide-react";

export const metadata: Metadata = { title: "关于作者" };

export default function AboutPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@example.com";

  return (
    <div className="page about-page">
      <div className="page-heading about-heading">
        <p className="eyebrow"><span className="eyebrow-mark" /> 关于 / ABOUT</p>
        <h1>写下过程，<br /><em>再回头看答案。</em></h1>
      </div>
      <div className="about-layout">
        <div className="about-monogram" aria-hidden="true">
          <span>W</span><MoveDownRight size={24} strokeWidth={1.4} />
          <div className="monogram-caption"><span>WIKILOG</span><span>EST. 2026</span></div>
        </div>
        <div className="about-copy">
          <p className="about-lead">这里记录做软件时遇到的问题、做过的取舍，以及那些值得再验证一次的想法。</p>
          <p>文章围绕工程实践、数据与检索、系统设计展开。内容尽量保留上下文与依据，方便日后复用，也欢迎读者指出不准确之处。</p>
          <p>这个站点从一份简单的技术日志开始。内容会随着实际项目继续补充和修订。</p>
          <div className="contact-block">
            <span className="contact-label">联系作者</span>
            <a href={`mailto:${email}`}><Mail aria-hidden="true" size={17} />{email}<ArrowUpRight aria-hidden="true" size={15} /></a>
          </div>
        </div>
      </div>
    </div>
  );
}
