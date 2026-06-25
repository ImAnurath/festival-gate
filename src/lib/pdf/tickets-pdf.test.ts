import { describe, it, expect } from "vitest";
import type { Ticket } from "@prisma/client";
import { renderTicketsPdf, renderPaidTicketsPdf } from "./tickets-pdf";

// Plain fixture shaped like a Prisma Ticket (no DB involved).
function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t_" + Math.random().toString(36).slice(2),
    applicationId: "app_1",
    holderName: "Ayşe Yılmaz",
    isBuyer: false,
    code: "KF-7Q4X2",
    verifyToken: "kJ8vN2pQraw0001",
    status: "VALID",
    checkedInAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("renderTicketsPdf", () => {
  it("throws when there are no tickets", async () => {
    await expect(renderTicketsPdf({ name: "Ali Veli" }, [])).rejects.toThrow(/at least one ticket/);
  });

  it("returns a non-empty PDF buffer", async () => {
    const buf = await renderTicketsPdf({ name: "Ali Veli" }, [
      ticket({ isBuyer: true, holderName: "Ali Veli" }),
    ]);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders one page per ticket", async () => {
    const tickets = [
      ticket({ isBuyer: true, holderName: "Ali Veli", code: "KF-AAAAA", verifyToken: "tok-a" }),
      ticket({ holderName: "Ayşe Yılmaz", code: "KF-BBBBB", verifyToken: "tok-b" }),
      ticket({ holderName: "Mehmet Demir", code: "KF-CCCCC", verifyToken: "tok-c" }),
    ];
    const buf = await renderTicketsPdf({ name: "Ali Veli" }, tickets);
    const pages = (buf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pages).toBe(3);
  });

  it("renders Turkish glyphs without throwing", async () => {
    const buf = await renderTicketsPdf({ name: "Şükrü Çağlayan" }, [
      ticket({ holderName: "Ayşe Yıldız Öztürk", code: "KF-TRX01", verifyToken: "tok-tr" }),
    ]);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders a very long holder name without throwing (auto-fit path)", async () => {
    const buf = await renderTicketsPdf({ name: "Ali Veli" }, [
      ticket({ holderName: "Konstantin Büyükşehiroğlu Çağlayangil", code: "KF-LONGX", verifyToken: "tok-long" }),
    ]);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("embeds a QR image on each ticket page", async () => {
    const buf = await renderTicketsPdf({ name: "Ali Veli" }, [
      ticket({ isBuyer: true, holderName: "Ali Veli", code: "KF-QR001", verifyToken: "tok-qr" }),
    ]);
    const text = buf.toString("latin1");
    expect(text).toMatch(/\/Subtype\s*\/Image/);
  });
});

describe("renderPaidTicketsPdf", () => {
  it("throws when there are no tickets", async () => {
    await expect(renderPaidTicketsPdf({ name: "Ali Veli" }, [])).rejects.toThrow(/at least one ticket/);
  });

  it("returns a non-empty PDF buffer", async () => {
    const buf = await renderPaidTicketsPdf({ name: "Ali Veli" }, [
      ticket({ isBuyer: true, holderName: "Ali Veli", code: "KF-7Q4X2" }),
    ]);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders one page per ticket", async () => {
    const tickets = [
      ticket({ code: "KF-AAAAA", verifyToken: "tok-a" }),
      ticket({ code: "KF-BBBBB", verifyToken: "tok-b" }),
    ];
    const buf = await renderPaidTicketsPdf({ name: "Ali Veli" }, tickets);
    const pages = (buf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pages).toBe(2);
  });

  it("embeds images (artwork + QR) on the page", async () => {
    const buf = await renderPaidTicketsPdf({ name: "Ali Veli" }, [
      ticket({ code: "KF-QR001", verifyToken: "tok-qr" }),
    ]);
    expect(buf.toString("latin1")).toMatch(/\/Subtype\s*\/Image/);
  });

  it("renders a very long Turkish holder name without throwing (auto-fit path)", async () => {
    const buf = await renderPaidTicketsPdf({ name: "Ali Veli" }, [
      ticket({ holderName: "Konstantin Büyükşehiroğlu Çağlayangil", code: "KF-LONGX", verifyToken: "tok-long" }),
    ]);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
