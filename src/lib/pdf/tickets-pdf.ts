import { fileURLToPath } from "node:url";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type { Application, Ticket } from "@prisma/client";
import { config } from "@/lib/config";

// Page geometry: ~200 x 85 mm in PostScript points (1 mm ≈ 2.83465 pt).
const MM = 2.83465;
const PAGE_W = Math.round(200 * MM); // 567
const PAGE_H = Math.round(85 * MM); // 241

const STUB_W = 122;
const PAD = 22;

const C = {
  cream: "#f3eee2",
  creamDeep: "#e9e2d1",
  ink: "#16332a",
  moss: "#3b5849",
  hazel: "#ad5f26",
  sea: "#285f59",
  divider: "#b9ad90",
} as const;

const FONTS_DIR = fileURLToPath(new URL("./fonts/", import.meta.url));

function registerFonts(doc: PDFKit.PDFDocument): void {
  doc.registerFont("display", join(FONTS_DIR, "Fraunces-Display.ttf"));
  doc.registerFont("body", join(FONTS_DIR, "HankenGrotesk-Regular.ttf"));
  doc.registerFont("body-bold", join(FONTS_DIR, "HankenGrotesk-Bold.ttf"));
}

// Largest font size (down to a floor) at which `text` fits within `maxWidth`
// using `font`. Lets long Turkish names shrink, then wrap, instead of overflowing.
function fitFontSize(
  doc: PDFKit.PDFDocument,
  font: string,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
): number {
  doc.font(font);
  for (let size = maxSize; size > minSize; size -= 0.5) {
    doc.fontSize(size);
    if (doc.widthOfString(text) <= maxWidth) return size;
  }
  return minSize;
}

function drawTicketPage(doc: PDFKit.PDFDocument, ticket: Ticket): void {
  const panelW = PAGE_W - STUB_W;

  // Backgrounds: cream panel + slightly deeper stub.
  doc.save();
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.cream);
  doc.rect(panelW, 0, STUB_W, PAGE_H).fill(C.creamDeep);

  // Perforation divider.
  doc.save();
  doc.lineWidth(1).strokeColor(C.divider).dash(4, { space: 3 });
  doc.moveTo(panelW, 10).lineTo(panelW, PAGE_H - 10).stroke();
  doc.undash();
  doc.restore();

  // Emblem: two leaf ellipses (moss + hazel).
  const ex = PAD;
  const ey = PAD + 3;
  doc.fillColor(C.moss).ellipse(ex + 4, ey, 4, 7).fill();
  doc.fillColor(C.hazel).ellipse(ex + 12, ey, 4, 7).fill();

  // Venue label.
  doc
    .font("body")
    .fontSize(8)
    .fillColor(C.moss)
    .text("DENİZ'İN YERİ · DUAYERİ", ex + 22, ey - 5, { characterSpacing: 1.2, lineBreak: false });

  // Event name (display serif).
  doc
    .font("display")
    .fontSize(30)
    .fillColor(C.ink)
    .text(config.eventName.toUpperCase(), PAD, PAD + 24, { width: panelW - PAD * 2, lineBreak: false });

  // Holder label.
  doc
    .font("body")
    .fontSize(8)
    .fillColor(C.moss)
    .text("BİLET SAHİBİ", PAD, PAGE_H - 74, { characterSpacing: 1.2, lineBreak: false });

  // Holder name (auto-fit, then wrap as a final fallback).
  const holderSize = fitFontSize(doc, "display", ticket.holderName, panelW - PAD * 2, 21, 15);
  doc
    .font("display")
    .fontSize(holderSize)
    .fillColor(C.ink)
    .text(ticket.holderName, PAD, PAGE_H - 62, { width: panelW - PAD * 2, height: 34 });

  // Role pill (Sahibi / Misafir).
  const role = ticket.isBuyer ? "SAHİBİ" : "MİSAFİR";
  doc.font("body").fontSize(8);
  const pillW = doc.widthOfString(role, { characterSpacing: 1 }) + 16;
  doc.save();
  doc.roundedRect(PAD, PAGE_H - 26, pillW, 14, 7).lineWidth(0.8).strokeColor(C.sea).stroke();
  doc
    .fillColor(C.sea)
    .text(role, PAD + 8, PAGE_H - 22, { characterSpacing: 1, lineBreak: false });
  doc.restore();

  // Stub: code + status (QR added in Task 5).
  doc
    .font("body-bold")
    .fontSize(13)
    .fillColor(C.hazel)
    .text(ticket.code, panelW, 108, { width: STUB_W, align: "center", characterSpacing: 1 });

  doc.fillColor(C.sea).circle(panelW + STUB_W / 2 - 26, PAGE_H - 26, 2).fill();
  doc
    .font("body")
    .fontSize(8)
    .fillColor(C.sea)
    .text("GEÇERLİ", panelW, PAGE_H - 30, { width: STUB_W, align: "center", characterSpacing: 1 });

  doc.restore();
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
