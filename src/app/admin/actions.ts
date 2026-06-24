"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { config } from "@/lib/config";
import {
  approveApplication,
  rejectApplication,
  reissuePayLink,
  markPaidByHavale,
  undoHavalePayment,
} from "@/lib/applications";
import { notify } from "@/lib/notify";
import { dispatchPayLink, dispatchTickets } from "@/lib/notify/dispatch";
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

export async function confirmHavaleAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const app = await markPaidByHavale(id);
  // Best-effort delivery: a send failure must never undo the recorded payment.
  await dispatchTickets(app, app.tickets);
  revalidatePath("/admin");
}

export async function undoHavaleAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await undoHavalePayment(id);
  revalidatePath("/admin");
}
