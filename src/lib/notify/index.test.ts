import { describe, it, expect } from "vitest";
import { buildNotifier } from "./index";
import { ResendNotifier, ConsoleNotifier } from "./resend";
import { GmailNotifier } from "./gmail";
import { FallbackNotifier } from "./fallback";

const from = "Festival <tickets@x.com>";

describe("buildNotifier", () => {
  it("wraps Resend with a Gmail fallback when resend is chosen and Gmail creds exist", () => {
    const n = buildNotifier({
      notifier: "resend",
      from,
      resendApiKey: "re_key",
      gmailUser: "me@gmail.com",
      gmailAppPassword: "app-pass",
    });
    expect(n).toBeInstanceOf(FallbackNotifier);
  });

  it("returns a plain ResendNotifier when Gmail creds are absent", () => {
    const n = buildNotifier({
      notifier: "resend",
      from,
      resendApiKey: "re_key",
      gmailUser: "",
      gmailAppPassword: "",
    });
    expect(n).toBeInstanceOf(ResendNotifier);
    expect(n).not.toBeInstanceOf(FallbackNotifier);
  });

  it("returns a GmailNotifier when gmail is the chosen notifier", () => {
    const n = buildNotifier({
      notifier: "gmail",
      from,
      resendApiKey: "",
      gmailUser: "me@gmail.com",
      gmailAppPassword: "app-pass",
    });
    expect(n).toBeInstanceOf(GmailNotifier);
  });

  it("returns a ConsoleNotifier when console is the chosen notifier", () => {
    const n = buildNotifier({
      notifier: "console",
      from,
      resendApiKey: "",
      gmailUser: "",
      gmailAppPassword: "",
    });
    expect(n).toBeInstanceOf(ConsoleNotifier);
  });

  it("throws when resend is chosen without an API key", () => {
    expect(() =>
      buildNotifier({ notifier: "resend", from, resendApiKey: "", gmailUser: "", gmailAppPassword: "" }),
    ).toThrow(/RESEND_API_KEY/);
  });

  it("throws when gmail is chosen without creds", () => {
    expect(() =>
      buildNotifier({ notifier: "gmail", from, resendApiKey: "", gmailUser: "", gmailAppPassword: "" }),
    ).toThrow(/GMAIL_USER/);
  });
});
