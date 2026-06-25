"use server";

import { revalidatePath } from "next/cache";
import { requestPayInPerson } from "@/lib/applications";

// Public (NOT admin-gated): an approved guest signals they will pay in person.
// requestPayInPerson only sets a flag on a valid APPROVED pay token and is a
// silent no-op otherwise, so this action cannot issue tickets, record payment,
// or disclose data.
export async function requestPayInPersonAction(formData: FormData) {
  const token = String(formData.get("token"));
  await requestPayInPerson(token);
  revalidatePath(`/pay/${token}`);
}
