import { describe, it, expect, vi } from "vitest";
import { ConsoleWhatsAppSender } from "./console";

// MetaWhatsAppSender is covered in full by ./meta.test.ts (header image,
// name-only body, dynamic URL button). This file keeps the console-sender check.
describe("ConsoleWhatsAppSender.sendTicketsLink", () => {
  it("logs the tickets link without throwing", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const s = new ConsoleWhatsAppSender();
    await s.sendTicketsLink("+905551112233", {
      name: "Ayşe",
      ticketsUrl: "https://x/tickets/abc",
      eventName: "KİNDZİ FEST",
    });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.flat().join(" ")).toContain("https://x/tickets/abc");
    spy.mockRestore();
  });
});
