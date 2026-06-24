import { describe, it, expect, vi } from "vitest";
import { FallbackNotifier } from "./fallback";
import type { Notifier, EmailMessage } from "./types";

const msg: EmailMessage = { subject: "s", text: "t" };

function notifierWith(send: Notifier["send"]): Notifier {
  return { send };
}

describe("FallbackNotifier", () => {
  it("uses only the primary when the primary succeeds", async () => {
    const primary = vi.fn().mockResolvedValue(undefined);
    const fallback = vi.fn().mockResolvedValue(undefined);
    await new FallbackNotifier(notifierWith(primary), notifierWith(fallback)).send("to@x.com", msg);
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("falls back to Gmail with the same args when the primary throws", async () => {
    const primary = vi.fn().mockRejectedValue(new Error("Resend send failed: daily_quota_exceeded: quota"));
    const fallback = vi.fn().mockResolvedValue(undefined);
    await new FallbackNotifier(notifierWith(primary), notifierWith(fallback)).send("to@x.com", msg);
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledWith("to@x.com", msg);
  });

  it("propagates the fallback error when both providers fail", async () => {
    const primary = vi.fn().mockRejectedValue(new Error("resend down"));
    const gmailErr = new Error("gmail smtp down");
    const fallback = vi.fn().mockRejectedValue(gmailErr);
    await expect(
      new FallbackNotifier(notifierWith(primary), notifierWith(fallback)).send("to@x.com", msg),
    ).rejects.toBe(gmailErr);
  });
});
