"use server";

import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { buildApplicationSchema } from "@/lib/validation";
import { createApplication } from "@/lib/applications";

export type SubmitState = { error?: string };

export async function submitApplication(
  _prev: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  const schema = buildApplicationSchema(config.maxTicketsPerBuyer);
  const guestNames = formData.getAll("guestNames").map(String).filter((s) => s.trim() !== "");

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    socialTags: formData.get("socialTags"),
    ticketQuantity: formData.get("ticketQuantity"),
    guestNames,
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz giriş. Lütfen bilgilerinizi kontrol edin." };
  }

  await createApplication({
    name: parsed.data.name,
    email: parsed.data.email,
    socialTags: parsed.data.socialTags,
    ticketQuantity: parsed.data.ticketQuantity,
    guestNames: parsed.data.guestNames,
  });

  redirect("/?submitted=1");
}
