import type { Ticket } from "@prisma/client";

// The reviewer's public demo pay page is backed entirely by in-code data (no
// database row). It is non-consumable and DB-free, so every reviewer (and every
// re-review, on any fresh deploy) sees a complete, working payment journey:
// order summary -> payment -> delivered tickets (with QR codes + PDF).
export const SHOWCASE_PAY_TOKEN = "showcase-kindzi-demo";

export function isShowcaseToken(token: string | null | undefined): boolean {
  return token === SHOWCASE_PAY_TOKEN;
}

// The demo buyer and their order. `ticketQuantity` must match the number of
// demo tickets below (buyer + named guests). Amount is computed at render time
// from config.ticketPrice so the showcase always reflects the live price.
export const SHOWCASE_DEMO = {
  name: "Ayşe Yılmaz",
  email: "ayse.demo@kindzifest.example",
  ticketQuantity: 2,
  // A stable, obviously-fake reference shown on the demo receipt.
  paymentRef: "DEMO-KZF-2026-0001",
} as const;

const DEMO_APP_ID = "showcase-demo-app";
const DEMO_CREATED = new Date("2026-01-01T00:00:00.000Z");

// Full Ticket shapes so the same data feeds both <TicketList /> and the pure
// renderTicketsPdf() without casts. verifyToken is the QR payload.
export const SHOWCASE_DEMO_TICKETS: Ticket[] = [
  {
    id: "showcase-demo-ticket-1",
    applicationId: DEMO_APP_ID,
    holderName: SHOWCASE_DEMO.name,
    isBuyer: true,
    code: "KZF-7F3A",
    verifyToken: "demo-verify-ayse-7f3a",
    status: "VALID",
    checkedInAt: null,
    createdAt: DEMO_CREATED,
  },
  {
    id: "showcase-demo-ticket-2",
    applicationId: DEMO_APP_ID,
    holderName: "Mehmet Yılmaz",
    isBuyer: false,
    code: "KZF-2B9C",
    verifyToken: "demo-verify-mehmet-2b9c",
    status: "VALID",
    checkedInAt: null,
    createdAt: new Date(DEMO_CREATED.getTime() + 60_000),
  },
];
