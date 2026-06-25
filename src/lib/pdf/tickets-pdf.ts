import { join } from "node:path";
import { readFile } from "node:fs/promises";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { Application, Ticket } from "@prisma/client";
import { config } from "@/lib/config";

// Page geometry: ~200 x 85 mm in PostScript points (1 mm ≈ 2.83465 pt).
const MM = 2.83465;
const PAGE_W = Math.round(200 * MM); // 567
const PAGE_H = Math.round(85 * MM); // 241

const STUB_W = 122;
const PAD = 22;

// ---- Paid ticket (artwork-based) geometry ----
// Source artwork is 1099 x 390 px. We render it at ART_W points wide and put a
// white QR/name panel to its right. Overlay positions are expressed in SOURCE
// PIXELS (anchored to the 1099x390 art) and scaled by S, so they survive a
// change to ART_W. The BILETNO_* values are calibrated in the plan's Task 2.
const ART_SRC_W = 1099;
const ART_SRC_H = 390;
const ART_W = 680;
const ART_H = Math.round((ART_W * ART_SRC_H) / ART_SRC_W); // ~241
const PANEL_W = 160;
const PAID_PAGE_W = ART_W + PANEL_W; // ~840
const PAID_PAGE_H = ART_H; // ~241
const S = ART_W / ART_SRC_W; // source px -> pt

// White "Bilet No:" blank, in source pixels (calibrated in Task 2).
const BILETNO_X_PX = 527; // left edge of the writable area, right of the pink label
const BILETNO_W_PX = 185; // writable width (blank ends ~x=712 in source px)
const BILETNO_CY_PX = 332; // vertical center of the blank (pill spans y=320–343)

const TICKET_BG = join(process.cwd(), "src", "lib", "pdf", "assets", "ticket-bg.jpg");

const C = {
  cream: "#f3eee2",
  creamDeep: "#e9e2d1",
  ink: "#16332a",
  moss: "#3b5849",
  hazel: "#ad5f26",
  sea: "#285f59",
  divider: "#b9ad90",
} as const;

// Vendored fonts live at src/lib/pdf/fonts. Resolve them from the project root
// (process.cwd()) — NOT via import.meta.url. Turbopack (the Next 16 production
// bundler) can't resolve a directory URL and rewrites `new URL(..., import.meta.url)`
// into a cross-realm URL object that breaks fileURLToPath during the build. Reading
// from a cwd-relative path is the pattern Next's own docs use for bundled files;
// next.config.ts's outputFileTracingIncludes copies these .ttf files into the server
// trace for every route that renders a PDF, so the runtime read resolves.
const FONTS_DIR = join(process.cwd(), "src", "lib", "pdf", "fonts");

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

function drawTicketPage(doc: PDFKit.PDFDocument, ticket: Ticket, qrPng: Buffer): void {
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

  // Role pill (Sahibi / Misafir). Center the label inside the pill on both
  // axes instead of hardcoding offsets, so it stays centered regardless of the
  // string (Turkish dotted-capital glyphs shift the visual weight otherwise).
  const role = ticket.isBuyer ? "SAHİBİ" : "MİSAFİR";
  doc.font("body").fontSize(8);
  const pillH = 14;
  const pillY = PAGE_H - 26;
  const pillW = doc.widthOfString(role, { characterSpacing: 1 }) + 16;
  const roleH = doc.heightOfString(role, { width: pillW, characterSpacing: 1, lineBreak: false });
  doc.save();
  doc.roundedRect(PAD, pillY, pillW, pillH, 7).lineWidth(0.8).strokeColor(C.sea).stroke();
  doc
    .fillColor(C.sea)
    .text(role, PAD, pillY + (pillH - roleH) / 2, {
      width: pillW,
      align: "center",
      characterSpacing: 1,
      lineBreak: false,
    });
  doc.restore();

  // Stub: QR + code + status.
  const qrSize = 74;
  doc.image(qrPng, panelW + (STUB_W - qrSize) / 2, 26, { width: qrSize, height: qrSize });

  doc
    .font("body-bold")
    .fontSize(13)
    .fillColor(C.hazel)
    .text(ticket.code, panelW, 110, { width: STUB_W, align: "center", characterSpacing: 1 });

  doc.fillColor(C.sea).circle(panelW + STUB_W / 2 - 26, PAGE_H - 26, 2).fill();
  doc
    .font("body")
    .fontSize(8)
    .fillColor(C.sea)
    .text("GEÇERLİ", panelW, PAGE_H - 30, { width: STUB_W, align: "center", characterSpacing: 1 });

  doc.restore();
}

