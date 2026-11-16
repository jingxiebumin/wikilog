import { after, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse } from "@/lib/auth/route-utils";
import {
  enqueueInitialWikiGeneration,
  isWikiGenerationEnabled,
  processWikiGenerationJobs,
} from "@/lib/wiki/generation-index";

export async function POST() {
  try {
    const session = await requireSession({ admin: true });
    if (!isWikiGenerationEnabled()) {
      return NextResponse.json({ error: "Wiki AI 生成尚未开放。" }, { status: 503 });
    }
    await enqueueInitialWikiGeneration(session.id);
    after(async () => {
      try {
        await processWikiGenerationJobs(1);
      } catch {
        // The durable job remains available for a later request to reclaim.
      }
    });
    return NextResponse.json({ queued: true }, { status: 202 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
