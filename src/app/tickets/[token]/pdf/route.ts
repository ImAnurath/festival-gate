import { loadTicketsByAccessToken } from "@/lib/tickets";
import { renderTicketsPdf } from "@/lib/pdf/tickets-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const view = await loadTicketsByAccessToken(token);

  if (view.kind === "notfound") {
    return new Response("Not found", { status: 404 });
  }
  if (view.kind === "expired") {
    return new Response("Etkinlik sona erdi", { status: 410 });
  }

  const pdf = await renderTicketsPdf({ name: view.application.name }, view.tickets);
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="kindzi-fest-biletleri.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
