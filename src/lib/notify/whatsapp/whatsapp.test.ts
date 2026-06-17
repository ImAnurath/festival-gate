import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsoleWhatsAppSender } from "./console";
import { MetaWhatsAppSender } from "./meta";

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

describe("MetaWhatsAppSender.sendTicketsLink", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("posts the tickets template with name + url variables", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    const s = new MetaWhatsAppSender("PNID", "TOKEN", "paylink_tpl", "tr", "tickets_tpl", "tr");
    await s.sendTicketsLink("+905551112233", {
      name: "Ayşe",
      ticketsUrl: "https://x/tickets/abc",
      eventName: "KİNDZİ FEST",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.template.name).toBe("tickets_tpl");
    expect(body.template.components[0].parameters[1].text).toBe("https://x/tickets/abc");
  });

  it("throws if no tickets template is configured", async () => {
    const s = new MetaWhatsAppSender("PNID", "TOKEN", "paylink_tpl", "tr", "", "tr");
    await expect(
      s.sendTicketsLink("+905551112233", { name: "A", ticketsUrl: "u", eventName: "E" }),
    ).rejects.toThrow();
  });
});
