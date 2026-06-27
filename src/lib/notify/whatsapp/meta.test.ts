import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetaWhatsAppSender } from "./meta";

const APP_URL = "http://localhost:3000";
const payVars = { name: "Ali", payUrl: "http://localhost:3000/pay/TOK", eventName: "KİNDZİ FEST" };
const ticketVars = { name: "Ayşe", ticketsUrl: "http://localhost:3000/tickets/TKT", eventName: "KİNDZİ FEST" };

function okFetch() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }), { status: 200 }));
}

// Constructor: (phoneNumberId, accessToken, appUrl, payTemplate, payLang, ticketsTemplate, ticketsLang, graphVersion?)
function newSender() {
  return new MetaWhatsAppSender("PHONE_ID", "TOKEN", APP_URL, "odeme_linki", "tr", "bilet_linki", "tr");
}

describe("MetaWhatsAppSender", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("sends the pay-link template with an image header, name-only body, and a dynamic URL button", async () => {
    const fetchMock = okFetch();
    await newSender().sendPayLink("+905321234567", payVars);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/PHONE_ID/messages");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer TOKEN");

    const body = JSON.parse(init?.body as string);
    expect(body.to).toBe("905321234567"); // no leading +
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("odeme_linki");
    expect(body.template.language.code).toBe("tr");

    const comps = body.template.components as Array<Record<string, unknown>>;
    const header = comps.find((c) => c.type === "header")!;
    expect((header.parameters as any[])[0]).toEqual({
      type: "image",
      image: { link: "http://localhost:3000/email/kindzi-fest-logo.png" },
    });

    const bodyComp = comps.find((c) => c.type === "body")!;
    expect(bodyComp.parameters).toEqual([{ type: "text", text: "Ali" }]);

    const button = comps.find((c) => c.type === "button")!;
    expect(button.sub_type).toBe("url");
    expect(button.index).toBe("0");
    expect(button.parameters).toEqual([{ type: "text", text: "pay/TOK" }]); // suffix only, no domain
  });

  it("sends the tickets template with its own name and the tickets-url suffix", async () => {
    const fetchMock = okFetch();
    await newSender().sendTicketsLink("+905321234567", ticketVars);

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.template.name).toBe("bilet_linki");
    const comps = body.template.components as Array<Record<string, unknown>>;
    expect(comps.find((c) => c.type === "body")!.parameters).toEqual([{ type: "text", text: "Ayşe" }]);
    const button = comps.find((c) => c.type === "button")!;
    expect(button.parameters).toEqual([{ type: "text", text: "tickets/TKT" }]);
  });

  it("normalizes a trailing slash on the app URL when building the image link", async () => {
    const fetchMock = okFetch();
    const sender = new MetaWhatsAppSender("PHONE_ID", "TOKEN", "https://kindzifest.com/", "odeme_linki", "tr", "bilet_linki", "tr");
    await sender.sendPayLink("+905321234567", payVars);
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const header = (body.template.components as any[]).find((c) => c.type === "header");
    expect(header.parameters[0].image.link).toBe("https://kindzifest.com/email/kindzi-fest-logo.png");
  });

  it("throws when the tickets template is not configured", async () => {
    okFetch();
    const sender = new MetaWhatsAppSender("PHONE_ID", "TOKEN", APP_URL, "odeme_linki", "tr");
    await expect(sender.sendTicketsLink("+905321234567", ticketVars)).rejects.toThrow(/WHATSAPP_TICKETS_TEMPLATE/);
  });

  it("throws when the Graph API responds with a non-2xx status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad template" } }), { status: 400 })
    );
    await expect(newSender().sendPayLink("+905321234567", payVars)).rejects.toThrow();
  });
});
