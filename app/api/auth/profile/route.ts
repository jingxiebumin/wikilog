import { NextResponse } from "next/server";
import { getOwnProfile, requireSession, updateOwnProfile } from "@/lib/auth/service";
import { authErrorResponse, readBody } from "@/lib/auth/route-utils";

export async function GET() {
  try {
    const session = await requireSession();
    const profile = await getOwnProfile(session.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readBody(request);
    const session = await requireSession();
    const profile = await updateOwnProfile({
      userId: session.id,
      displayName: body.displayName ?? "",
      phone: body.phone ?? "",
      gender: body.gender ?? "",
      introduction: body.introduction ?? "",
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return authErrorResponse(error);
  }
}
