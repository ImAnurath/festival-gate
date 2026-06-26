# Branded HTML Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every transactional email a branded HTML body with the inline KİNDZİ FEST logo, a prominent orange CTA button, and a highlighted box that makes the personal pay link / ticket link impossible to miss.

**Architecture:** Add an `html` field to `EmailMessage` and `cid`/`contentType` to `EmailAttachment`. A new pure helper (`renderEmail`) builds the shared branded HTML; a small loader (`loadLogoAttachment`/`attachInlineLogo`) injects the logo as an inline CID attachment, centralized in `notify()` so every send path is covered. Build functions gain `html` while keeping `text` as a multipart fallback. Both senders forward `html` and map the cid. Best-effort delivery is preserved — a missing logo or failed send never breaks the flow.

**Tech Stack:** TypeScript, Next.js, Resend SDK, nodemailer (Gmail), Vitest.

## Global Constraints

- Spec: [docs/superpowers/specs/2026-06-26-branded-html-emails-design.md](../specs/2026-06-26-branded-html-emails-design.md)
- All commands run from the repo root: `D:\Projects\Repos\festival-gate`.
- Prefix shell commands with `rtk` (user convention).
- Inline image content-id constant value: `kindzi-fest-logo` (referenced as `cid:kindzi-fest-logo` in HTML).
- Logo asset path: `public/email/kindzi-fest-logo.png`, content type `image/png`.
- CTA button color: `#F97316`. Link box: bg `#FFF7ED`, border `#FDBA74`, link text `#EA580C` 17px bold underlined.
- `text` field must be preserved on every email (plain-text multipart fallback).
- Keep all delivery best-effort: never throw out of `notify()`; a null logo degrades to no-image, email still sends.
- Turkish copy only; no em-dashes in user-facing copy.

---

### Task 1: Types, asset rename, and the `renderEmail` HTML layout

**Files:**
- Rename: `public/email/kindzi-fest-logo.jpg` → `public/email/kindzi-fest-logo.png` (the saved file is a PNG)
- Modify: `src/lib/notify/types.ts` (add `html` to `EmailMessage`, `cid`/`contentType` to `EmailAttachment`)
- Create: `src/lib/notify/email-layout.ts` (`LOGO_CID`, `escapeHtml`, `renderEmail`)
- Test: `src/lib/notify/email-layout.test.ts`

**Interfaces:**
- Produces: `LOGO_CID: string` (= `"kindzi-fest-logo"`); `escapeHtml(s: string): string`; `renderEmail(p: { eyebrow?: { text: string; color: string }; heading: string; bodyHtml: string; cta?: { label: string; url: string }; linkBox?: { label: string; url: string; caption: string }; note?: string }): string`
- Produces (types): `EmailMessage.html?: string`; `EmailAttachment.cid?: string`; `EmailAttachment.contentType?: string`

- [ ] **Step 1: Rename the asset**

```bash
rtk git mv public/email/kindzi-fest-logo.jpg public/email/kindzi-fest-logo.png
```

(If git mv fails because the file is untracked, use `mv public/email/kindzi-fest-logo.jpg public/email/kindzi-fest-logo.png`.)

- [ ] **Step 2: Extend the types**

In `src/lib/notify/types.ts`, replace the `EmailAttachment` and `EmailMessage` declarations (lines 3-9) with:

```ts
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string; // inline image content-id (referenced as cid:... in html)
  contentType?: string; // e.g. "image/png"
};
export type EmailMessage = {
  to?: string;
  subject: string;
  text: string; // plain-text fallback (multipart)
  html?: string; // branded HTML body
  attachments?: EmailAttachment[];
};
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/notify/email-layout.test.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `rtk vitest run src/lib/notify/email-layout.test.ts`
Expected: FAIL — cannot find module `./email-layout`.

- [ ] **Step 5: Implement `email-layout.ts` (layout half)**

Create `src/lib/notify/email-layout.ts`:

```ts
export const LOGO_CID = "kindzi-fest-logo";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type RenderOpts = {
  eyebrow?: { text: string; color: string };
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  linkBox?: { label: string; url: string; caption: string };
  note?: string;
};

