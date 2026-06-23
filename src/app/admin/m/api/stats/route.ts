import { requireAdmin } from "@/lib/session";
import { gateStats } from "@/lib/stats";

// Admin-only live counts for the mobile Stats poller. requireAdmin reads the
// session cookie, so this handler is always dynamic.
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await gateStats());
}
