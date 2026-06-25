import { describe, it, expect } from "vitest";
import {
  buildApprovalEmail,
  buildRejectionEmail,
  buildConfirmationEmail,
  buildTicketsEmail,
  buildGatePassEmail,
} from "./types";

describe("email builders", () => {
  it("approval email contains the payment link", () => {
    const m = buildApprovalEmail({
      eventName: "Test Fest",
      name: "Ali",
      payUrl: "http://localhost:3000/pay/TOK",
    });
    expect(m.subject).toContain("Test Fest");
    expect(m.text).toContain("http://localhost:3000/pay/TOK");
  });

  it("confirmation email states the quantity", () => {
    const m = buildConfirmationEmail({ eventName: "Test Fest", name: "Ali", ticketQuantity: 3 });
    expect(m.text).toContain("3");
  });

  it("rejection email is polite and has no link", () => {
    const m = buildRejectionEmail({ eventName: "Test Fest", name: "Ali" });
    expect(m.text).not.toContain("http");
  });
});

describe("buildTicketsEmail", () => {
  it("includes the event name in the subject", () => {
    const m = buildTicketsEmail({ eventName: "KİNDZİ FEST", name: "Ayşe", ticketsUrl: "https://x/tickets/abc" });
    expect(m.subject).toContain("KİNDZİ FEST");
  });

  it("includes the retrieval link in the body", () => {
    const m = buildTicketsEmail({ eventName: "KİNDZİ FEST", name: "Ayşe", ticketsUrl: "https://x/tickets/abc" });
    expect(m.text).toContain("https://x/tickets/abc");
    expect(m.text).toContain("Ayşe");
  });
});

describe("buildGatePassEmail", () => {
  it("names the event in the subject and signals payment is due at the gate", () => {
    const msg = buildGatePassEmail({
      eventName: "KİNDZİ FEST",
      name: "Ali",
      ticketsUrl: "https://x/tickets/tok-1",
    });
    expect(msg.subject).toContain("KİNDZİ FEST");
    expect(msg.text).toContain("Ali");
    expect(msg.text).toContain("girişte"); // pay-at-the-gate wording
    expect(msg.text).toContain("https://x/tickets/tok-1");
  });
});
