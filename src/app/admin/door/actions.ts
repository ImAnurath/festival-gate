"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { markPaidAtDoor, undoDoorPayment } from "@/lib/applications";

export async function markPaidAtDoorAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await markPaidAtDoor(id);
  revalidatePath("/admin/door");
}

export async function undoDoorPaymentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await undoDoorPayment(id);
  revalidatePath("/admin/door");
}
