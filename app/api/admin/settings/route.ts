import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/service";
import { adminErrorResponse, readBody } from "@/lib/auth/route-utils";
import {
  createAdminTaxonomyItem,
  deleteAdminTaxonomyItem,
  listAdminTaxonomy,
  renameAdminTaxonomyItem,
} from "@/lib/admin-settings/service";

export async function GET() {
  try {
    const session = await requireSession({ admin: true });
    return NextResponse.json(await listAdminTaxonomy(session));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession({ admin: true });
    const body = await readBody(request);
    const item = await createAdminTaxonomyItem(session, {
      type: body.type ?? "",
      slug: body.slug ?? "",
      name: body.name ?? "",
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession({ admin: true });
    const body = await readBody(request);
    const item = await renameAdminTaxonomyItem(session, {
      type: body.type ?? "",
      id: body.id ?? "",
      name: body.name ?? "",
    });
    return NextResponse.json({ item });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession({ admin: true });
    const params = new URL(request.url).searchParams;
    await deleteAdminTaxonomyItem(session, { type: params.get("type") ?? "", id: params.get("id") ?? "" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