function drawPaidTicketPage(
  doc: PDFKit.PDFDocument,
  ticket: Ticket,
  qrPng: Buffer,
  bg: Buffer,
): void {
  // 1. Delivered artwork, full-bleed on the left.
  doc.image(bg, 0, 0, { width: ART_W, height: ART_H });

  // 2. Unique ID stamped into the white "Bilet No:" blank.
  const blankX = BILETNO_X_PX * S;
  const blankW = BILETNO_W_PX * S;
  const blankCY = BILETNO_CY_PX * S;
  const idSize = fitFontSize(doc, "body-bold", ticket.code, blankW, 16, 8);
  doc.font("body-bold").fontSize(idSize).fillColor(C.ink);
  const idH = doc.heightOfString(ticket.code, { width: blankW, lineBreak: false });
  doc.text(ticket.code, blankX, blankCY - idH / 2, {
    width: blankW,
    align: "center",
    characterSpacing: 1,
    lineBreak: false,
  });

  // 3. White QR/name panel on the right, with a perforation hint at its seam.
  doc.save();
  doc.rect(ART_W, 0, PANEL_W, PAID_PAGE_H).fill("#ffffff");
  doc.lineWidth(1).strokeColor(C.divider).dash(4, { space: 3 });
  doc.moveTo(ART_W, 10).lineTo(ART_W, PAID_PAGE_H - 10).stroke();
  doc.undash();
  doc.restore();

  // QR centered near the top of the panel.
  const qrSize = 120;
  const qrX = ART_W + (PANEL_W - qrSize) / 2;
  const qrY = 22;
  doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });

  // Name under the QR (auto-fit, wraps as a last resort). No role tag.
  const nameX = ART_W + 12;
  const nameW = PANEL_W - 24;
  const nameY = qrY + qrSize + 12;
  const nameSize = fitFontSize(doc, "body-bold", ticket.holderName, nameW, 16, 10);
  doc
    .font("body-bold")
    .fontSize(nameSize)
    .fillColor(C.ink)
    .text(ticket.holderName, nameX, nameY, {
      width: nameW,
      align: "center",
      height: PAID_PAGE_H - nameY - 10,
    });
}

/**
 * Shared PDFKit scaffolding: create the doc, register fonts, generate one QR per
 * ticket, and draw one page per ticket with the supplied `draw` callback.
 * Pure: no DB, no network. Throws on an empty ticket list.
 */
async function renderPdf(
  application: Pick<Application, "name">,
  tickets: Ticket[],
  pageSize: [number, number],
  draw: (doc: PDFKit.PDFDocument, ticket: Ticket, qrPng: Buffer) => void,
): Promise<Buffer> {
  if (tickets.length === 0) {
    throw new Error("renderTicketsPdf requires at least one ticket");
  }

  const doc = new PDFDocument({ size: pageSize, margin: 0 });
  doc.info.Title = `${config.eventName} biletleri — ${application.name}`;
  registerFonts(doc);

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const qrPngs = await Promise.all(
    tickets.map((t) =>
      QRCode.toBuffer(t.verifyToken, { errorCorrectionLevel: "M", margin: 0, width: 220 }),
    ),
  );

  tickets.forEach((ticket, i) => {
    if (i > 0) doc.addPage({ size: pageSize, margin: 0 });
    draw(doc, ticket, qrPngs[i]);
  });

  doc.end();
  return done;
}

/** Old vector boarding pass. Used for the pay-at-the-gate path. */
export async function renderTicketsPdf(
  application: Pick<Application, "name">,
  tickets: Ticket[],
): Promise<Buffer> {
  return renderPdf(application, tickets, [PAGE_W, PAGE_H], drawTicketPage);
}

/** Artwork-based ticket. Used for the paid path. */
export async function renderPaidTicketsPdf(
  application: Pick<Application, "name">,
  tickets: Ticket[],
): Promise<Buffer> {
  const bg = await readFile(TICKET_BG);
  return renderPdf(application, tickets, [PAID_PAGE_W, PAID_PAGE_H], (doc, ticket, qrPng) =>
    drawPaidTicketPage(doc, ticket, qrPng, bg),
  );
}
