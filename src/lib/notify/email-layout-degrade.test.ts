import { describe, it, expect, vi } from "vitest";

// Force every fs read to throw so we exercise the "logo missing" path.
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => {
    throw new Error("ENOENT");
  }),
}));

import { loadLogoAttachment, attachInlineLogo } from "./email-layout";

describe("logo degradation", () => {
  it("returns null when the logo file cannot be read", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(loadLogoAttachment()).toBeNull();
  });

  it("attachInlineLogo leaves an html message unchanged when the logo is missing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = attachInlineLogo({ subject: "s", text: "t", html: "<b>hi</b>" });
    expect(out.attachments).toBeUndefined();
  });
});