export function renderEmail(p: RenderOpts): string {
  const eyebrow = p.eyebrow
    ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${p.eyebrow.color};">${p.eyebrow.text}</p>`
    : "";
  const cta = p.cta
    ? `<tr><td align="center" style="padding:4px 36px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#F97316" style="border-radius:10px;">
          <a href="${p.cta.url}" style="display:inline-block;padding:17px 46px;font-size:18px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${p.cta.label}</a>
        </td></tr></table>
       </td></tr>`
    : "";
  const linkBox = p.linkBox
    ? `<tr><td style="padding:0 36px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:2px solid #FDBA74;border-radius:12px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#9A3412;text-align:center;">${p.linkBox.label}</p>
            <p style="margin:0;text-align:center;"><a href="${p.linkBox.url}" style="font-size:17px;font-weight:700;line-height:1.5;color:#EA580C;text-decoration:underline;word-break:break-all;">${p.linkBox.url}</a></p>
            <p style="margin:10px 0 0;font-size:12px;color:#C2630E;text-align:center;">${p.linkBox.caption}</p>
          </td></tr>
        </table>
       </td></tr>`
    : "";
  const note = p.note
    ? `<tr><td style="padding:16px 36px 4px;"><p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#71717a;text-align:center;">${p.note}</p></td></tr>`
    : "";
  return `<!doctype html><html lang="tr"><body style="margin:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
   <tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4e4e7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <tr><td style="padding:0;"><img src="cid:${LOGO_CID}" width="520" alt="KİNDZİ FEST" style="display:block;width:100%;height:auto;border:0;"></td></tr>
      <tr><td style="padding:32px 36px 8px;">
        ${eyebrow}
        <h2 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#18181b;">${p.heading}</h2>
        ${p.bodyHtml}
      </td></tr>
      ${cta}
      ${linkBox}
      ${note}
      <tr><td style="padding:20px 36px;background:#fafafa;border-top:1px solid #f0f0f0;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#a1a1aa;text-align:center;">Etkinlikte görüşmek üzere!<br><strong style="color:#71717a;">KİNDZİ FEST · by Deniz'in Yeri</strong></p>
      </td></tr>
    </table>
   </td></tr>
  </table></body></html>`;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `rtk vitest run src/lib/notify/email-layout.test.ts`
Expected: PASS (all cases).

- [ ] **Step 7: Commit**

```bash
rtk git add public/email src/lib/notify/types.ts src/lib/notify/email-layout.ts src/lib/notify/email-layout.test.ts
rtk git commit -m "feat(email): add EmailMessage.html, inline-image type fields, and renderEmail layout helper"
```

---

### Task 2: Inline logo loader + injector

**Files:**
- Modify: `src/lib/notify/email-layout.ts` (add `loadLogoAttachment`, `attachInlineLogo`)
- Test: `src/lib/notify/email-layout.test.ts` (append happy-path cases)
- Test: `src/lib/notify/email-layout-degrade.test.ts` (fs failure path, isolated file)

**Interfaces:**
- Consumes: `LOGO_CID` (Task 1); `EmailMessage`, `EmailAttachment` (Task 1)
- Produces: `loadLogoAttachment(): EmailAttachment | null`; `attachInlineLogo(message: EmailMessage): EmailMessage`

- [ ] **Step 1: Write the failing happy-path tests**

Append to `src/lib/notify/email-layout.test.ts`:

```ts
import { loadLogoAttachment, attachInlineLogo } from "./email-layout";

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk vitest run src/lib/notify/email-layout.test.ts`
Expected: FAIL — `loadLogoAttachment`/`attachInlineLogo` are not exported.

- [ ] **Step 3: Implement the loader + injector**

At the top of `src/lib/notify/email-layout.ts`, add the imports:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EmailAttachment, EmailMessage } from "./types";
```

At the end of `src/lib/notify/email-layout.ts`, add:

```ts
const LOGO_PATH = join(process.cwd(), "public", "email", "kindzi-fest-logo.png");
let cachedLogo: EmailAttachment | null = null;

// Reads the inline logo once and caches it. On any read error logs and returns
// null so the email still sends (the image is a courtesy, never a blocker).
export function loadLogoAttachment(): EmailAttachment | null {
  if (cachedLogo) return cachedLogo;
  try {
    const content = readFileSync(LOGO_PATH);
    cachedLogo = { filename: "kindzi-fest-logo.png", content, cid: LOGO_CID, contentType: "image/png" };
    return cachedLogo;
  } catch (err) {
    console.error(`[email-layout] could not read logo at ${LOGO_PATH}`, err);
    return null;
  }
}

