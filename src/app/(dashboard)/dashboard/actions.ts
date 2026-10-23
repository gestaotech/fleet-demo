"use server";

import { headers } from "next/headers";
import { logoutAction } from "@/lib/auth/actions";
import { redirect } from "next/navigation";

export async function logoutFormAction() {
  const h = await headers();
  await logoutAction(h);
  redirect("/login");
}
