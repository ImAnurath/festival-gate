import { describe, it, expect } from "vitest";
import { renderEmail, escapeHtml, LOGO_CID } from "./email-layout";

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
