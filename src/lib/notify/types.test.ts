import { describe, it, expect } from "vitest";
import { buildApprovalEmail, buildRejectionEmail, buildConfirmationEmail } from "./types";

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