// Prepends the inline logo to any message that has an html body. Text-only
// messages and a missing logo file pass through unchanged.
export function attachInlineLogo(message: EmailMessage): EmailMessage {
  if (!message.html) return message;
  const logo = loadLogoAttachment();
  if (!logo) return message;
  return { ...message, attachments: [logo, ...(message.attachments ?? [])] };
}
```

- [ ] **Step 4: Run to verify the happy-path passes**

Run: `rtk vitest run src/lib/notify/email-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing degradation test (isolated file so fs can be mocked)**

Create `src/lib/notify/email-layout-degrade.test.ts`:

```ts
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
```

- [ ] **Step 6: Run to verify it passes**

Run: `rtk vitest run src/lib/notify/email-layout-degrade.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add src/lib/notify/email-layout.ts src/lib/notify/email-layout.test.ts src/lib/notify/email-layout-degrade.test.ts
rtk git commit -m "feat(email): load and inject the inline KINDZI FEST logo, degrading gracefully when absent"
```

---

### Task 3: Senders forward HTML and map the cid

**Files:**
- Modify: `src/lib/notify/resend.ts` (lines 13-22)
- Modify: `src/lib/notify/gmail.ts` (lines 19-27)
- Test: `src/lib/notify/resend.test.ts` (append)
- Test: `src/lib/notify/gmail.test.ts` (append)

**Interfaces:**
- Consumes: `EmailMessage.html`, `EmailAttachment.cid`, `EmailAttachment.contentType` (Task 1)

- [ ] **Step 1: Write the failing sender tests**

Append to `src/lib/notify/resend.test.ts` (inside the `describe("ResendNotifier", ...)` block):

```ts
  it("forwards the html body when present", async () => {
    const n = new ResendNotifier("key", "from@x.com");
    await n.send("to@x.com", { subject: "s", text: "t", html: "<b>hi</b>" });
    expect(sendMock.mock.calls[0][0].html).toBe("<b>hi</b>");
  });

  it("maps an inline attachment cid to contentId and passes contentType", async () => {
    const n = new ResendNotifier("key", "from@x.com");
    await n.send("to@x.com", {
      subject: "s",
      text: "t",
      html: "<img src='cid:logo'>",
      attachments: [{ filename: "logo.png", content: Buffer.from("img"), cid: "logo", contentType: "image/png" }],
    });
    const att = sendMock.mock.calls[0][0].attachments[0];
    expect(att.contentId).toBe("logo");
    expect(att.contentType).toBe("image/png");
  });
```

Append to `src/lib/notify/gmail.test.ts` (inside the `describe("GmailNotifier", ...)` block):

```ts
  it("forwards the html body when present", async () => {
    const n = new GmailNotifier("me@gmail.com", "app-pass", "from@x.com");
    await n.send("to@x.com", { subject: "s", text: "t", html: "<b>hi</b>" });
    expect(sendMailMock.mock.calls[0][0].html).toBe("<b>hi</b>");
  });

  it("maps an inline attachment cid to nodemailer's cid and passes contentType", async () => {
    const n = new GmailNotifier("me@gmail.com", "app-pass", "from@x.com");
    await n.send("to@x.com", {
      subject: "s",
      text: "t",
      html: "<img src='cid:logo'>",
      attachments: [{ filename: "logo.png", content: Buffer.from("img"), cid: "logo", contentType: "image/png" }],
    });
    const att = sendMailMock.mock.calls[0][0].attachments[0];
    expect(att.cid).toBe("logo");
    expect(att.contentType).toBe("image/png");
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `rtk vitest run src/lib/notify/resend.test.ts src/lib/notify/gmail.test.ts`
Expected: FAIL — `html`/`contentId`/`cid` are undefined on the forwarded args.

- [ ] **Step 3: Implement the Resend mapping**

In `src/lib/notify/resend.ts`, replace the `this.client.emails.send({...})` call (lines 13-21) with:

```ts
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      // Resend's SDK takes camelCase contentId (→ content_id) and contentType.
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              ...(a.cid ? { contentId: a.cid } : {}),
              ...(a.contentType ? { contentType: a.contentType } : {}),
            })),
          }
        : {}),
    });
```

- [ ] **Step 4: Implement the Gmail mapping**

In `src/lib/notify/gmail.ts`, replace the `this.transporter.sendMail({...})` call (lines 19-27) with:

```ts
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      // Nodemailer uses `cid` for inline images referenced as cid:... in html.
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              ...(a.cid ? { cid: a.cid } : {}),
              ...(a.contentType ? { contentType: a.contentType } : {}),
            })),
          }
        : {}),
    });
