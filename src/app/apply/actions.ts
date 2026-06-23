"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { config } from "@/lib/config";
import { buildApplicationSchema } from "@/lib/validation";
import { createApplication } from "@/lib/applications";
import { checkRateLimit, recordFailure, clientKey, APPLY_RATE_LIMIT } from "@/lib/rate-limit";

export type SubmitState = { error?: string };

export async function submitApplication(
  _prev: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  // Per-IP throttle so a script can't flood the table with bogus applications.
  // The hidden honeypot field (validated empty below) stops naive bots; this
  // caps the damage from a bot that skips it.
  const key = clientKey(await headers(), "apply");
  const limit = await checkRateLimit(key, APPLY_RATE_LIMIT);
  if (limit.blocked) {
    const minutes = Math.ceil(limit.retryAfterMs / 60_000);
    return {
      error: `Çok fazla başvuru gönderildi. Lütfen ${minutes} dakika sonra tekrar deneyin.`,
    };
  }

  const schema = buildApplicationSchema(config.maxTicketsPerBuyer);
  const guestNames = formData.getAll("guestNames").map(String).filter((s) => s.trim() !== "");
  const guestSocials = formData.getAll("guestSocials").map(String).filter((s) => s.trim() !== "");

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    socialTags: formData.get("socialTags"),
    ticketQuantity: formData.get("ticketQuantity"),
    guestNames,
    guestSocials,
    childCount: formData.get("childCount") ?? "0",
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz giriş. Lütfen bilgilerinizi kontrol edin." };
  }

  // Count this accepted submission against the IP's hourly budget. Recorded
  // only after validation passes, so a legitimate user's form typos don't burn
  // the budget — only real rows do.
  await recordFailure(key, APPLY_RATE_LIMIT);

  await createApplication({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    socialTags: parsed.data.socialTags,
    ticketQuantity: parsed.data.ticketQuantity,
    guestNames: parsed.data.guestNames,
    guestSocials: parsed.data.guestSocials,
    childCount: parsed.data.childCount,
  });

  redirect("/?submitted=1");
}
