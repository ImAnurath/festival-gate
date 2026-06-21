import { requireAdmin } from "@/lib/session";
import { collectAtDoorAndCheckIn } from "@/lib/applications";

// Admin-only door collection: mark the scanned ticket's application paid at the
// gate, then check that ticket in. Same auth boundary as /admin/scan/verify.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ result: "invalid" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const token =
    body && typeof body.token === "string" ? body.token.trim() : "";
  const applicationId =
    body && typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  if (!token || !applicationId) return Response.json({ result: "invalid" });

  const result = await collectAtDoorAndCheckIn(applicationId, token);
  return Response.json(result);
}
