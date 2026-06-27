# WhatsApp Template Setup (KİNDZİ FEST)

How to recreate the two WhatsApp templates in **Meta WhatsApp Manager** so they
match the rich format the code now sends (image header + name body + tappable
URL button). Editing an approved template **re-submits it for Meta review** —
expect a short "Pending" period before it goes live. Sends during that window
fail gracefully (the email and the admin copy-link button are the fallback).

> ⚠️ **Critical:** the button's base URL must be `https://denizinyeri.com/{{1}}`
> — with `{{1}}` as the **whole path**, NOT `https://denizinyeri.com/pay/{{1}}`.
> The code sends the full path suffix (`pay/<token>`, `tickets/<token>`) as the
> button variable. If you put `/pay/{{1}}` you'll get a doubled `/pay/pay/...`
> and a broken link.

Production domain: **`https://denizinyeri.com`**. This is the host used below
and it **must match** `NEXT_PUBLIC_APP_URL` in Vercel, or the reconstructed
link and the logo image will point at the wrong host.

> **Note on the button's URL sample:** the sample box wants the *full example
> URL* (e.g. `https://denizinyeri.com/pay/abc123`), not just the suffix — it is
> used only for Meta's review preview. At send time the code passes the suffix
> (`pay/<token>`) as the `{{1}}` value, producing the real link.

---

## What the code sends (for reference)

For every send, `MetaWhatsAppSender` posts these three components:

| Component | Content |
|-----------|---------|
| `header` (image) | `https://denizinyeri.com/email/kindzi-fest-logo.png` (the live logo) |
| `body` | variable `{{1}}` = buyer's first name |
| `button` (URL, index 0) | variable `{{1}}` = path suffix, e.g. `pay/abc123` or `tickets/abc123` |

So when you create the templates, define exactly: one image header, one body
variable, and one dynamic URL button. Keep the template **names** and
**language** matching the env vars (see bottom).

---

## Template 1 — `odeme_linki` (payment link)

- **Category:** Utility (Turkish UI: **Bilgilendirme → Varsayılan**)
- **Language:** Turkish (`tr`)
- **Header:** Media → **Image**. Upload `public/email/kindzi-fest-logo.png` as the
  sample (this is only for review; the code sends the live image each time).
- **Body:**
  ```
  Merhaba {{1}}! 🎉

  KİNDZİ FEST başvurunuz onaylandı. Yerinizi ayırtmak için ödemenizi aşağıdaki butondan güvenle tamamlayabilirsiniz.

  ⏳ Bağlantının süresi yakında dolacak, lütfen kısa sürede tamamlayın.
  ```
  - Body sample for `{{1}}`: `Ahmet`
- **Footer:**
  ```
  Deniz'in Yeri · KİNDZİ FEST
  ```
- **Buttons:** Add one → **Visit website** → **Dynamic**.
  - Button text: `Ödemeyi Tamamla`
  - URL: `https://denizinyeri.com/{{1}}`
  - URL sample (full example URL): `https://denizinyeri.com/pay/abc123`

---

## Template 2 — `bilet_linki` (tickets link)

This one template is used for **both** paid tickets and pay-at-the-gate passes,
so the copy deliberately does not claim "payment received."

- **Category:** Utility (Turkish UI: **Bilgilendirme → Varsayılan**)
- **Language:** Turkish (`tr`)
- **Header:** Media → **Image**. Upload `public/email/kindzi-fest-logo.png` as the sample.
- **Body:**
  ```
  Merhaba {{1}}! 🎫

  KİNDZİ FEST biletleriniz hazır ve e-postanıza da gönderildi. Aşağıdaki butondan biletlerinizi görüntüleyebilirsiniz.

  Girişte karekodu okutmanız yeterli. İyi eğlenceler!
  ```
  - Body sample for `{{1}}`: `Ayşe`
- **Footer:**
  ```
  Deniz'in Yeri · KİNDZİ FEST
  ```
- **Buttons:** Add one → **Visit website** → **Dynamic**.
  - Button text: `Biletlerim`
  - URL: `https://denizinyeri.com/{{1}}`
  - URL sample (full example URL): `https://denizinyeri.com/tickets/abc123`

---

## After approval — checklist

1. Both templates show **Approved** in WhatsApp Manager.
2. Vercel env vars match the template names/langs:
   - `WHATSAPP_PAYLINK_TEMPLATE=odeme_linki`, `WHATSAPP_PAYLINK_TEMPLATE_LANG=tr`
   - `WHATSAPP_TICKETS_TEMPLATE=bilet_linki`, `WHATSAPP_TICKETS_TEMPLATE_LANG=tr`
3. `NEXT_PUBLIC_APP_URL` host == the `denizinyeri.com` you used in the button URLs.
4. The logo is reachable publicly at `https://denizinyeri.com/email/kindzi-fest-logo.png`
   (it ships in `public/email/`, already deployed).

If a send fails (template pending/rejected, bad domain), it's logged and the
flow continues — the branded email and the admin copy-link button still deliver
the link.
