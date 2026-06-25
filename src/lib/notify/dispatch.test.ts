import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendPayLink, sendTicketsLinkMock, notifyMock, renderMock, renderPaidMock } = vi.hoisted(() => ({
  sendPayLink: vi.fn(),
  sendTicketsLinkMock: vi.fn(),
  notifyMock: vi.fn(),
  renderMock: vi.fn(),
  renderPaidMock: vi.fn(),
}));

vi.mock("./whatsapp", () => ({
  getWhatsAppSender: () => ({ sendPayLink, sendTicketsLink: sendTicketsLinkMock }),
}));
vi.mock("./index", () => ({ notify: notifyMock }));
vi.mock("../pdf/tickets-pdf", () => ({ renderTicketsPdf: renderMock, renderPaidTicketsPdf: renderPaidMock }));
vi.mock("../config", () => ({ config: { eventName: "KİNDZİ FEST", appUrl: "https://x" } }));

import { dispatchPayLink, dispatchTickets, dispatchGatePass } from "./dispatch";

const payUrl = "http://localhost:3000/pay/TOK";

beforeEach(() => {
  sendPayLink.mockReset();
  sendTicketsLinkMock.mockReset().mockResolvedValue(undefined);
  notifyMock.mockReset().mockResolvedValue(undefined);
  renderMock.mockReset().mockResolvedValue(Buffer.from("%PDF-fake"));
  renderPaidMock.mockReset().mockResolvedValue(Buffer.from("%PDF-paid"));
});

describe("dispatchPayLink", () => {
  it("sends BOTH email and WhatsApp when phone and email are present", async () => {
    await dispatchPayLink({ name: "Ali", email: "ali@example.com", phone: "+905321234567" }, payUrl);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith("ali@example.com", expect.anything());
    expect(sendPayLink).toHaveBeenCalledTimes(1);
    expect(sendPayLink).toHaveBeenCalledWith(
      "+905321234567",
      expect.objectContaining({ name: "Ali", payUrl })
    );
  });

  it("sends email and not WhatsApp when no phone is present", async () => {
    await dispatchPayLink({ name: "Ali", email: "ali@example.com", phone: null }, payUrl);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith("ali@example.com", expect.anything());
    expect(sendPayLink).not.toHaveBeenCalled();
  });

  it("sends WhatsApp and not email when no email is present", async () => {
    await dispatchPayLink({ name: "Ali", email: "", phone: "+905321234567" }, payUrl);
    expect(sendPayLink).toHaveBeenCalledTimes(1);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("swallows a WhatsApp send failure and still emails (best-effort, no throw)", async () => {
    sendPayLink.mockRejectedValueOnce(new Error("twilio down"));
    await expect(
      dispatchPayLink({ name: "Ali", email: "ali@example.com", phone: "+905321234567" }, payUrl)
    ).resolves.toBeUndefined();
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });
});

const tickets = [{ holderName: "Ayşe", isBuyer: true }] as any;
const baseApp = {
  name: "Ayşe",
  email: "a@x.com",
  phone: null as string | null,
  ticketsAccessToken: "tok-abc",
};

describe("dispatchTickets", () => {
  it("always emails with a PDF attachment and the retrieval link", async () => {
    await dispatchTickets({ ...baseApp }, tickets);
    expect(renderPaidMock).toHaveBeenCalledTimes(1);
    expect(renderMock).not.toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledTimes(1);
    const [to, msg] = notifyMock.mock.calls[0];
    expect(to).toBe("a@x.com");
    expect(msg.attachments[0].content).toBeInstanceOf(Buffer);
    expect(msg.text).toContain("https://x/tickets/tok-abc");
    expect(sendTicketsLinkMock).not.toHaveBeenCalled();
  });

  it("also sends WhatsApp when a phone is present", async () => {
    await dispatchTickets({ ...baseApp, phone: "+905551112233" }, tickets);
    expect(sendTicketsLinkMock).toHaveBeenCalledTimes(1);
    const [phone, vars] = sendTicketsLinkMock.mock.calls[0];
    expect(phone).toBe("+905551112233");
    expect(vars.ticketsUrl).toBe("https://x/tickets/tok-abc");
  });

  it("swallows a WhatsApp failure (best-effort)", async () => {
    sendTicketsLinkMock.mockRejectedValue(new Error("meta down"));
    await expect(
      dispatchTickets({ ...baseApp, phone: "+905551112233" }, tickets),
    ).resolves.toBeUndefined();
    expect(notifyMock).toHaveBeenCalledTimes(1); // email still attempted
  });

  it("skips delivery entirely when ticketsAccessToken is missing (no dead link)", async () => {
    await expect(
      dispatchTickets({ ...baseApp, phone: "+905551112233", ticketsAccessToken: null }, tickets),
    ).resolves.toBeUndefined();
    expect(renderMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
    expect(sendTicketsLinkMock).not.toHaveBeenCalled();
  });
});

describe("dispatchGatePass", () => {
  it("emails the gate-pass copy with a PDF attachment and the retrieval link", async () => {
    await dispatchGatePass({ ...baseApp }, tickets);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    const [to, msg] = notifyMock.mock.calls[0];
    expect(to).toBe("a@x.com");
    expect(msg.attachments[0].content).toBeInstanceOf(Buffer);
    expect(msg.subject).toContain("ödeme girişte");
    expect(msg.text).toContain("https://x/tickets/tok-abc");
    expect(sendTicketsLinkMock).not.toHaveBeenCalled();
  });

  it("also sends the WhatsApp retrieval link when a phone is present", async () => {
    await dispatchGatePass({ ...baseApp, phone: "+905551112233" }, tickets);
    expect(sendTicketsLinkMock).toHaveBeenCalledTimes(1);
    const [phone, vars] = sendTicketsLinkMock.mock.calls[0];
    expect(phone).toBe("+905551112233");
    expect(vars.ticketsUrl).toBe("https://x/tickets/tok-abc");
  });

  it("uses the OLD renderer (not the paid artwork renderer)", async () => {
    await dispatchGatePass({ ...baseApp }, tickets);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(renderPaidMock).not.toHaveBeenCalled();
  });

  it("skips delivery entirely when ticketsAccessToken is missing (no dead link)", async () => {
    await expect(
      dispatchGatePass({ ...baseApp, ticketsAccessToken: null }, tickets),
    ).resolves.toBeUndefined();
    expect(renderMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
    expect(sendTicketsLinkMock).not.toHaveBeenCalled();
  });
});
