import { fileURLToPath } from "node:url";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type { Application, Ticket } from "@prisma/client";
import { config } from "@/lib/config";

// Page geometry: ~200 x 85 mm in PostScript points (1 mm ≈ 2.83465 pt).
const MM = 2.83465;
const PAGE_W = Math.round(200 * MM); // 567
const PAGE_H = Math.round(85 * MM); // 241

const FONTS_DIR = fileURLToPath(new URL("./fonts/", import.meta.url));

function registerFonts(doc: PDFKit.PDFDocument): void {
  doc.registerFont("display", join(FONTS_DIR, "Fraunces-Display.ttf"));
  doc.registerFont("body", join(FONTS_DIR, "HankenGrotesk-Regular.ttf"));
  doc.registerFont("body-bold", join(FONTS_DIR, "HankenGrotesk-Bold.ttf"));
}

// One blank page per ticket for now; real drawing is added in later tasks.
function drawTicketPage(_doc: PDFKit.PDFDocument, _ticket: Ticket): void {
  // filled in by Task 4 / Task 5
}

/**
 * Renders one boarding-pass PDF page per ticket and returns the PDF bytes.
 * Pure: no DB, no network. Throws on an empty ticket list.
 */
export async function renderTicketsPdf(
  application: Pick<Application, "name">,
  tickets: Ticket[],
): Promise<Buffer> {
  if (tickets.length === 0) {
    throw new Error("renderTicketsPdf requires at least one ticket");
  }

  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0 });
  doc.info.Title = `${config.eventName} biletleri — ${application.name}`;
  registerFonts(doc);

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  tickets.forEach((ticket, i) => {
    if (i > 0) doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    drawTicketPage(doc, ticket);
  });

  doc.end();
  return done;
}
