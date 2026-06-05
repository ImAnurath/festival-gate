"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { config } from "@/lib/config";
import { approveApplication, rejectApplication, reissuePayLink } from "@/lib/applications";
import { notify } from "@/lib/notify";
import { dispatchPayLink } from "@/lib/notify/dispatch";
import { buildRejectionEmail } from "@/lib/notify/types";

export async function approveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const app = await approveApplication(id);
  const payUrl = `${config.appUrl}/pay/${app.payToken}`;
  await dispatchPayLink(app, payUrl);
  revalidatePath("/admin");
}

export async function resendLinkAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const app = await reissuePayLink(id);
  const payUrl = `${config.appUrl}/pay/${app.payToken}`;
  await dispatchPayLink(app, payUrl);
  revalidatePath("/admin");
}

export async function rejectAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const app = await rejectApplication(id);
  await notify(app.email, buildRejectionEmail({
    eventName: config.eventName,
    name: app.name,
  }));
  revalidatePath("/admin");
}
