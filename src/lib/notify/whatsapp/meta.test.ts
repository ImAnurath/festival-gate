import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetaWhatsAppSender } from "./meta";

const vars = { name: "Ali", payUrl: "http://localhost:3000/pay/TOK", eventName: "KİNDZİ FEST" };

describe("MetaWhatsAppSender", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs a template message to the Graph API with name+payUrl params", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }), { status: 200 }));

    const sender = new MetaWhatsAppSender("PHONE_ID", "TOKEN", "pay_link", "tr", "v21.0");
    await sender.sendPayLink("+905321234567", vars);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/PHONE_ID/messages");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer TOKEN");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init?.body as string);
    expect(body.messaging_product).toBe("whatsapp");
    // Meta wants the number without a leading "+".
    expect(body.to).toBe("905321234567");
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("pay_link");
    expect(body.template.language.code).toBe("tr");
    const params = body.template.components[0].parameters;
    expect(params).toEqual([
      { type: "text", text: "Ali" },
      { type: "text", text: "http://localhost:3000/pay/TOK" },
    ]);
  });

  it("throws when the Graph API responds with a non-2xx status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad template" } }), { status: 400 })
    );
    const sender = new MetaWhatsAppSender("PHONE_ID", "TOKEN", "pay_link", "tr", "v21.0");
    await expect(sender.sendPayLink("+905321234567", vars)).rejects.toThrow();
  });
});
