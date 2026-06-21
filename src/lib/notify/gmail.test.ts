import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  return {
    sendMailMock,
    createTransportMock: vi.fn((_cfg: { auth: { user: string; pass: string } }) => ({
      sendMail: sendMailMock,
    })),
  };
});
vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

import { GmailNotifier } from "./gmail";

beforeEach(() => {
  sendMailMock.mockReset();
  createTransportMock.mockClear();
  sendMailMock.mockResolvedValue({ messageId: "x" });
});

describe("GmailNotifier", () => {
  it("authenticates with the user and app password", () => {
    new GmailNotifier("me@gmail.com", "app-pass", "Festival <me@gmail.com>");
    expect(createTransportMock).toHaveBeenCalledTimes(1);
    const cfg = createTransportMock.mock.calls[0][0];
    expect(cfg.auth).toEqual({ user: "me@gmail.com", pass: "app-pass" });
  });

  it("forwards the from address, subject, text and recipient", async () => {
    const n = new GmailNotifier("me@gmail.com", "app-pass", "Festival <me@gmail.com>");
    await n.send("to@x.com", { subject: "s", text: "t" });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.from).toBe("Festival <me@gmail.com>");
    expect(arg.to).toBe("to@x.com");
    expect(arg.subject).toBe("s");
    expect(arg.text).toBe("t");
    expect(arg.attachments).toBeUndefined();
  });

  it("forwards attachments to nodemailer", async () => {
    const n = new GmailNotifier("me@gmail.com", "app-pass", "from@x.com");
    await n.send("to@x.com", {
      subject: "s",
      text: "t",
      attachments: [{ filename: "tickets.pdf", content: Buffer.from("%PDF-...") }],
    });
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.attachments).toHaveLength(1);
    expect(arg.attachments[0].filename).toBe("tickets.pdf");
    expect(Buffer.isBuffer(arg.attachments[0].content)).toBe(true);
  });

  it("throws when nodemailer rejects (so notify() can log it)", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("EAUTH"));
    const n = new GmailNotifier("me@gmail.com", "app-pass", "from@x.com");
    await expect(n.send("to@x.com", { subject: "s", text: "t" })).rejects.toThrow("EAUTH");
  });
});
