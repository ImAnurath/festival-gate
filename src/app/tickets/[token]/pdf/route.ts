import { loadTicketsByAccessToken } from "@/lib/tickets";
import { renderTicketsPdf } from "@/lib/pdf/tickets-pdf";
import {
  isShowcaseToken,
  SHOWCASE_DEMO,
  SHOWCASE_DEMO_TICKETS,
} from "@/lib/payment/showcase";

function pdfResponse(pdf: Buffer): Response {
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="kindzi-fest-biletleri.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // The reviewer's demo PDF is rendered from in-code tickets (no DB), so it
  // always works on every deploy and re-review.
  if (isShowcaseToken(token)) {
    const pdf = await renderTicketsPdf(
      { name: SHOWCASE_DEMO.name },
      SHOWCASE_DEMO_TICKETS,
    );
    return pdfResponse(pdf);
  }

  const view = await loadTicketsByAccessToken(token);

  if (view.kind === "notfound") {
    return new Response("Geçersiz bağlantı", { status: 404 });
  }
  if (view.kind === "expired") {
    return new Response("Etkinlik sona erdi", { status: 410 });
  }

  const pdf = await renderTicketsPdf({ name: view.application.name }, view.tickets);
  return pdfResponse(pdf);
}
