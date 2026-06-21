import { requireAdmin } from "@/lib/session";
import { scanTicket } from "@/lib/tickets";

// Admin-only ticket scan. The proxy.ts cookie gate is coarse; this handler
// enforces the real boundary via requireAdmin() and returns 401 on failure
// (the scanner treats any non-200 as a transient error, not a scan result).
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ result: "invalid" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const token =
    body && typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return Response.json({ result: "invalid" });

  const result = await scanTicket(token);
  return Response.json(result);
}
