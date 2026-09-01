"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function switchOrg(formData: FormData) {
  const orgId = String(formData.get("org") ?? "");
  if (orgId) {
    (await cookies()).set("grain_org", orgId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  revalidatePath("/app", "layout");
  redirect("/app");
}
