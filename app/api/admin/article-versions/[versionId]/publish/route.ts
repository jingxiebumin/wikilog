import { after, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminPublishArticle } from "@/lib/articles/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";
import { isWikiGenerationEnabled, processWikiGenerationJobs } from "@/lib/wiki/generation-index";

export async function POST(_request: Request, context: { params: Promise<{ versionId: string }> }) {
  try {
    const actor = await requireSession({ admin: true });
    const { versionId } = await context.params;
    await adminPublishArticle(actor, versionId);
    if (isWikiGenerationEnabled()) {
      after(async () => {
        try {
          await processWikiGenerationJobs(1);
        } catch {
          // The durable queue keeps failed work available for later processing.
        }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
