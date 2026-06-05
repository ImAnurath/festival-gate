import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendPayLink, notifyMock } = vi.hoisted(() => ({
  sendPayLink: vi.fn(),
  notifyMock: vi.fn(),
}));

vi.mock("./whatsapp", () => ({ getWhatsAppSender: () => ({ sendPayLink }) }));
vi.mock("./index", () => ({ notify: notifyMock }));

import { dispatchPayLink } from "./dispatch";

const payUrl = "http://localhost:3000/pay/TOK";

beforeEach(() => {
  sendPayLink.mockReset();
  notifyMock.mockReset();
});

describe("dispatchPayLink", () => {
  it("sends WhatsApp and not email when a phone is present", async () => {
    await dispatchPayLink({ name: "Ali", email: "ali@example.com", phone: "+905321234567" }, payUrl);
    expect(sendPayLink).toHaveBeenCalledTimes(1);
    expect(sendPayLink).toHaveBeenCalledWith(
      "+905321234567",
      expect.objectContaining({ name: "Ali", payUrl })
    );
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("sends email and not WhatsApp when no phone is present", async () => {
    await dispatchPayLink({ name: "Ali", email: "ali@example.com", phone: null }, payUrl);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith("ali@example.com", expect.anything());
    expect(sendPayLink).not.toHaveBeenCalled();
  });

  it("swallows a WhatsApp send failure (best-effort, no throw)", async () => {
    sendPayLink.mockRejectedValueOnce(new Error("twilio down"));
    await expect(
      dispatchPayLink({ name: "Ali", email: "ali@example.com", phone: "+905321234567" }, payUrl)
    ).resolves.toBeUndefined();
  });
});
