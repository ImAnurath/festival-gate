import { describe, it, expect } from "vitest";
import { renderEmail, escapeHtml, LOGO_CID, loadLogoAttachment, attachInlineLogo } from "./email-layout";

describe("escapeHtml", () => {
  it("escapes angle brackets and ampersands", () => {
    expect(escapeHtml('a<b>&"c')).toBe("a&lt;b&gt;&amp;&quot;c");
  });
});

describe("renderEmail", () => {
  const base = { heading: "Merhaba Ozan,", bodyHtml: "<p>Selam</p>" };

  it("embeds the logo via the inline cid", () => {
    expect(renderEmail(base)).toContain(`cid:${LOGO_CID}`);
  });

  it("renders the heading and body", () => {
    const html = renderEmail(base);
    expect(html).toContain("Merhaba Ozan,");
    expect(html).toContain("<p>Selam</p>");
  });

  it("renders a CTA button linking to the url", () => {
    const html = renderEmail({ ...base, cta: { label: "Ödemeyi Tamamla →", url: "https://x/pay/TOK" } });
    expect(html).toContain("Ödemeyi Tamamla →");
    expect(html).toContain('href="https://x/pay/TOK"');
  });

  it("renders the highlighted link box with the url shown as text", () => {
    const html = renderEmail({
      ...base,
      linkBox: { label: "🔗 Kişisel ödeme bağlantınız", url: "https://x/pay/TOK", caption: "yapıştırın" },
    });
    expect(html).toContain("🔗 Kişisel ödeme bağlantınız");
    expect(html).toContain(">https://x/pay/TOK</a>");
    expect(html).toContain("yapıştırın");
  });

  it("omits the button and link box when not provided", () => {
    const html = renderEmail(base);
    expect(html).not.toContain("padding:17px 46px"); // button-specific style
    expect(html).not.toContain("#FFF7ED"); // link-box background
  });

  it("renders the eyebrow with its color and the footer", () => {
    const html = renderEmail({ ...base, eyebrow: { text: "Onaylandı", color: "#16a34a" } });
    expect(html).toContain("Onaylandı");
    expect(html).toContain("#16a34a");
    expect(html).toContain("by Deniz'in Yeri");
  });
});

describe("loadLogoAttachment", () => {
  it("reads the real PNG and tags it with the cid and content type", () => {
    const att = loadLogoAttachment();
    expect(att).not.toBeNull();
    expect(att!.cid).toBe(LOGO_CID);
    expect(att!.contentType).toBe("image/png");
    expect(att!.filename).toBe("kindzi-fest-logo.png");
    expect(att!.content.length).toBeGreaterThan(0);
  });
});

describe("attachInlineLogo", () => {
  it("prepends the logo for html messages, keeping existing attachments", () => {
    const pdf = { filename: "tickets.pdf", content: Buffer.from("%PDF") };
    const out = attachInlineLogo({ subject: "s", text: "t", html: "<b>hi</b>", attachments: [pdf] });
    expect(out.attachments).toHaveLength(2);
    expect(out.attachments![0].cid).toBe(LOGO_CID);
    expect(out.attachments![1].filename).toBe("tickets.pdf");
  });

  it("leaves text-only messages untouched (no logo)", () => {
    const out = attachInlineLogo({ subject: "s", text: "t" });
    expect(out.attachments).toBeUndefined();
  });
});
