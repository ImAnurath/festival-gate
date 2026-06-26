import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EmailAttachment, EmailMessage } from "./types";

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
