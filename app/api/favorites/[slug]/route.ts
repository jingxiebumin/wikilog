import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { readerAddFavorite, readerHasFavorite, readerRemoveFavorite } from "@/lib/favorites/service";
import { authErrorResponse } from "@/lib/auth/route-utils";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const session = await requireSession();
    const { slug } = await context.params;
    return NextResponse.json({ favorited: await readerHasFavorite(session, slug) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(_request: Request, context: Context) {
  try {
    const session = await requireSession();
    const { slug } = await context.params;
    const created = await readerAddFavorite(session, slug);
    return NextResponse.json({ favorited: true, created });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const session = await requireSession();
    const { slug } = await context.params;
    await readerRemoveFavorite(session, slug);
    return NextResponse.json({ favorited: false });
  } catch (error) {
    return authErrorResponse(error);
  }
}
