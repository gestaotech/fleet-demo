import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { loginAction } from "@/lib/auth/actions";

export async function POST(request: Request) {
  const h = await headers();
  const body = await request.json().catch(() => null);
  const res = await loginAction(body, h);
  if (!res.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_CREDENTIALS", message: res.error } },
      { status: 401 },
    );
  }
  return NextResponse.json({ data: { ok: true } });
}
