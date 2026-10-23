"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginAction } from "@/lib/auth/actions";

export async function loginFormAction(_: unknown, formData: FormData) {
  const h = await headers();
  const res = await loginAction(
    {
      email: formData.get("email"),
      password: formData.get("password"),
    },
    h,
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  redirect("/");
}
