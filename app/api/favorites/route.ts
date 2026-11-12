import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { readerFavorites } from "@/lib/favorites/service";
import { authErrorResponse } from "@/lib/auth/route-utils";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ favorites: await readerFavorites(session) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
