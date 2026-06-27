# Branded HTML Emails with Inline Logo + Prominent Links

Date: 2026-06-26
Status: Approved (design)

## Problem

All transactional emails are sent as **plain text only**. `EmailMessage` has only a
`text` field ([src/lib/notify/types.ts](../../../src/lib/notify/types.ts)), and both senders
(`ResendNotifier`, `GmailNotifier`) forward only `subject` + `text` (+ optional attachments).

Consequences:
- The personal **payment link** is a raw URL dropped inside a paragraph — easy to miss.
- The same applies to the **ticket links** in the delivery emails.
- Plain text **cannot display an image**, so there is no branding.

## Goals

1. Give every transactional email a branded **HTML body** with the KİNDZİ FEST logo at the top.
2. Make the action link **impossible to miss**: a large CTA button **and** a separate
   highlighted box containing the actual link in large, bold type.
3. Apply this consistently to all transactional emails.
4. Never break delivery: HTML/image are additive; any failure degrades gracefully and the
   email still sends. The existing best-effort `notify()` contract is preserved.

## Non-Goals

- WhatsApp messages are unchanged.
- `buildConfirmationEmail` is unused outside tests and is left as-is (out of scope).
- No change to payment/ticket logic, routes, or token handling.

## Decisions (approved)

- **Scope:** all transactional emails — approval (pay link), paid tickets, gate pass, rejection.
- **Image:** the KİNDZİ FEST logo at `public/email/`. The saved file is actually a **PNG**
  (523×345) despite a `.jpg` name; implementation renames it to
  `public/email/kindzi-fest-logo.png` and sends it with content type `image/png`.
- **Embedding:** **inline via CID** (`contentId` on Resend, `cid` on nodemailer), referenced as
  `cid:...` in the HTML, so the image displays even in clients that block remote images.
- **CTA button color:** orange `#F97316` (matches the logo).
- **Link visibility:** in addition to the button, a highlighted box
  (`#FFF7ED` bg, `#FDBA74` border) with the link in 17px bold underlined orange (`#EA580C`).

## Architecture

### 1. Type changes — `src/lib/notify/types.ts`

```ts
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string;          // inline image content-id (referenced as cid:... in html)
  contentType?: string;  // e.g. "image/png"
};
export type EmailMessage = {
  to?: string;
  subject: string;
  text: string;          // kept as plain-text fallback (multipart)
  html?: string;         // new: branded HTML body
  attachments?: EmailAttachment[];
};
```

### 2. Senders pass HTML + map the cid

- `ResendNotifier` ([resend.ts](../../../src/lib/notify/resend.ts)): include `html` when present;
  map each attachment to `{ filename, content, contentId: a.cid, contentType: a.contentType }`.
- `GmailNotifier` ([gmail.ts](../../../src/lib/notify/gmail.ts)): include `html` when present;
  map each attachment to `{ filename, content, cid: a.cid, contentType: a.contentType }`.
- `ConsoleNotifier`: unchanged (still logs `text`; may note an html body is present).

### 3. New shared layout helper — `src/lib/notify/email-layout.ts`

- `export const LOGO_CID = "kindzi-fest-logo";`
- `loadLogoAttachment(): EmailAttachment | null` — reads `public/email/kindzi-fest-logo.png`
  once and caches the Buffer. On any read error, logs and returns `null` (the email still
  sends without the image). Returns `{ filename, content, cid: LOGO_CID, contentType: "image/png" }`.
- `renderEmail(p)` — returns the full branded HTML string (table-based, inline styles for
  email-client compatibility). Parameters:
  - `eyebrow: { text: string; color: string }` — small uppercase label (e.g. green
    "Başvurunuz onaylandı", amber "Ödeme girişte").
  - `heading: string` — the greeting/headline.
  - `bodyHtml: string` — the message body (already-trusted HTML built from our own copy; no
    user-supplied HTML is interpolated unescaped — only `name`, which is escaped).
  - `cta?: { label: string; url: string }` — orange button.
  - `linkBox?: { label: string; url: string; caption: string }` — the highlighted link box.
  - `note?: string` — small centered note under the link box (e.g. expiry warning).
  - Always renders: logo header `<img src="cid:${LOGO_CID}">`, then the content, then the footer
    `Etkinlikte görüşmek üzere! / KİNDZİ FEST · by Deniz'in Yeri`.
- A small `escapeHtml()` for interpolated values (the applicant `name`).

### 4. Build functions produce `html` + keep `text`

Each keeps its current `subject` and `text` (multipart fallback) and adds `html` via
`renderEmail(...)`:

| Function | eyebrow | cta / linkBox url | notes |
|---|---|---|---|
| `buildApprovalEmail` | green "Başvurunuz onaylandı" | `payUrl` | note = expiry warning; link box label "🔗 Kişisel ödeme bağlantınız" |
| `buildTicketsEmail` | green "Ödemeniz alındı" | `ticketsUrl` | body mentions PDF attached + 1 içecek & 1 köfte perk; link box "🎫 Bilet bağlantınız" |
| `buildGatePassEmail` | amber "Ödeme girişte" | `ticketsUrl` | body has amber "ödeme girişte" warning + pickup at `MOTTO_PICKUP`; link box "🎫 Bilet bağlantınız" |
| `buildRejectionEmail` | neutral | none | no button, no link box; branded shell only |

### 5. Central logo injection — `src/lib/notify/index.ts`

In `notify()`, when `message.html` is set, append the inline logo attachment (from
`loadLogoAttachment()`) to `message.attachments` before sending. This covers **every** path —
the dispatch helpers and the direct rejection send in
[admin/actions.ts](../../../src/app/admin/actions.ts) — and keeps the build functions pure (no
file IO). It merges cleanly with the PDF attachment on ticket emails. If `loadLogoAttachment()`
returns `null`, nothing is appended and the email still sends.

## Error handling

- `notify()` remains best-effort: it already catches and logs send failures.
- Missing/unreadable logo file → no image, email still sends.
- Senders only set `html` when present, so any non-HTML email path is unchanged.

## Testing (TDD)

- `email-layout.test.ts`: `renderEmail` output contains the heading, the CTA `url` in an
  `href`, the link-box `url`, and an `<img src="cid:kindzi-fest-logo">`; omits button/link box
  when not provided; `escapeHtml` escapes a name containing `<`/`&`.
- `resend.test.ts`: when `html` present it is forwarded; an attachment with `cid` maps to
  `contentId` and `contentType` passes through.
- `gmail.test.ts`: when `html` present it is forwarded; an attachment with `cid` maps to `cid`.
- `index.test.ts` (`notify`): with an html message the logo attachment is appended; with a
  text-only message no logo is appended; when the logo can't be loaded the send still proceeds.
- `types.test.ts`: each build function's `html` contains its link (pay/tickets) and the right
  eyebrow/labels; `text` fallback is preserved.
- Existing `dispatch.test.ts` continues to pass (ticket emails still carry the PDF; html now
  also present).

## Asset

- `public/email/kindzi-fest-logo.png` (renamed from the saved `.jpg`; it is a PNG).