```

- [ ] **Step 5: Run to verify they pass**

Run: `rtk vitest run src/lib/notify/resend.test.ts src/lib/notify/gmail.test.ts`
Expected: PASS (including the pre-existing attachment/text tests).

- [ ] **Step 6: Commit**

```bash
rtk git add src/lib/notify/resend.ts src/lib/notify/gmail.ts src/lib/notify/resend.test.ts src/lib/notify/gmail.test.ts
rtk git commit -m "feat(email): forward html body and map inline-image cid in both senders"
```

---

### Task 4: Wire the inline logo into `notify()`

**Files:**
- Modify: `src/lib/notify/index.ts` (import + the `notify` function body, lines 52-59)

**Interfaces:**
- Consumes: `attachInlineLogo` (Task 2)

This is one-line wiring of the already-unit-tested `attachInlineLogo` (covered in Task 2). It is verified by a typecheck plus the full suite rather than a new test, because `notify()` resolves the notifier through the `config` singleton, which is awkward to redirect at runtime; the meaningful logic lives in `attachInlineLogo`.

- [ ] **Step 1: Add the import**

In `src/lib/notify/index.ts`, add to the existing imports near the top:

```ts
import { attachInlineLogo } from "./email-layout";
```

- [ ] **Step 2: Inject the logo in `notify()`**

In `src/lib/notify/index.ts`, change the send line inside `notify()` from:

```ts
    await getNotifier().send(to, message);
```

to:

```ts
    await getNotifier().send(to, attachInlineLogo(message));
```

- [ ] **Step 3: Typecheck**

Run: `rtk tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full notify suite**

