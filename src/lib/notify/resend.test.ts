import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: sendMock } };
  }),
}));

import { ResendNotifier } from "./resend";

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "x" }, error: null });
});

describe("ResendNotifier", () => {
  it("forwards attachments to the Resend client", async () => {
    const n = new ResendNotifier("key", "from@x.com");
    await n.send("to@x.com", {
      subject: "s",
      text: "t",
      attachments: [{ filename: "tickets.pdf", content: Buffer.from("%PDF-...") }],
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.attachments).toHaveLength(1);
    expect(arg.attachments[0].filename).toBe("tickets.pdf");
    expect(Buffer.isBuffer(arg.attachments[0].content)).toBe(true);
  });

  it("omits attachments when none are given", async () => {
    const n = new ResendNotifier("key", "from@x.com");
    await n.send("to@x.com", { subject: "s", text: "t" });
    const arg = sendMock.mock.calls[0][0];
    expect(arg.attachments).toBeUndefined();
  });
});