Run: `rtk vitest run src/lib/notify`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/notify/index.ts
rtk git commit -m "feat(email): inject the inline logo for every html email in notify()"
```

---

### Task 5: Build functions emit branded HTML

**Files:**
- Modify: `src/lib/notify/types.ts` (`buildApprovalEmail`, `buildTicketsEmail`, `buildGatePassEmail`, `buildRejectionEmail`)
- Test: `src/lib/notify/types.test.ts` (append html assertions)

**Interfaces:**
- Consumes: `renderEmail`, `escapeHtml` (Task 1); `MOTTO_PICKUP` (existing, from `../venue`)
- Produces: each build function now returns `{ subject, text, html }` (signatures unchanged)

- [ ] **Step 1: Write the failing html tests**

Append to `src/lib/notify/types.test.ts`:

```ts
describe("html bodies", () => {
  it("approval html has the pay link in both the button and the link box, plus the expiry note", () => {
    const m = buildApprovalEmail({ eventName: "Test Fest", name: "Ali", payUrl: "https://x/pay/TOK" });
    expect(m.html).toBeDefined();
    expect(m.html).toContain('href="https://x/pay/TOK"'); // button
    expect(m.html).toContain(">https://x/pay/TOK</a>"); // visible link box
    expect(m.html).toContain("Kişisel ödeme bağlantınız");
    expect(m.html).toContain("süresi yakında dolacaktır");
  });

  it("approval html escapes the applicant name", () => {
    const m = buildApprovalEmail({ eventName: "Test Fest", name: "A<b>", payUrl: "https://x/pay/TOK" });
    expect(m.html).toContain("A&lt;b&gt;");
    expect(m.html).not.toContain("A<b>,");
  });

  it("tickets html shows the ticket link and the menu perk", () => {
    const m = buildTicketsEmail({ eventName: "KİNDZİ FEST", name: "Ayşe", ticketsUrl: "https://x/tickets/abc" });
    expect(m.html).toContain(">https://x/tickets/abc</a>");
    expect(m.html).toContain("Bilet bağlantınız");
    expect(m.html).toContain("ızgara köfte");
  });

  it("gate-pass html signals pay-at-the-gate, shows the ticket link, and omits the menu perk", () => {
    const m = buildGatePassEmail({ eventName: "KİNDZİ FEST", name: "Ali", ticketsUrl: "https://x/tickets/tok-1" });
    expect(m.html).toContain("girişte");
    expect(m.html).toContain(">https://x/tickets/tok-1</a>");
    expect(m.html).toContain(MOTTO_PICKUP);
    expect(m.html).not.toContain("ızgara köfte");
  });

  it("rejection html is branded but carries no link or button", () => {
    const m = buildRejectionEmail({ eventName: "Test Fest", name: "Ali" });
    expect(m.html).toBeDefined();
    expect(m.html).toContain("by Deniz'in Yeri");
    expect(m.html).not.toContain("http");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `rtk vitest run src/lib/notify/types.test.ts`
Expected: FAIL — `m.html` is undefined.

- [ ] **Step 3: Add the import to `types.ts`**

At the top of `src/lib/notify/types.ts`, below the existing `MOTTO_PICKUP` import, add:

```ts
import { renderEmail, escapeHtml } from "./email-layout";
```

- [ ] **Step 4: Add `html` to `buildApprovalEmail`**

In `src/lib/notify/types.ts`, replace the `return { ... }` inside `buildApprovalEmail` with:

```ts
  return {
    subject: `${p.eventName} başvurunuz onaylandı`,
    text: `Merhaba ${p.name},\n\nGüzel haber, ${p.eventName} için bilet satın almanız onaylandı.\nSatın alma işleminizi buradan tamamlayabilirsiniz (bağlantının süresi yakında dolacaktır):\n${p.payUrl}\n\nEtkinlikte görüşmek üzere!`,
    html: renderEmail({
      eyebrow: { text: "Başvurunuz onaylandı 🎉", color: "#16a34a" },
      heading: `Merhaba ${escapeHtml(p.name)},`,
      bodyHtml: `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">${p.eventName} için bilet satın almanız onaylandı. Aşağıdaki butona tıklayarak ödemenizi güvenle tamamlayabilirsiniz.</p>`,
      cta: { label: "Ödemeyi Tamamla →", url: p.payUrl },
      linkBox: {
        label: "🔗 Kişisel ödeme bağlantınız",
        url: p.payUrl,
        caption: "Buton açılmazsa bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın.",
      },
      note: "⏳ Bu bağlantının süresi yakında dolacaktır, lütfen kısa sürede tamamlayın.",
    }),
  };
```

- [ ] **Step 5: Add `html` to `buildTicketsEmail`**

Replace the `return { ... }` inside `buildTicketsEmail` with (keep the existing `text` exactly as-is):

```ts
  return {
    subject: `${p.eventName} biletleriniz hazır`,
    text:
      `Merhaba ${p.name},\n\n` +
      `Ödemeniz alındı. ${p.eventName} biletleriniz bu e-postaya PDF olarak eklenmiştir.\n` +
      `Biletiniz 1 ücretsiz içecek ve 1 ızgara köfte ikramı içerir.\n` +
      `Biletlerinizi çevrimiçi görüntülemek veya yeniden indirmek için:\n${p.ticketsUrl}\n\n` +
      `Girişte bu biletteki karekodu okutmanız yeterlidir. Etkinlikte görüşmek üzere!`,
    html: renderEmail({
      eyebrow: { text: "Ödemeniz alındı ✅", color: "#16a34a" },
      heading: `İşte biletleriniz, ${escapeHtml(p.name)}! 🎉`,
      bodyHtml:
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">${p.eventName} biletleriniz bu e-postaya <strong>PDF olarak eklenmiştir</strong>. Girişte bu PDF'teki karekodu okutmanız yeterli.</p>` +
        `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">🍹 Biletiniz <strong>1 ücretsiz içecek</strong> ve <strong>1 ızgara köfte</strong> ikramı içerir.</p>`,
      cta: { label: "Biletlerimi Görüntüle →", url: p.ticketsUrl },
      linkBox: {
        label: "🎫 Bilet bağlantınız",
        url: p.ticketsUrl,
        caption: "Biletlerinizi çevrimiçi görüntülemek veya tekrar indirmek için.",
      },
      note: "Girişte kimliğinizi yanınızda bulundurmayı unutmayın.",
    }),
  };
```

- [ ] **Step 6: Add `html` to `buildGatePassEmail`**

Replace the `return { ... }` inside `buildGatePassEmail` with (keep the existing `text` exactly as-is):

```ts
  return {
    subject: `${p.eventName} QR biletiniz hazır — ödeme girişte`,
    text:
      `Merhaba ${p.name},\n\n` +
      `${p.eventName} için QR biletiniz hazır ve bu e-postaya PDF olarak eklenmiştir.\n` +
      `ÖNEMLİ: Bilet ücretini girişte ödeyeceksiniz; ödemeniz henüz alınmadı.\n` +
      `Dilerseniz fiziksel biletinizi şu adresten de alabilirsiniz: ${MOTTO_PICKUP}\n` +
      `Biletinizi çevrimiçi görüntülemek için:\n${p.ticketsUrl}\n\n` +
      `Girişte bu biletteki karekodu okutup ödemenizi yapmanız yeterlidir. Etkinlikte görüşmek üzere!`,
    html: renderEmail({
      eyebrow: { text: "Ödeme girişte 🎟️", color: "#D97706" },
      heading: `İşte QR biletiniz, ${escapeHtml(p.name)}!`,
      bodyHtml:
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">${p.eventName} QR biletiniz bu e-postaya <strong>PDF olarak eklenmiştir</strong>.</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEFCE8;border:1px solid #FDE68A;border-radius:10px;margin:0 0 22px;"><tr><td style="padding:14px 16px;"><p style="margin:0;font-size:14px;line-height:1.55;color:#92400E;"><strong>⚠️ Önemli:</strong> Bilet ücretini <strong>girişte ödeyeceksiniz</strong>; ödemeniz henüz alınmadı. Dilerseniz fiziksel biletinizi ${escapeHtml(MOTTO_PICKUP)} adresinden de alabilirsiniz.</p></td></tr></table>`,
      cta: { label: "Biletimi Görüntüle →", url: p.ticketsUrl },
      linkBox: {
        label: "🎫 Bilet bağlantınız",
        url: p.ticketsUrl,
        caption: "Biletinizi çevrimiçi görüntülemek için.",
      },
      note: "Girişte karekodu okutup ödemenizi yapmanız yeterli.",
    }),
  };
```

- [ ] **Step 7: Add `html` to `buildRejectionEmail`**

Replace the `return { ... }` inside `buildRejectionEmail` with:

```ts
  return {
    subject: `${p.eventName} başvurunuz hakkında`,
    text: `Merhaba ${p.name},\n\n${p.eventName} etkinliğine gösterdiğiniz ilgi için teşekkür ederiz. Maalesef şu anda size bilet sunamıyoruz.\n\nSaygılarımızla.`,
    html: renderEmail({
      heading: `Merhaba ${escapeHtml(p.name)},`,
      bodyHtml:
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">${p.eventName} etkinliğine gösterdiğiniz ilgi için teşekkür ederiz. Maalesef şu anda size bilet sunamıyoruz.</p>` +
        `<p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#3f3f46;">Saygılarımızla.</p>`,
    }),
  };
```

- [ ] **Step 8: Run the build-function tests**

Run: `rtk vitest run src/lib/notify/types.test.ts`
Expected: PASS (new html cases and all pre-existing text cases).

- [ ] **Step 9: Typecheck and run the full notify suite**

Run: `rtk tsc --noEmit`
Expected: no errors.

Run: `rtk vitest run src/lib/notify`
Expected: PASS (every file, including `dispatch.test.ts`).

- [ ] **Step 10: Commit**

```bash
rtk git add src/lib/notify/types.ts src/lib/notify/types.test.ts
rtk git commit -m "feat(email): render branded HTML bodies for approval, tickets, gate-pass, and rejection emails"
```

---

## Self-Review

**Spec coverage:**
- HTML body for all transactional emails → Task 5 (approval, tickets, gate pass, rejection). ✅
- Prominent CTA button + highlighted link box → `renderEmail` in Task 1; applied in Task 5. ✅
- Inline CID logo, displays in remote-image-blocking clients → Tasks 2 (load/inject) + 3 (cid mapping) + 4 (wiring). ✅
- PNG asset + content type → Task 1 rename + Task 2 `contentType: "image/png"`. ✅
- Graceful degradation / best-effort delivery → Task 2 (null logo path) + Task 4 (unchanged best-effort `notify`). ✅
- `text` fallback preserved → Tasks 3 & 5 keep `text` verbatim. ✅
- WhatsApp and `buildConfirmationEmail` untouched (non-goals) → not modified. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅

**Type consistency:** `LOGO_CID`, `loadLogoAttachment`, `attachInlineLogo`, `renderEmail`, `escapeHtml` names and signatures match across Tasks 1-5; `cid`→`contentId` (Resend) and `cid`→`cid` (nodemailer) mappings are consistent with the spec. ✅
